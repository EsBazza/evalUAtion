'use server';

import { EducationLevel, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, requireAdmin, requireProfessorAccess, requireStaff, scopeDepartmentId } from '@/lib/authz';
import { readSystemSettings } from '@/lib/settings';
import { getOrComputeScoreCache } from '@/lib/scoring';

/** The signed-in admin/sub admin for the admin console (safe fields only, no password hash). */
export async function getAdminSessionUser() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) return null;

  const department = user.departmentId
    ? await prisma.department.findUnique({ where: { id: user.departmentId } })
    : null;

  return {
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
    department,
  };
}

export async function getDepartments() {
  const user = await requireStaff();
  return prisma.department.findMany({
    // Sub admins only ever see their own department
    where: user.role === 'SUB_ADMIN' ? { id: user.departmentId! } : undefined,
    include: {
      sections: true,
      subjects: true,
      professors: true,
    },
  });
}

export async function createDepartment(name: string, level: EducationLevel) {
  await requireAdmin();
  if (!name?.trim()) throw new Error("Department name cannot be empty");
  return prisma.department.create({
    data: { name: name.trim(), level },
  });
}

export async function getTemplates() {
  await requireAdmin();
  return prisma.template.findMany({
    include: {
      department: true,
      clusters: {
        include: {
          criteria: { orderBy: { order: 'asc' } },
        },
        orderBy: { order: 'asc' },
      },
    },
  });
}

export async function createTemplate(title: string, level: EducationLevel, departmentId?: string) {
  await requireAdmin();
  if (!title?.trim()) throw new Error("Template title is required");
  return prisma.template.create({
    data: {
      title: title.trim(),
      level,
      departmentId: departmentId || null,
    },
  });
}

export async function getFacultyRankings(academicYear?: string, semester?: string, departmentId?: string) {
  const user = await requireStaff();
  departmentId = scopeDepartmentId(user, departmentId);

  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await readSystemSettings();
    termYear = settings.academicYear;
    termSem = settings.semester;
  }

  // Fetch professors (optionally filtered by department) and score caches in one shot
  const [professors, scoreCaches] = await Promise.all([
    prisma.professor.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        department: true,
        sections: true,
        teachingAssignments: {
          include: {
            subject: true,
            section: true,
          }
        }
      },
    }),
    prisma.scoreCache.findMany({
      where: {
        academicYear: termYear,
        semester: termSem,
      },
    }),
  ]);

  // Build a quick lookup map: professorId -> cache
  const cacheMap = new Map(scoreCaches.map(c => [c.professorId, c]));

  const rankings = professors.map(prof => ({
    id: prof.id,
    name: prof.name,
    email: prof.email,
    department: prof.department.name,
    level: prof.department.level,
    sections: prof.sections.map(s => s.name).join(', '),
    averageScore: cacheMap.get(prof.id)?.compositeScore ?? null,
    teachingAssignments: prof.teachingAssignments.map(ta => ({
      subjectId: ta.subjectId,
      subjectName: ta.subject.name,
      subjectCode: ta.subject.code,
      sectionId: ta.sectionId,
      sectionName: ta.section.name,
    }))
  }));

  return rankings;
}

export async function recalculateStaleScoreCaches(academicYear?: string, semester?: string) {
  const user = await requireStaff();
  const departmentId = scopeDepartmentId(user);

  let termYear = academicYear;
  let termSem = semester;

  if (!termYear || !termSem) {
    const settings = await readSystemSettings();
    termYear = settings.academicYear;
    termSem = settings.semester;
  }

  const [professors, scoreCaches] = await Promise.all([
    prisma.professor.findMany({ where: departmentId ? { departmentId } : undefined }),
    prisma.scoreCache.findMany({
      where: {
        academicYear: termYear,
        semester: termSem,
      },
    }),
  ]);

  const cacheMap = new Map(scoreCaches.map(c => [c.professorId, c]));

  const staleProfIds = professors
    .filter(prof => {
      const cache = cacheMap.get(prof.id);
      return !cache || cache.isStale;
    })
    .map(p => p.id);

  let updatedCount = 0;
  const BATCH_SIZE = 3;

  for (let i = 0; i < staleProfIds.length; i += BATCH_SIZE) {
    const batch = staleProfIds.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (profId) => {
        try {
          const hasAnswers = await prisma.answer.count({
            where: {
              evaluation: {
                professorId: profId,
                academicYear: termYear,
                semester: termSem,
              },
            },
          });
          if (hasAnswers === 0) return;

          await getOrComputeScoreCache(profId, termYear, termSem);
          updatedCount++;
        } catch (err) {
          console.error(`Error computing score cache for professor ${profId}:`, err);
        }
      })
    );
  }

  return { updatedCount, totalStaleChecked: staleProfIds.length };
}


