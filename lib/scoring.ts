import { prisma } from '@/lib/prisma';
import { readSystemSettings } from '@/lib/settings';
import { writeAuditLog } from '@/lib/audit';
import { getGemini, GEMINI_MODEL, describeGeminiError } from '@/lib/gemini';

// Server-only scoring helpers. These are NOT server actions: callers must do
// their own authorization checks before using them.

function normalize(type: string, score: number): number | null {
  if (type === 'SCALE_0_TO_4') return score * 25; // 0-4 mapped to 0-100
  if (type === 'SCALE_1_TO_5') return (score - 1) * 25; // 1-5 mapped to 0-100
  return null;
}

async function resolveTerm(academicYear?: string, semester?: string) {
  if (academicYear && semester) return { termYear: academicYear, termSem: semester };
  const settings = await readSystemSettings();
  return { termYear: settings.academicYear, termSem: settings.semester };
}

/** Normalized scale score (0 to 100) across all scale answers for the term. */
export async function calculateScaleScore(professorId: string, academicYear: string, semester: string): Promise<number | null> {
  const answers = await prisma.answer.findMany({
    where: {
      evaluation: { professorId, academicYear, semester },
      criterion: { type: { in: ['SCALE_1_TO_5', 'SCALE_0_TO_4'] } },
    },
    include: { criterion: true },
  });

  let total = 0;
  let count = 0;
  for (const ans of answers) {
    if (ans.score === null || ans.score === undefined) continue;
    const n = normalize(ans.criterion.type, ans.score);
    if (n === null) continue;
    total += n;
    count++;
  }
  return count > 0 ? Number((total / count).toFixed(2)) : null;
}

/** Regenerates the AI summary and sentiment rating, then refreshes the score cache. */
export async function computeFacultySummary(professorId: string, academicYear?: string, semester?: string) {
  const { termYear, termSem } = await resolveTerm(academicYear, semester);

  const answers = await prisma.answer.findMany({
    where: {
      criterion: { type: 'TEXT_LONG' },
      evaluation: { professorId, academicYear: termYear, semester: termSem },
    },
    select: { textVal: true },
  });

  const feedbackData = answers.map(a => a.textVal).filter(Boolean).join('\n - ');
  if (!feedbackData) {
    return { success: false, message: `Insufficient feedback volume for term ${termYear} (${termSem} Sem).` };
  }

  const evaluations = await prisma.evaluation.findMany({
    where: { professorId, academicYear: termYear, semester: termSem },
    include: { answers: { include: { criterion: { include: { cluster: true } } } } },
  });

  const clusterMap = new Map<string, { total: number; count: number }>();
  for (const evaluation of evaluations) {
    for (const ans of evaluation.answers) {
      if (ans.score === null || ans.score === undefined) continue;
      const n = normalize(ans.criterion.type, ans.score);
      if (n === null) continue;
      const val = clusterMap.get(ans.criterion.cluster.title) || { total: 0, count: 0 };
      val.total += n;
      val.count += 1;
      clusterMap.set(ans.criterion.cluster.title, val);
    }
  }

  const clusterAveragesText = Array.from(clusterMap.entries())
    .map(([title, val]) => `- ${title}: ${val.count > 0 ? (val.total / val.count).toFixed(1) : 'N/A'}%`)
    .join('\n');

  let ratingScore = 70; // fallback default
  let summaryText = 'No qualitative text feedback submitted yet.';
  let isAiAvailable = true;

  try {
    const aiPromise = getGemini().models.generateContent({
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
    const text = response.text || '{}';
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);

    summaryText = parsed.summary || summaryText;
    ratingScore = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : ratingScore;
  } catch (e) {
    summaryText = describeGeminiError(e);
    isAiAvailable = false;
  }

  await prisma.aiSummary.upsert({
    where: { professorId_academicYear_semester: { professorId, academicYear: termYear, semester: termSem } },
    update: { summaryText, ratingScore },
    create: { professorId, academicYear: termYear, semester: termSem, summaryText, ratingScore },
  });

  const scaleScore = await calculateScaleScore(professorId, termYear, termSem);

  // Weighted blend: 70% scale, 30% AI rating. If AI failed, use 100% scale score
  // so a Gemini outage doesn't distort rankings.
  const compositeScore = scaleScore !== null
    ? (isAiAvailable ? Number((scaleScore * 0.7 + ratingScore * 0.3).toFixed(2)) : scaleScore)
    : ratingScore;

  const cacheData = {
    scaleScore,
    aiQualityScore: ratingScore,
    compositeScore,
    isStale: false,
    lastComputedAt: new Date(),
  };
  await prisma.scoreCache.upsert({
    where: { professorId_academicYear_semester: { professorId, academicYear: termYear, semester: termSem } },
    update: cacheData,
    create: { professorId, academicYear: termYear, semester: termSem, ...cacheData },
  });

  await writeAuditLog('AI_SUMMARY_GENERATED', { professorId, academicYear: termYear, semester: termSem });

  return { success: true };
}

/** Lazy score cache: recomputes when missing or stale. */
export async function getOrComputeScoreCache(professorId: string, academicYear?: string, semester?: string) {
  if (!professorId) return null;
  const { termYear, termSem } = await resolveTerm(academicYear, semester);

  const where = { professorId, academicYear: termYear, semester: termSem };
  let cache = await prisma.scoreCache.findFirst({ where });

  if (!cache || cache.isStale) {
    await computeFacultySummary(professorId, termYear, termSem);
    cache = await prisma.scoreCache.findFirst({ where });
  }
  return cache;
}
