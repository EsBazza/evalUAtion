'use server';

import { GoogleGenAI } from "@google/genai";
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getSystemSettings } from './settings';

// Use the lightweight model for all AI evaluation work
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY?.replace(/"/g, "").trim() });

export async function getFacultyProfessorId() {
  const session = await auth();
  if (!session || !session.user?.email) return null;
  const prof = await prisma.professor.findUnique({
    where: { email: session.user.email }
  });
  return prof?.id || null;
}

/**
 * Helper to calculate normalized scale score (0 to 100)
 */
export async function calculateScaleScore(professorId: string, academicYear: string, semester: string): Promise<number | null> {
  const answers = await prisma.answer.findMany({
    where: {
      evaluation: {
        professorId,
        academicYear,
        semester,
      },
      criterion: {
        type: {
          in: ['SCALE_1_TO_5', 'SCALE_0_TO_4'],
        },
      },
    },
    include: {
      criterion: true,
    },
  });

  if (answers.length === 0) return null;

  let totalNormalized = 0;
  let count = 0;

  answers.forEach((ans) => {
    if (ans.score === null || ans.score === undefined) return;
    
    let normalized = 0;
    if (ans.criterion.type === 'SCALE_0_TO_4') {
      normalized = ans.score * 25; // 0-4 mapped to 0-100
    } else if (ans.criterion.type === 'SCALE_1_TO_5') {
      normalized = (ans.score - 1) * 25; // 1-5 mapped to 0-100
    }
    totalNormalized += normalized;
    count++;
  });

  return count > 0 ? Number((totalNormalized / count).toFixed(2)) : null;
}

/**
 * Regenerates the AI summary and sentiment rating from text comments
 */
export async function processFacultyEvaluationSummary(professorId: string, academicYear?: string, semester?: string) {
  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await getSystemSettings();
    termYear = settings.academicYear;
    termSem = settings.semester;
  }

  // Fetch only structural text responses linked to the evaluation parameters for the chosen term
  const answers = await prisma.answer.findMany({
    where: {
      criterion: { type: "TEXT_LONG" },
      evaluation: { 
        professorId: professorId,
        academicYear: termYear,
        semester: termSem
      }
    },
    select: { textVal: true }
  });

  const feedbackData = answers.map(a => a.textVal).filter(Boolean).join("\n - ");
  
  if (!feedbackData) {
    return { success: false, message: `Insufficient feedback volume for term ${termYear} (${termSem} Sem).` };
  }

  // Fetch evaluations for cluster scores calculation
  const evaluations = await prisma.evaluation.findMany({
    where: {
      professorId,
      academicYear: termYear,
      semester: termSem,
    },
    include: {
      answers: {
        include: {
          criterion: {
            include: {
              cluster: true,
            },
          },
        },
      },
    },
  });

  const clusterMap = new Map<string, { total: number; count: number }>();
  evaluations.forEach((evaluation) => {
    evaluation.answers.forEach((ans) => {
      if (ans.score === null || ans.score === undefined) return;
      const clusterTitle = ans.criterion.cluster.title;
      const type = ans.criterion.type;

      let normalized = 0;
      if (type === 'SCALE_0_TO_4') {
        normalized = ans.score * 25;
      } else if (type === 'SCALE_1_TO_5') {
        normalized = (ans.score - 1) * 25;
      } else {
        return;
      }

      const clusterVal = clusterMap.get(clusterTitle) || { total: 0, count: 0 };
      clusterVal.total += normalized;
      clusterVal.count += 1;
      clusterMap.set(clusterTitle, clusterVal);
    });
  });

  const clusterAveragesText = Array.from(clusterMap.entries()).map(([title, val]) => {
    const avg = val.count > 0 ? (val.total / val.count).toFixed(1) : 'N/A';
    return `- ${title}: ${avg}%`;
  }).join("\n");

  let ratingScore = 70; // fallback default
  let summaryText = "No qualitative text feedback submitted yet.";

  try {
    const aiPromise = ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `You are a warm, professional academic performance coach at the University of the Assumption. 
      Your role is to read through anonymous student evaluation feedback and the numerical cluster averages for a faculty member and write a personal, 
      encouraging, and honest summary addressed directly TO the faculty member (use "you" and "your").
      
      Numerical Evaluation Averages per Cluster:
      ${clusterAveragesText}
      
      The summary should:
      - Explicitly include the average score per cluster (so they know how they performed in each specific area)
      - Open with a genuine acknowledgment of their overall performance this term
      - Explicitly outline where the faculty excels and where they are lacking based on the cluster averages and student feedback
      - Highlight 1-2 specific strengths students noticed
      - Honestly but kindly address 1-2 areas where improvement is needed
      - Close with 1-2 concrete, actionable tips they can apply next semester
      - Sound human, warm, and supportive — not robotic or corporate
      - Be 5-7 sentences total
      
      Also output an integer score from 1-100 reflecting the overall sentiment quality of the feedback.
      
      Format your output STRICTLY as JSON with no extra text outside it:
      {"summary": "Your average scores per cluster are: [include them]. Your students this term...", "score": 85}

      Student feedback comments:
      - ${feedbackData}`,
    });

    // 30-second timeout guard — prevents slow Gemini calls from blocking rankings page
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI request timed out after 30 seconds')), 30000)
    );

    const response = await Promise.race([aiPromise, timeoutPromise]);

      // Simple cleaning to extract JSON block if wrapped
      const text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      const cleanJson = JSON.parse(match ? match[0] : text);

      summaryText = cleanJson.summary || summaryText;
      ratingScore = typeof cleanJson.score === 'number' ? cleanJson.score : ratingScore;
    } catch (e: any) {
      const reason = e?.message || String(e);
      console.error("Gemini processing error:", reason);
      // Surface a more helpful message depending on the failure reason
      if (reason.includes('API_KEY') || reason.includes('API key') || reason.includes('401')) {
        summaryText = "AI summary unavailable: GEMINI_API_KEY is missing or invalid. Please set it in your Vercel environment variables.";
      } else if (reason.includes('quota') || reason.includes('429')) {
        summaryText = "AI summary unavailable: Gemini API quota exceeded. Try again later.";
      } else {
        summaryText = `AI summary generation failed: ${reason}`;
      }
    }

  // Upsert the AI summary
  await prisma.aiSummary.upsert({
    where: {
      professorId_academicYear_semester: {
        professorId,
        academicYear: termYear,
        semester: termSem
      }
    },
    update: { summaryText, ratingScore },
    create: { 
      professorId, 
      academicYear: termYear,
      semester: termSem,
      summaryText, 
      ratingScore 
    }
  });

  // Calculate the mathematical scale score
  const scaleScore = await calculateScaleScore(professorId, termYear, termSem);
  
  // Weighted blend: 70% scale, 30% AI rating
  // If AI generation failed/unavailable, use 100% mathematical scale score to avoid distorting rankings.
  const isAiAvailable = !summaryText.startsWith("AI summary unavailable") && !summaryText.startsWith("AI summary generation failed");
  const compositeScore = scaleScore !== null 
    ? (isAiAvailable ? Number(((scaleScore * 0.7) + (ratingScore * 0.3)).toFixed(2)) : scaleScore)
    : ratingScore;

  // Cache the result
  await prisma.scoreCache.upsert({
    where: {
      professorId_academicYear_semester: {
        professorId,
        academicYear: termYear,
        semester: termSem
      }
    },
    update: {
      scaleScore,
      aiQualityScore: ratingScore,
      compositeScore,
      isStale: false,
      lastComputedAt: new Date()
    },
    create: {
      professorId,
      academicYear: termYear,
      semester: termSem,
      scaleScore,
      aiQualityScore: ratingScore,
      compositeScore,
      isStale: false,
      lastComputedAt: new Date()
    }
  });

  // Also log the generation event
  const { writeAuditLog } = await import('./audit');
  await writeAuditLog('AI_SUMMARY_GENERATED', { professorId, academicYear: termYear, semester: termSem });

  return { success: true };
}

