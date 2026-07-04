'use server';

import { EducationLevel } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function getDepartments(level: EducationLevel) {
  return prisma.department.findMany({
    where: { level },
  });
}

export async function getSections(departmentId: string) {
  return prisma.section.findMany({
    where: { departmentId },
  });
}

export async function getProfessorsBySection(sectionId: string) {
  return prisma.professor.findMany({
    where: {
      sections: {
        some: {
          id: sectionId,
        },
      },
    },
  });
}

export async function getEvaluationTemplate(level: EducationLevel, departmentId?: string) {
  // 1. Try to find a template specific to the department
  let temp = await prisma.template.findFirst({
    where: {
      level,
      isActive: true,
      departmentId: departmentId || undefined,
    },
    include: {
      clusters: {
        include: {
          criteria: true,
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  });

  // 2. Fall back to the global template (where departmentId is null) if no specific override exists
  if (!temp && departmentId) {
    temp = await prisma.template.findFirst({
      where: {
        level,
        isActive: true,
        departmentId: null,
      },
      include: {
        clusters: {
          include: {
            criteria: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  return temp;
}

import { createHash } from 'crypto';

export async function submitProfessorEvaluation(data: {
  studentEmail: string;
  sectionId: string;
  professorId: string;
  departmentId: string;
  templateId: string;
  answers: {
    criterionId: string;
    score?: number;
    textVal?: string;
    jsonVal?: any;
  }[];
}) {
  // Get active system term settings
  const settings = await prisma.systemSetting.findUnique({ where: { id: 'active' } });
  const termYear = settings?.academicYear || "2026-2027";
  const termSem = settings?.semester || "1st";

  return prisma.$transaction(async (tx) => {
    // 1. Check if receipt already exists to prevent duplicate submissions
    const existingReceipt = await tx.evaluationReceipt.findUnique({
      where: {
        studentEmail_professorId_sectionId_academicYear_semester: {
          studentEmail: data.studentEmail,
          professorId: data.professorId,
          sectionId: data.sectionId,
          academicYear: termYear,
          semester: termSem
        }
      }
    });

    if (existingReceipt) {
      throw new Error("You have already evaluated this professor for this section in the current term.");
    }

    // 2. Create the Evaluation Receipt (attendance tracking)
    await tx.evaluationReceipt.create({
      data: {
        studentEmail: data.studentEmail,
        professorId: data.professorId,
        sectionId: data.sectionId,
        academicYear: termYear,
        semester: termSem
      }
    });

    // 3. Create the Evaluation response (completely anonymous payload)
    return tx.evaluation.create({
      data: {
        sectionId: data.sectionId,
        professorId: data.professorId,
        departmentId: data.departmentId,
        templateId: data.templateId,
        academicYear: termYear,
        semester: termSem,
        answers: {
          create: data.answers.map(ans => ({
            criterionId: ans.criterionId,
            score: ans.score,
            textVal: ans.textVal,
            jsonVal: ans.jsonVal
          }))
        }
      }
    });
  });
}
