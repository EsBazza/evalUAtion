import { prisma } from '@/lib/prisma';
import { buildUniqueSectionCode } from '@/lib/codegen';

/** Server-only: the active term settings, created with defaults on first use. */
export async function readSystemSettings() {
  return prisma.systemSetting.upsert({
    where: { id: 'active' },
    update: {},
    create: { id: 'active', academicYear: '2026-2027', semester: '1st', isFacultyPageEnabled: true },
  });
}

async function existingSectionCodes(): Promise<Set<string>> {
  const rows = await prisma.section.findMany({ where: { code: { not: null } }, select: { code: true } });
  return new Set(rows.map(r => r.code!.toUpperCase()));
}

/** Server-only: a fresh unique code for one new section. */
export async function newSectionCode(level: Parameters<typeof buildUniqueSectionCode>[0], deptName: string, academicYear: string, semester: string) {
  return buildUniqueSectionCode(level, deptName, academicYear, semester, await existingSectionCodes());
}

/**
 * Server-only: give every section a new code for the given term. Runs in one
 * transaction so a failure can't leave a mix of old and new codes.
 */
export async function regenerateAllSectionCodes(academicYear: string, semester: string) {
  const sections = await prisma.section.findMany({ include: { department: true } });
  const taken = new Set<string>();
  const updates = sections.map(sec => ({
    id: sec.id,
    code: buildUniqueSectionCode(sec.department.level, sec.department.name, academicYear, semester, taken),
  }));

  await prisma.$transaction(
    updates.map(u => prisma.section.update({ where: { id: u.id }, data: { code: u.code } }))
  );
  return updates.length;
}

/** Server-only repair utility: fill in missing section codes. */
export async function healMissingSectionCodes() {
  const sections = await prisma.section.findMany({ where: { code: null }, include: { department: true } });
  if (sections.length === 0) return { healed: 0 };

  const { academicYear, semester } = await readSystemSettings();
  const taken = await existingSectionCodes();
  await prisma.$transaction(
    sections.map(sec =>
      prisma.section.update({
        where: { id: sec.id },
        data: { code: buildUniqueSectionCode(sec.department.level, sec.department.name, academicYear, semester, taken) },
      })
    )
  );
  return { healed: sections.length };
}