/**
 * Retrieves the AI summary
 */
export async function getFacultySummary(professorId: string, academicYear?: string, semester?: string) {
  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await getSystemSettings();
    termYear = settings.academicYear;
    termSem = settings.semester;
  }

  return prisma.aiSummary.findUnique({
    where: {
      professorId_academicYear_semester: {
        professorId,
        academicYear: termYear,
        semester: termSem
      }
    }
  });
}

/**
 * Lazy loaded score cache fetcher
 */
export async function getOrComputeScoreCache(professorId: string, academicYear?: string, semester?: string) {
  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await getSystemSettings();
    termYear = settings.academicYear;
    termSem = settings.semester;
  }

  if (!professorId || !termYear || !termSem) {
    return null;
  }

  let cache = await prisma.scoreCache.findFirst({
    where: {
      professorId,
      academicYear: termYear,
      semester: termSem
    }
  });

  // If missing or stale, trigger re-evaluation (lazy compute)
  if (!cache || cache.isStale) {
    await processFacultyEvaluationSummary(professorId, termYear, termSem);
    
    cache = await prisma.scoreCache.findFirst({
      where: {
        professorId,
        academicYear: termYear,
        semester: termSem
      }
    });
  }

  return cache;
}

export async function getDepartmentAiSummary(departmentId: string, academicYear?: string, semester?: string) {
  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await getSystemSettings();
    termYear = settings.academicYear;
    termSem = settings.semester;
  }

  const dept = await prisma.department.findUnique({
    where: { id: departmentId }
  });

  if (!dept) {
    return { success: false, summary: "Department not found." };
  }

  const professors = await prisma.professor.findMany({
    where: { departmentId },
    include: {
      scoreCaches: {
        where: {
          academicYear: termYear,
          semester: termSem,
        }
      }
    }
  });

  if (professors.length === 0) {
    return { success: true, summary: "No faculty members found in this department to summarize." };
  }

  const facultyData = professors.map(p => {
    const score = p.scoreCaches[0]?.compositeScore;
    const scoreText = score !== undefined && score !== null ? `${score}%` : 'No score';
    return `- ${p.name}: ${scoreText}`;
  }).join("\n");

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `You are an academic dean and performance evaluator. Provide a concise department-level performance analysis summary for the department "${dept.name}" for the academic term ${termYear} (${termSem} Semester) based on the overall faculty scores.

Overall Faculty Scores:
${facultyData}

Guidelines for the summary:
- Be concise (approx. 4-5 sentences).
- Start by summarizing the overall department strength and average standing.
- Highlight general performance patterns or positive achievements.
- Mention areas where the department could focus training or support to improve.
- Add 1-2 actionable steps for the department head/administrators to help their faculty.
- Maintain a highly professional, constructive, and encouraging tone.`,
    });

    return {
      success: true,
      summary: response.text || "No summary text generated by Gemini."
    };
  } catch (e: any) {
    const reason = e?.message || String(e);
    console.error("Gemini Department Summary processing error:", reason);
    let summaryText = `AI summary generation failed: ${reason}`;
    if (reason.includes('API_KEY') || reason.includes('API key') || reason.includes('401')) {
      summaryText = "AI summary unavailable: GEMINI_API_KEY is missing or invalid. Please check your environment variables.";
    } else if (reason.includes('quota') || reason.includes('429')) {
      summaryText = "AI summary unavailable: Gemini API quota exceeded. Try again later.";
    }
    return { success: false, summary: summaryText };
  }
}
