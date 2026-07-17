'use server';

import { prisma } from '@/lib/prisma';
import { writeAuditLog } from './audit';
import { generateCodeSegment, buildSectionCode } from '@/lib/codegen';
import { EducationLevel } from '@prisma/client';


export async function getDepartmentDetails(departmentId: string) {
  return prisma.department.findUnique({
    where: { id: departmentId },
    include: {
      sections: {
        orderBy: { name: 'asc' },
      },
      subjects: {
        orderBy: { name: 'asc' },
      },
      professors: {
        include: {
          sections: true,
          teachingAssignments: {
            include: {
              section: true,
              subject: true,
            }
          }
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

export async function createProfessor(
  name: string,
  email: string,
  departmentId: string,
  teachingAssignments?: { sectionId: string; subjectId: string }[]
) {
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
      sections: teachingAssignments && teachingAssignments.length > 0 ? {
        connect: Array.from(new Set(teachingAssignments.map(a => a.sectionId))).map(id => ({ id })),
      } : undefined,
      teachingAssignments: teachingAssignments && teachingAssignments.length > 0 ? {
        createMany: {
          data: teachingAssignments.map(a => ({
            sectionId: a.sectionId,
            subjectId: a.subjectId,
          }))
        }
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
  teachingAssignments: { sectionId: string; subjectId: string }[]
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

  const prof = await prisma.$transaction(async (tx) => {
    // Delete existing teaching assignments
    await tx.teachingAssignment.deleteMany({
      where: { professorId: id }
    });

    return tx.professor.update({
      where: { id },
      data: {
        name,
        email,
        sections: {
          set: Array.from(new Set(teachingAssignments.map(a => a.sectionId))).map(secId => ({ id: secId })),
        },
        teachingAssignments: {
          createMany: {
            data: teachingAssignments.map(a => ({
              sectionId: a.sectionId,
              subjectId: a.subjectId,
            }))
          }
        }
      },
    });
  });

  await writeAuditLog('FACULTY_UPDATED', { desc: `Updated professor ${name} (${email})` });

  return prof;
}

import { getSystemSettings } from './settings';
import { getOrComputeScoreCache } from './ai';

export async function getFacultyProfileData(
  professorId: string,
  academicYear?: string,
  semester?: string,
  subjectId?: string
) {
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
      teachingAssignments: {
        include: {
          section: true,
          subject: true,
        }
      }
    },
  });

  if (!professor) {
    throw new Error("Professor not found");
  }

  // Extract unique subjects taught by this professor
  const subjects = professor.teachingAssignments ? Array.from(
    new Map(professor.teachingAssignments.map((a: any) => [a.subject.id, a.subject])).values()
  ) : [];

  // 2. Fetch or compute the score cache
  const scoreCache = await getOrComputeScoreCache(professorId, termYear, termSem);

  // 3. Fetch evaluations for cluster and section scores (optionally filtered by subjectId)
  let evaluationsWhere: any = {
    professorId,
    academicYear: termYear,
    semester: termSem,
  };

  if (subjectId && subjectId !== 'all') {
    evaluationsWhere.subjectId = subjectId;
  }

  const evaluations = await prisma.evaluation.findMany({
    where: evaluationsWhere,
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

  let totalScaleScore = 0;
  let scaleCount = 0;

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

      totalScaleScore += normalized;
      scaleCount++;

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

  // Dynamically calculate scores
  let dynamicScaleScore = scaleCount > 0 ? Number((totalScaleScore / scaleCount).toFixed(1)) : null;
  let dynamicAiScore = scoreCache?.aiQualityScore || null;
  let dynamicCompositeScore = null;

  if (dynamicScaleScore !== null) {
    if (dynamicAiScore !== null) {
      dynamicCompositeScore = Number((dynamicScaleScore * 0.7 + dynamicAiScore * 0.3).toFixed(1));
    } else {
      dynamicCompositeScore = dynamicScaleScore;
    }
  }

  // Find the active template for this professor's department/level to get all clusters
  let activeTemplate = await prisma.template.findFirst({
    where: {
      level: professor.department.level,
      isActive: true,
      departmentId: professor.departmentId,
    },
    include: {
      clusters: {
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!activeTemplate) {
    activeTemplate = await prisma.template.findFirst({
      where: {
        level: professor.department.level,
        isActive: true,
        departmentId: null,
      },
      include: {
        clusters: {
          orderBy: { order: 'asc' }
        }
      }
    });
  }

  const clusterScores = (activeTemplate?.clusters || [])
    .filter(cluster => {
      const lower = cluster.title.toLowerCase();
      return !lower.includes("comments") && !lower.includes("suggestions");
    })
    .map((cluster) => {
      const val = clusterMap.get(cluster.title);
      return {
        title: cluster.title,
        subject: cluster.title.replace(/^Cluster \d+:\s*/, ''), // Clean standard prefixes
        score: val && val.count > 0 ? Number((val.total / val.count).toFixed(1)) : null,
        fullMark: 100,
      };
    });

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
  const summarySubjectId = (subjectId && subjectId !== 'all') ? subjectId : "all";
  const aiSummary = await prisma.aiSummary.findUnique({
    where: {
      professorId_academicYear_semester_subjectId: {
        professorId,
        academicYear: termYear,
        semester: termSem,
        subjectId: summarySubjectId,
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
      subjects, // Return professor's subject options
    },
    scoreCache: {
      scaleScore: dynamicScaleScore,
      aiQualityScore: dynamicAiScore,
      compositeScore: dynamicCompositeScore,
      isStale: scoreCache?.isStale || false,
      lastComputedAt: scoreCache?.lastComputedAt || null,
    },
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

export async function deleteFaculty(professorId: string) {
  const prof = await prisma.professor.findUnique({
    where: { id: professorId },
    include: { department: true }
  });
  if (!prof) throw new Error("Faculty not found");

  await prisma.$transaction([
    prisma.evaluationReceipt.deleteMany({
      where: { professorId }
    }),
    prisma.evaluation.deleteMany({
      where: { professorId }
    }),
    prisma.secureEvaluation.deleteMany({
      where: { facultyId: professorId }
    }),
    prisma.professor.delete({
      where: { id: professorId }
    })
  ]);

  // Clean up associated User record if their role was FACULTY
  try {
    const assocUser = await prisma.user.findUnique({ where: { email: prof.email } });
    if (assocUser && assocUser.role === 'FACULTY') {
      await prisma.user.delete({ where: { email: prof.email } });
    }
  } catch (err) {
    console.error("Non-blocking error deleting associated faculty user record:", err);
  }

  await writeAuditLog('FACULTY_DELETED', { desc: `Deleted faculty ${prof.name} under department ${prof.department.name}` });

  return { success: true };
}

export async function createSubject(name: string, code: string, departmentId: string) {
  if (!name.trim()) throw new Error("Subject name cannot be empty");
  if (!code.trim()) throw new Error("Subject code cannot be empty");

  const dept = await prisma.department.findUnique({
    where: { id: departmentId }
  });
  if (!dept) throw new Error("Department not found");

  const subject = await prisma.subject.create({
    data: {
      name,
      code,
      departmentId,
    },
  });

  await writeAuditLog('SUBJECT_CREATED', { desc: `Created subject ${name} (${code}) under department ${dept.name}` });

  return subject;
}

export async function deleteSubject(subjectId: string) {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { department: true }
  });
  if (!subject) throw new Error("Subject not found");

  await prisma.subject.delete({
    where: { id: subjectId },
  });

  await writeAuditLog('SUBJECT_DELETED', { desc: `Deleted subject ${subject.name} under department ${subject.department.name}` });

  return { success: true };
}

export async function updateSection(sectionId: string, name: string) {
  if (!name.trim()) throw new Error("Section name cannot be empty");

  const section = await prisma.section.update({
    where: { id: sectionId },
    data: { name: name.trim() },
    include: { department: true },
  });

  await writeAuditLog('SECTION_UPDATED', { desc: `Updated section ${section.name} under department ${section.department.name}` });

  return section;
}

export async function updateSubject(subjectId: string, name: string, code: string) {
  if (!name.trim()) throw new Error("Subject name cannot be empty");
  if (!code.trim()) throw new Error("Subject code cannot be empty");

  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data: { name: name.trim(), code: code.trim() },
    include: { department: true },
  });

  await writeAuditLog('SUBJECT_UPDATED', { desc: `Updated subject ${subject.name} (${subject.code}) under department ${subject.department.name}` });

  return subject;
}

export async function updateDepartment(departmentId: string, name: string, level: EducationLevel) {
  if (!name.trim()) throw new Error("Department name cannot be empty");

  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
  });
  if (!dept) throw new Error("Department not found");

  if ((dept.level === 'JHS' || dept.level === 'SHS') && (level !== dept.level)) {
    throw new Error("Cannot change education level of core school divisions (JHS/SHS).");
  }

  const updated = await prisma.department.update({
    where: { id: departmentId },
    data: {
      name: name.trim(),
      level,
    },
  });

  await writeAuditLog('DEPARTMENT_UPDATED', { desc: `Updated department ${updated.name} (${updated.level})` });

  return updated;
}

export async function deleteDepartment(departmentId: string) {
  const dept = await prisma.department.findUnique({
    where: { id: departmentId },
  });
  if (!dept) throw new Error("Department not found");

  if (dept.level === 'JHS' || dept.level === 'SHS') {
    throw new Error("Core school divisions (JHS and SHS) cannot be deleted.");
  }

  // Set departmentId to null for linked templates and users before deleting
  await prisma.template.updateMany({
    where: { departmentId },
    data: { departmentId: null }
  });

  await prisma.user.updateMany({
    where: { departmentId },
    data: { departmentId: null }
  });

  await prisma.department.delete({
    where: { id: departmentId },
  });

  await writeAuditLog('DEPARTMENT_DELETED', { desc: `Deleted department ${dept.name} (${dept.level})` });

  return { success: true };
}


