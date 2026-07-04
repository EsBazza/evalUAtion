'use server';

import { GoogleGenAI } from "@google/genai";
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getFacultyProfessorId() {
  const session = await auth();
  if (!session || !session.user?.email) return null;
  const prof = await prisma.professor.findUnique({
    where: { email: session.user.email }
  });
  return prof?.id || null;
}

import { getSystemSettings } from './settings';

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
  
  if (!feedbackData) return { success: false, message: `Insufficient feedback volume for term ${termYear} (${termSem} Sem).` };

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

  const cleanJson = JSON.parse(response.text || "{}");

  await prisma.aiSummary.upsert({
    where: {
      professorId_academicYear_semester: {
        professorId,
        academicYear: termYear,
        semester: termSem
      }
    },
    update: { summaryText: cleanJson.summary, ratingScore: cleanJson.score },
    create: { 
      professorId, 
      academicYear: termYear,
      semester: termSem,
      summaryText: cleanJson.summary, 
      ratingScore: cleanJson.score 
    }
  });

  return { success: true };
}

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
