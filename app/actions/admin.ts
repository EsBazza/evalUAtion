'use server';

import { EducationLevel, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function getDepartments() {
  return prisma.department.findMany({
    include: {
      sections: true,
      professors: true,
    },
  });
}

export async function createDepartment(name: string, level: EducationLevel) {
  return prisma.department.create({
    data: { name, level },
  });
}

export async function getTemplates() {
  return prisma.template.findMany({
    include: {
      department: true,
      clusters: {
        include: {
          criteria: true,
        },
      },
    },
  });
}

export async function createTemplate(title: string, level: EducationLevel, departmentId?: string) {
  return prisma.template.create({
    data: {
      title,
      level,
      departmentId: departmentId || null,
    },
  });
}

export async function getUsers() {
  return prisma.user.findMany({
    include: {
      department: true,
    },
  });
}

export async function createUser(email: string, name: string, role: Role, departmentId?: string) {
  return prisma.user.create({
    data: {
      email,
      name,
      role,
      departmentId: departmentId || null,
    },
  });
}

import { getOrComputeScoreCache } from './ai';
import { getSystemSettings } from './settings';


export async function getFacultyRankings(academicYear?: string, semester?: string) {
  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await getSystemSettings();
    termYear = settings.academicYear;
    termSem = settings.semester;
  }

  const professors = await prisma.professor.findMany({
    include: {
      department: true,
      sections: true,
    },
  });

  const rankings = [];
  for (const prof of professors) {
    const cache = await getOrComputeScoreCache(prof.id, termYear, termSem);
    rankings.push({
      id: prof.id,
      name: prof.name,
      email: prof.email,
      department: prof.department.name,
      level: prof.department.level,
      sections: prof.sections.map(s => s.name).join(', '),
      averageScore: cache?.compositeScore ?? null,
    });
  }

  return rankings;
}

export async function getFacultyFeedback(professorId: string, academicYear?: string, semester?: string) {
  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await prisma.systemSetting.findUnique({ where: { id: 'active' } });
    termYear = settings?.academicYear || "2026-2027";
    termSem = settings?.semester || "1st";
  }

  const answers = await prisma.answer.findMany({
    where: {
      evaluation: {
        professorId,
        academicYear: termYear,
        semester: termSem,
      },
      textVal: {
        not: null,
      },
      criterion: {
        type: 'TEXT_LONG',
      },
    },
    include: {
      criterion: true,
      evaluation: {
        include: {
          section: true,
        },
      },
    },
    orderBy: {
      evaluation: {
        createdAt: 'desc',
      },
    },
  });

  return answers.map(a => ({
    id: a.id,
    question: a.criterion.question,
    feedback: a.textVal || '',
    section: a.evaluation.section.name,
    date: a.evaluation.createdAt.toISOString(),
  }));
}


export async function getEvaluationReceipts() {
  const receipts = await prisma.evaluationReceipt.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  const professors = await prisma.professor.findMany({ select: { id: true, name: true } });
  const sections = await prisma.section.findMany({
    select: {
      id: true,
      name: true,
      department: {
        select: {
          name: true,
          level: true
        }
      }
    }
  });
  
  const profMap = new Map(professors.map(p => [p.id, p.name]));
  const secMap = new Map(sections.map(s => [s.id, s]));
  
  return receipts.map(r => {
    const sec = secMap.get(r.sectionId);
    return {
      ...r,
      professorName: profMap.get(r.professorId) || 'Unknown Professor',
      sectionName: sec ? sec.name : 'Unknown Section',
      departmentName: sec?.department ? sec.department.name : 'Unknown Department',
      level: sec?.department ? sec.department.level : 'Unknown Level'
    };
  });
}
