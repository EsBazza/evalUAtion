'use server';

import { GoogleGenAI } from "@google/genai";
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getSystemSettings } from './settings';

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

  let ratingScore = 70; // fallback default
  let summaryText = "No qualitative text feedback submitted yet.";

  try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are a warm, professional academic performance coach at the University of the Assumption. 
        Your role is to read through anonymous student evaluation feedback for a faculty member and write a personal, 
        encouraging, and honest summary addressed directly TO the faculty member (use "you" and "your").
        
        The summary should:
        - Open with a genuine acknowledgment of their overall performance this term
        - Highlight 1-2 specific strengths students noticed (be specific, not generic)
        - Honestly but kindly address 1-2 areas where students feel improvement would help
        - Close with 1-2 concrete, actionable tips they can apply next semester
        - Sound human, warm, and supportive — not robotic or corporate
        - Be 4-5 sentences total
        
        Also output an integer score from 1-100 reflecting the overall sentiment quality of the feedback.
        
        Format your output STRICTLY as JSON with no extra text outside it:
        {"summary": "Your students this term...", "score": 85}

        Student feedback comments:
        - ${feedbackData}`,
      });

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
  const compositeScore = scaleScore !== null 
    ? Number(((scaleScore * 0.7) + (ratingScore * 0.3)).toFixed(2))
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
