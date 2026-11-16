'use server';

import { randomUUID } from 'crypto';
import { EducationLevel, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole, requireUser } from '@/lib/authz';
import { readSystemSettings } from '@/lib/settings';
import {
  anonymizedEvaluationDate,
  submissionSchema,
  validateAnswers,
  type CriterionRule,
} from '@/lib/evaluation-validation';

const TEMPLATE_INCLUDE = {
  clusters: {
    include: { criteria: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  },
} satisfies Prisma.TemplateInclude;

/** Department override first, then the level-wide (global) template. */
async function findActiveTemplate(level: EducationLevel, departmentId?: string | null) {
  if (departmentId) {
    const override = await prisma.template.findFirst({
      where: { level, isActive: true, departmentId },
      include: TEMPLATE_INCLUDE,
    });
    if (override) return override;
  }
  return prisma.template.findFirst({
    where: { level, isActive: true, departmentId: null },
    include: TEMPLATE_INCLUDE,
  });
}

export async function getDepartments(level: EducationLevel) {
  await requireUser();
  return prisma.department.findMany({ where: { level } });
}

export async function getSections(departmentId: string) {
  await requireUser();
  return prisma.section.findMany({
    where: { departmentId },
    // Never send access codes in a list: they are what lets a student into a section
    select: { id: true, name: true, departmentId: true },
  });
}

export async function getProfessorsBySection(sectionId: string) {
  await requireUser();
  return prisma.professor.findMany({
    where: { sections: { some: { id: sectionId } } },
  });
}

export async function getEvaluationTemplate(level: EducationLevel, departmentId?: string) {
  await requireUser();
  return findActiveTemplate(level, departmentId);
}

/** Professors the signed-in student has already evaluated in this section this term. */
export async function getCompletedEvaluations(sectionId: string) {
  const student = await requireRole('STUDENT');
  const { academicYear, semester } = await readSystemSettings();

  const receipts = await prisma.evaluationReceipt.findMany({
    where: { studentEmail: student.email, sectionId, academicYear, semester },
    select: { professorId: true },
  });
  return receipts.map(r => r.professorId);
}

export async function submitProfessorEvaluation(input: unknown) {
  let student;
  try {
    student = await requireRole('STUDENT');
  } catch {
    return { success: false, error: 'Only signed-in students can submit evaluations.' };
  }

  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Your submission was incomplete or invalid. Please review your answers.' };
  }
  const { sectionId, professorId, answers } = parsed.data;

  try {
    const { academicYear, semester } = await readSystemSettings();

    // The professor must actually be assigned to this section
    const section = await prisma.section.findFirst({
      where: { id: sectionId, professors: { some: { id: professorId } } },
      include: { department: true },
    });
    if (!section) {
      return { success: false, error: 'This professor is not assigned to your section.' };
    }

    // The server picks the template; the client can't choose a different one
    const template = await findActiveTemplate(section.department.level, section.departmentId);
    if (!template) {
      return { success: false, error: 'There is no active evaluation form for your department.' };
    }

    const criteria: CriterionRule[] = template.clusters.flatMap(c =>
      c.criteria.map(q => ({ id: q.id, type: q.type, options: q.options }))
    );
    const checked = validateAnswers(criteria, answers);
    if (!checked.ok) return { success: false, error: checked.error };

    await prisma.$transaction(async (tx) => {
      // Keep the student's display name for the attendance log
      await tx.user.upsert({
        where: { email: student.email },
        update: student.name ? { name: student.name } : {},
        create: { email: student.email, name: student.name, role: 'STUDENT' },
      });

      // Attendance receipt (who submitted). The unique constraint blocks duplicates, even under races.
      await tx.evaluationReceipt.create({
        data: { studentEmail: student.email, professorId, sectionId, academicYear, semester },
      });

      await tx.scoreCache.upsert({
        where: { professorId_academicYear_semester: { professorId, academicYear, semester } },
        update: { isStale: true },
        create: { professorId, academicYear, semester, isStale: true },
      });

      // The anonymous evaluation (what was said). Random ids and a day-only date mean it
      // can't be matched back to the receipt above by id order or timestamp.
      await tx.evaluation.create({
        data: {
          id: randomUUID(),
          createdAt: anonymizedEvaluationDate(),
          sectionId,
          professorId,
          departmentId: section.departmentId,
          templateId: template.id,
          academicYear,
          semester,
          answers: {
            create: checked.answers.map(ans => ({
              id: randomUUID(),
              criterionId: ans.criterionId,
              score: ans.score,
              textVal: ans.textVal,
              jsonVal: ans.jsonVal,
            })),
          },
        },
      });
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { success: false, error: 'You have already evaluated this professor for this section in the current term.' };
    }
    console.error('Error submitting evaluation:', error);
    return { success: false, error: 'Failed to submit evaluation due to an internal error. Please try again.' };
  }
}

export async function getSectionByCode(code: string) {
  await requireUser();
  const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!cleanCode || cleanCode.length > 64) return null;

  return prisma.section.findFirst({
    where: { code: { equals: cleanCode, mode: 'insensitive' } },
    include: { department: true },
  });
}
