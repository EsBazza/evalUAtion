'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { writeAuditLog } from './audit';
import { generateCodeSegment, buildSectionCode } from '@/lib/codegen';
import { Role } from '@prisma/client';


/**
 * One-time repair utility — fills in missing section codes with formatted ones.
 * Should be called explicitly (e.g. during settings save or a dedicated admin action),
 * NOT on every settings read.
 */
export async function healMissingSectionCodes() {
  try {
    const sectionsWithNullCode = await prisma.section.findMany({
      where: { code: null },
      include: { department: true },
    });
    if (sectionsWithNullCode.length === 0) return { healed: 0 };

    const settings = await prisma.systemSetting.findUnique({ where: { id: 'active' } });
    const activeYear = settings?.academicYear || '2026-2027';
    const activeSem = settings?.semester || '1st';

    for (const sec of sectionsWithNullCode) {
      const rand = generateCodeSegment(4);
      const formatted = buildSectionCode(sec.department.level, sec.department.name, rand, activeYear, activeSem);
      await prisma.section.update({
        where: { id: sec.id },
        data: { code: formatted },
      });
    }
    return { healed: sectionsWithNullCode.length };
  } catch (err) {
    console.error('Failed to heal section codes:', err);
    return { healed: 0 };
  }
}

export async function getSystemSettings() {
  const settings = await prisma.systemSetting.findUnique({
    where: { id: 'active' }
  });

  if (!settings) {
    return prisma.systemSetting.create({
      data: {
        id: 'active',
        academicYear: '2026-2027',
        semester: '1st',
        isFacultyPageEnabled: true
      }
    });
  }

  return settings;
}

export async function updateSystemSettings(academicYear: string, semester: string, isFacultyPageEnabled?: boolean) {
  if (!academicYear.trim() || !semester.trim()) {
    throw new Error("Academic Year and Semester cannot be empty");
  }

  const currentSettings = await prisma.systemSetting.findUnique({ where: { id: 'active' } });
  const termChanged = !currentSettings || currentSettings.academicYear !== academicYear || currentSettings.semester !== semester;

  const updateData: any = { academicYear, semester };
  if (isFacultyPageEnabled !== undefined) {
    updateData.isFacultyPageEnabled = isFacultyPageEnabled;
  }

  const res = await prisma.systemSetting.upsert({
    where: { id: 'active' },
    update: updateData,
    create: { 
      id: 'active', 
      academicYear, 
      semester, 
      isFacultyPageEnabled: isFacultyPageEnabled ?? true 
    }
  });

  // If the term/semester changed, regenerate all section access codes for the new term
  if (termChanged) {
    try {
      const allSections = await prisma.section.findMany({
        include: { department: true }
      });
      for (const sec of allSections) {
        const rand = generateCodeSegment(4);
        const newCode = buildSectionCode(sec.department.level, sec.department.name, rand, academicYear, semester);
        await prisma.section.update({
          where: { id: sec.id },
          data: { code: newCode }
        });
      }
    } catch (err) {
      console.error("Failed to automatically rotate section codes upon semester change:", err);
    }
  }

  await writeAuditLog('CONFIG_UPDATE', { 
    desc: `Updated system terms to ${academicYear} ${semester} (Faculty Page: ${res.isFacultyPageEnabled ? 'Enabled' : 'Disabled'})${termChanged ? ' - Regenerated all section access codes.' : ''}` 
  });

  return res;
}

export async function getAdmins() {
  return prisma.user.findMany({
    where: { 
      role: {
        in: ['ADMIN', 'SUB_ADMIN']
      }
    },
    include: { department: true },
    orderBy: { email: 'asc' }
  });
}

export async function elevateUserToAdmin(email: string, username?: string, password?: string, role: 'ADMIN' | 'SUB_ADMIN' = 'ADMIN', departmentId?: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username?.trim().toLowerCase() || null;
  if (!cleanEmail) throw new Error("Email is required");

  let hashedPassword = null;
  if (password) {
    if (password.length < 6) throw new Error("Password must be at least 6 characters long");
    hashedPassword = await bcrypt.hash(password, 10);
  }

  // Check if username is already taken
  if (cleanUsername) {
    const usernameTaken = await prisma.user.findUnique({
      where: { username: cleanUsername }
    });
    if (usernameTaken && usernameTaken.email !== cleanEmail) {
      throw new Error("Username is already taken by another user");
    }
  }

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: cleanEmail }
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { 
          role: role as any,
          departmentId: role === 'SUB_ADMIN' ? departmentId || null : null,
          username: cleanUsername || existing.username,
          password: hashedPassword || existing.password
        }
      })
    : await prisma.user.create({
        data: {
          email: cleanEmail,
          role: role as any,
          departmentId: role === 'SUB_ADMIN' ? departmentId || null : null,
          name: email.split('@')[0], // placeholder name
          username: cleanUsername,
          password: hashedPassword
        }
      });

  await writeAuditLog('USER_ELEVATION', { desc: `Elevated user ${email} to ${role}` });

  return user;
}

export async function deleteAdminAction(userId: string) {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true }
  });

  if (!targetUser) throw new Error("User not found");

  // Prevent deleting all admins
  if (targetUser.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });

    if (adminCount <= 1) {
      throw new Error("Cannot delete administrator. There must be at least one System Administrator.");
    }
  }

  const res = await prisma.user.delete({
    where: { id: userId }
  });

  await writeAuditLog('ADMIN_REVOKE', { desc: `Deleted ${targetUser.role} ${targetUser.email}` });

  return res;
}
