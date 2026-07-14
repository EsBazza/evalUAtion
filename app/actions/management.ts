'use server';

import { prisma } from '@/lib/prisma';
import { writeAuditLog } from './audit';
import { generateCodeSegment, buildSectionCode } from '@/lib/codegen';


export async function getDepartmentDetails(departmentId: string) {
  return prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      sections: {
        orderBy: { name: 'asc' },
      },
      professors: {
        include: {
          sections: true,
        },
        orderBy: { name: 'asc' },
      },
    },
  });
}

export async function createSection(name: string, departmentId: string) {
  if (!name.trim()) throw new Error("Section name cannot be empty");

  const dept = await prisma.department.findUnique({
    where: { id: departmentId }
  });
  if (!dept) throw new Error("Department not found");

  const settings = await prisma.systemSetting.findUnique({
    where: { id: 'active' }
  });
  const academicYear = settings?.academicYear || "2026-2027";
  const semester = settings?.semester || "1st";

  // Generate random segment and construct formatted code
  const randomSegment = generateCodeSegment(4);
  const formattedCode = buildSectionCode(dept.level, dept.name, randomSegment, academicYear, semester);

  return prisma.section.create({
    data: {
      name,
      code: formattedCode,
      departmentId,
    },
  });
}

export async function createProfessor(name: string, email: string, departmentId: string, sectionIds?: string[]) {
  if (!name.trim() || !email.trim()) throw new Error("Name and Email are required");
  
  // Verify email domain constraint
  if (!email.endsWith('@ua.edu.ph')) {
    throw new Error("Faculty email must use the university domain @ua.edu.ph");
  }

  // Check if professor already exists
  const existing = await prisma.professor.findUnique({ where: { email } });
  if (existing) throw new Error("A professor with this email is already registered");

  const prof = await prisma.professor.create({
    data: {
      name,
      email,
      departmentId,
      sections: sectionIds && sectionIds.length > 0 ? {
        connect: sectionIds.map(id => ({ id })),
      } : undefined,
    },
  });

  await writeAuditLog('FACULTY_CREATED', { desc: `Created professor ${name} (${email})` });

  return prof;
}

export async function updateProfessor(
  id: string,
  name: string,
  email: string,
  sectionIds: string[]
) {
  if (!name.trim() || !email.trim()) throw new Error("Name and Email are required");

  if (!email.endsWith('@ua.edu.ph')) {
    throw new Error("Faculty email must use the university domain @ua.edu.ph");
  }

  // Check if email belongs to another professor
  const existing = await prisma.professor.findUnique({ where: { email } });
  if (existing && existing.id !== id) {
    throw new Error("Email is already in use by another professor");
  }

  const prof = await prisma.professor.update({
    where: { id },
    data: {
      name,
      email,
      sections: {
        set: sectionIds.map(secId => ({ id: secId })),
      },
    },
  });

  await writeAuditLog('FACULTY_UPDATED', { desc: `Updated teaching mapping/info for professor ${name} (${email})` });

  return prof;
}

import { getSystemSettings } from './settings';
import { getOrComputeScoreCache } from './ai';

export async function getFacultyProfileData(professorId: string, academicYear?: string, semester?: string) {
  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await getSystemSettings();
    termYear = settings.academicYear;
    termSem = settings.semester;
  }

  // 1. Fetch Professor details
  const professor = await prisma.professor.findUnique({
    where: { id: professorId },
    include: {
      department: true,
      sections: true,
    },
  });

  if (!professor) {
    throw new Error("Professor not found");
  }

  // 2. Fetch or compute the score cache
  const scoreCache = await getOrComputeScoreCache(professorId, termYear, termSem);

  // 3. Fetch evaluations for cluster and section scores
  const evaluations = await prisma.evaluation.findMany({
    where: {
      professorId,
      academicYear: termYear,
      semester: termSem,
    },
    include: {
      section: true,
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

  // Calculate cluster-wise averages (Radar Chart)
  const clusterMap = new Map<string, { total: number; count: number }>();
  // Calculate section-wise averages (Bar Chart)
  const sectionMap = new Map<string, { total: number; count: number }>();

  evaluations.forEach((evaluation) => {
    const sectionName = evaluation.section.name;
    
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
        return; // Skip non-scale answers for mathematical scoring
      }

      // Populate cluster map
      const clusterVal = clusterMap.get(clusterTitle) || { total: 0, count: 0 };
      clusterVal.total += normalized;
      clusterVal.count += 1;
      clusterMap.set(clusterTitle, clusterVal);

      // Populate section map
      const sectionVal = sectionMap.get(sectionName) || { total: 0, count: 0 };
      sectionVal.total += normalized;
      sectionVal.count += 1;
      sectionMap.set(sectionName, sectionVal);
    });
  });

  const clusterScores = Array.from(clusterMap.entries()).map(([title, val]) => ({
    subject: title.replace(/^Cluster \d+:\s*/, ''), // Clean standard prefixes
    score: Number((val.total / val.count).toFixed(1)),
    fullMark: 100,
  }));

  const sectionScores = Array.from(sectionMap.entries()).map(([name, val]) => ({
    name,
    score: Number((val.total / val.count).toFixed(1)),
  }));

  // 4. Fetch historical scores (Line Chart)
  const historicalCaches = await prisma.scoreCache.findMany({
    where: { professorId },
    orderBy: [
      { academicYear: 'asc' },
      { semester: 'asc' },
    ],
  });

  const historicalScores = historicalCaches.map(c => ({
    term: `${c.academicYear} ${c.semester}`,
    score: c.compositeScore,
  }));

  // 5. Fetch AI Narrative Summary
  const aiSummary = await prisma.aiSummary.findUnique({
    where: {
      professorId_academicYear_semester: {
        professorId,
        academicYear: termYear,
        semester: termSem,
      },
    },
  });

  // 6. Extract student comments from answers
  const comments: string[] = [];
  evaluations.forEach((evaluation) => {
    evaluation.answers.forEach((ans) => {
      if (ans.textVal && ans.textVal.trim()) {
        comments.push(ans.textVal.trim());
      }
    });
  });

  // 7. Fetch raw evaluation log (anonymized)
  const evaluationLog = evaluations.map(e => ({
    id: e.id,
    sectionName: e.section.name,
    createdAt: e.createdAt,
  }));

  return {
    professor: {
      id: professor.id,
      name: professor.name,
      email: professor.email,
      department: professor.department.name,
      level: professor.department.level,
      sections: professor.sections.map(s => s.name).join(', '),
    },
    scoreCache: scoreCache ? {
      scaleScore: scoreCache.scaleScore,
      aiQualityScore: scoreCache.aiQualityScore,
      compositeScore: scoreCache.compositeScore,
      isStale: scoreCache.isStale,
      lastComputedAt: scoreCache.lastComputedAt,
    } : null,
    clusterScores,
    sectionScores,
    historicalScores,
    aiSummary: aiSummary ? {
      summaryText: aiSummary.summaryText,
      ratingScore: aiSummary.ratingScore,
    } : null,
    comments,
    evaluationLog,
  };
}

export async function deleteSection(sectionId: string) {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { department: true }
  });
  if (!section) throw new Error("Section not found");

  await prisma.$transaction([
    prisma.evaluationReceipt.deleteMany({
      where: { sectionId },
    }),
    prisma.evaluation.deleteMany({
      where: { sectionId },
    }),
    prisma.section.delete({
      where: { id: sectionId },
    }),
  ]);

  await writeAuditLog('SECTION_DELETED', { desc: `Deleted section ${section.name} under department ${section.department.name}` });
  
  return { success: true };
}
