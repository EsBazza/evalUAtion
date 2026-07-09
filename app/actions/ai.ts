'use server';

import { GoogleGenAI } from "@google/genai";
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { getSystemSettings } from './settings';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
        contents: `Analyze the following raw student feedback comments collected for a university professor. 
        Synthesize them down to a definitive 3-sentence summary highlighting core instructional strengths and areas needing development. 
        Additionally, output an integer scale rating between 1 and 100 assessing baseline text performance sentiment.
        
        Format output strictly as JSON matching this structure:
        {"summary": "text...", "score": 85}

        Feedback data:
        - ${feedbackData}`,
      });

      // Simple cleaning to extract JSON block if wrapped
      const text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      const cleanJson = JSON.parse(match ? match[0] : text);

      summaryText = cleanJson.summary || summaryText;
      ratingScore = typeof cleanJson.score === 'number' ? cleanJson.score : ratingScore;
    } catch (e) {
      console.error("Gemini processing error:", e);
      summaryText = "AI summary generation failed due to technical constraints.";
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

  let cache = await prisma.scoreCache.findUnique({
    where: {
      professorId_academicYear_semester: {
        professorId,
        academicYear: termYear,
        semester: termSem
      }
    }
  });

  // If missing or stale, trigger re-evaluation (lazy compute)
  if (!cache || cache.isStale) {
    await processFacultyEvaluationSummary(professorId, termYear, termSem);
    
    cache = await prisma.scoreCache.findUnique({
      where: {
        professorId_academicYear_semester: {
          professorId,
          academicYear: termYear,
          semester: termSem
        }
      }
    });
  }

  return cache;
}