export async function getFacultyFeedback(professorId: string, academicYear?: string, semester?: string) {
  await requireProfessorAccess(professorId);

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



export interface AttendanceLogFilters {
  search?: string;
  departments?: string[];
  sections?: string[];
  academicYears?: string[];
  semesters?: string[];
  page: number;
  pageSize: number;
}

export async function getEvaluationAttendanceLogs(filters: AttendanceLogFilters) {
  await requireAdmin();
  filters = { ...filters, page: Math.max(1, Math.floor(filters.page) || 1), pageSize: Math.min(500, Math.max(1, Math.floor(filters.pageSize) || 25)) };
  const offset = (filters.page - 1) * filters.pageSize;
  const conditions: Prisma.Sql[] = [];

  if (filters.search?.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    conditions.push(Prisma.sql`(lr."studentEmail" ILIKE ${searchPattern} OR u."name" ILIKE ${searchPattern})`);
  }
  if (filters.departments && filters.departments.length > 0) {
    conditions.push(Prisma.sql`s."departmentId" IN (${Prisma.join(filters.departments)})`);
  }
  if (filters.sections && filters.sections.length > 0) {
    conditions.push(Prisma.sql`lr."sectionId" IN (${Prisma.join(filters.sections)})`);
  }
  if (filters.academicYears && filters.academicYears.length > 0) {
    conditions.push(Prisma.sql`lr."academicYear" IN (${Prisma.join(filters.academicYears)})`);
  }
  if (filters.semesters && filters.semesters.length > 0) {
    conditions.push(Prisma.sql`lr."semester" IN (${Prisma.join(filters.semesters)})`);
  }

  const whereClause = conditions.length > 0 
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` 
    : Prisma.empty;

  const logs = await prisma.$queryRaw<any[]>`
    WITH first_submissions AS (
      SELECT "studentEmail", MIN("createdAt") AS "firstSubmitted"
      FROM "EvaluationReceipt"
      GROUP BY "studentEmail"
    ),
    latest_receipts AS (
      SELECT DISTINCT ON ("studentEmail")
        id,
        "studentEmail",
        "sectionId",
        "academicYear",
        "semester",
        "createdAt" AS "mostRecentSubmitted"
      FROM "EvaluationReceipt" er
      WHERE 
        (
          SELECT COUNT(*) 
          FROM "EvaluationReceipt" er2 
          WHERE er2."studentEmail" = er."studentEmail" 
            AND er2."sectionId" = er."sectionId" 
            AND er2."academicYear" = er."academicYear" 
            AND er2."semester" = er."semester"
        ) = (
          SELECT COUNT(*) 
          FROM "_SectionToProfessor" sp 
          WHERE sp."B" = er."sectionId"
        )
        AND (
          SELECT COUNT(*) 
          FROM "_SectionToProfessor" sp 
          WHERE sp."B" = er."sectionId"
        ) > 0
      ORDER BY "studentEmail", "createdAt" DESC, id DESC
    )
    SELECT 
      lr.id,
      lr."studentEmail",
      lr."sectionId",
      lr."academicYear",
      lr."semester",
      lr."mostRecentSubmitted",
      fs."firstSubmitted",
      u.name AS "studentName",
      s.name AS "sectionName",
      d.name AS "departmentName",
      d.level AS "level"
    FROM latest_receipts lr
    JOIN first_submissions fs ON lr."studentEmail" = fs."studentEmail"
    LEFT JOIN "User" u ON lr."studentEmail" = u.email
    LEFT JOIN "Section" s ON lr."sectionId" = s.id
    LEFT JOIN "Department" d ON s."departmentId" = d.id
    ${whereClause}
    ORDER BY lr."mostRecentSubmitted" DESC, lr.id DESC
    LIMIT ${filters.pageSize} OFFSET ${offset};
  `;

  const countQuery = await prisma.$queryRaw<any[]>`
    WITH latest_receipts AS (
      SELECT DISTINCT ON ("studentEmail")
        "studentEmail",
        "sectionId",
        "academicYear",
        "semester"
      FROM "EvaluationReceipt" er
      WHERE 
        (
          SELECT COUNT(*) 
          FROM "EvaluationReceipt" er2 
          WHERE er2."studentEmail" = er."studentEmail" 
            AND er2."sectionId" = er."sectionId" 
            AND er2."academicYear" = er."academicYear" 
            AND er2."semester" = er."semester"
        ) = (
          SELECT COUNT(*) 
          FROM "_SectionToProfessor" sp 
          WHERE sp."B" = er."sectionId"
        )
        AND (
          SELECT COUNT(*) 
          FROM "_SectionToProfessor" sp 
          WHERE sp."B" = er."sectionId"
        ) > 0
    )
    SELECT COUNT(*)::integer AS count
    FROM latest_receipts lr
    LEFT JOIN "User" u ON lr."studentEmail" = u.email
    LEFT JOIN "Section" s ON lr."sectionId" = s.id
    LEFT JOIN "Department" d ON s."departmentId" = d.id
    ${whereClause};
  `;

  const totalCount = countQuery[0]?.count || 0;

  return {
    logs,
    totalCount,
    totalPages: Math.ceil(totalCount / filters.pageSize)
  };
}

export async function getEvaluationAttendanceLogsForExport(filters: Omit<AttendanceLogFilters, 'page' | 'pageSize'>) {
  await requireAdmin();
  const conditions: Prisma.Sql[] = [];

  if (filters.search?.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    conditions.push(Prisma.sql`(lr."studentEmail" ILIKE ${searchPattern} OR u."name" ILIKE ${searchPattern})`);
  }
  if (filters.departments && filters.departments.length > 0) {
    conditions.push(Prisma.sql`s."departmentId" IN (${Prisma.join(filters.departments)})`);
  }
  if (filters.sections && filters.sections.length > 0) {
    conditions.push(Prisma.sql`lr."sectionId" IN (${Prisma.join(filters.sections)})`);
  }
  if (filters.academicYears && filters.academicYears.length > 0) {
    conditions.push(Prisma.sql`lr."academicYear" IN (${Prisma.join(filters.academicYears)})`);
  }
  if (filters.semesters && filters.semesters.length > 0) {
    conditions.push(Prisma.sql`lr."semester" IN (${Prisma.join(filters.semesters)})`);
  }

  const whereClause = conditions.length > 0 
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` 
    : Prisma.empty;

  return prisma.$queryRaw<any[]>`
    WITH first_submissions AS (
      SELECT "studentEmail", MIN("createdAt") AS "firstSubmitted"
      FROM "EvaluationReceipt"
      GROUP BY "studentEmail"
    ),
    latest_receipts AS (
      SELECT DISTINCT ON ("studentEmail")
        id,
        "studentEmail",
        "sectionId",
        "academicYear",
        "semester",
        "createdAt" AS "mostRecentSubmitted"
      FROM "EvaluationReceipt" er
      WHERE 
        (
          SELECT COUNT(*) 
          FROM "EvaluationReceipt" er2 
          WHERE er2."studentEmail" = er."studentEmail" 
            AND er2."sectionId" = er."sectionId" 
            AND er2."academicYear" = er."academicYear" 
            AND er2."semester" = er."semester"
        ) = (
          SELECT COUNT(*) 
          FROM "_SectionToProfessor" sp 
          WHERE sp."B" = er."sectionId"
        )
        AND (
          SELECT COUNT(*) 
          FROM "_SectionToProfessor" sp 
          WHERE sp."B" = er."sectionId"
        ) > 0
      ORDER BY "studentEmail", "createdAt" DESC, id DESC
    )
    SELECT 
      lr.id,
      lr."studentEmail",
      lr."sectionId",
      lr."academicYear",
      lr."semester",
      lr."mostRecentSubmitted",
      fs."firstSubmitted",
      u.name AS "studentName",
      s.name AS "sectionName",
      d.name AS "departmentName",
      d.level AS "level"
    FROM latest_receipts lr
    JOIN first_submissions fs ON lr."studentEmail" = fs."studentEmail"
    LEFT JOIN "User" u ON lr."studentEmail" = u.email
    LEFT JOIN "Section" s ON lr."sectionId" = s.id
    LEFT JOIN "Department" d ON s."departmentId" = d.id
    ${whereClause}
    ORDER BY lr."mostRecentSubmitted" DESC, lr.id DESC;
  `;
}

export async function getEvaluationReceiptFilters() {
  await requireAdmin();
  const years = await prisma.evaluationReceipt.findMany({
    select: { academicYear: true },
    distinct: ['academicYear']
  });
  
  const semesters = await prisma.evaluationReceipt.findMany({
    select: { semester: true },
    distinct: ['semester']
  });

  return {
    academicYears: years.map(y => y.academicYear).filter(Boolean),
    semesters: semesters.map(s => s.semester).filter(Boolean)
  };
}

