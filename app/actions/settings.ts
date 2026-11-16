'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { writeAuditLog } from '@/lib/audit';
import { requireAdmin, requireUser, requireStaff } from '@/lib/authz';
import { readSystemSettings, regenerateAllSectionCodes } from '@/lib/settings';

const MIN_PASSWORD_LENGTH = 12;

/** Term settings (needed by every signed-in role). */
export async function getSystemSettings() {
  await requireUser();
  return readSystemSettings();
}

export async function updateSystemSettings(academicYear: string, semester: string, isFacultyPageEnabled?: boolean) {
  await requireAdmin();

  academicYear = academicYear.trim();
  semester = semester.trim();
  if (!academicYear || !semester) {
    throw new Error("Academic Year and Semester cannot be empty");
  }

  const currentSettings = await prisma.systemSetting.findUnique({ where: { id: 'active' } });
  const termChanged = !currentSettings || currentSettings.academicYear !== academicYear || currentSettings.semester !== semester;

  const res = await prisma.systemSetting.upsert({
    where: { id: 'active' },
    update: {
      academicYear,
      semester,
      ...(isFacultyPageEnabled !== undefined ? { isFacultyPageEnabled } : {}),
    },
    create: { id: 'active', academicYear, semester, isFacultyPageEnabled: isFacultyPageEnabled ?? true },
  });

  // If the term changed, regenerate all section access codes for the new term (all-or-nothing)
  let codesRotated = false;
  if (termChanged) {
    try {
      await regenerateAllSectionCodes(academicYear, semester);
      codesRotated = true;
    } catch (err) {
      console.error("Failed to rotate section codes upon semester change:", err);
    }
  }

  await writeAuditLog('CONFIG_UPDATE', {
    desc: `Updated system terms to ${academicYear} ${semester} (Faculty Page: ${res.isFacultyPageEnabled ? 'Enabled' : 'Disabled'})${codesRotated ? ' - Regenerated all section access codes.' : ''}`
  });

  return res;
}

const SAFE_ADMIN_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  username: true,
  departmentId: true,
  department: true,
  createdAt: true,
} as const;

export async function getAdmins() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUB_ADMIN'] } },
    select: SAFE_ADMIN_FIELDS, // never send password hashes to the browser
    orderBy: { email: 'asc' },
  });
}

export async function elevateUserToAdmin(email: string, username?: string, password?: string, role: 'ADMIN' | 'SUB_ADMIN' = 'ADMIN', departmentId?: string) {
  await requireAdmin();

  if (role !== 'ADMIN' && role !== 'SUB_ADMIN') throw new Error("Invalid role");
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = username?.trim().toLowerCase() || null;
  if (!cleanEmail) throw new Error("Email is required");

  if (role === 'SUB_ADMIN') {
    if (!departmentId) throw new Error("A department is required for a Sub Admin");
    const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
    if (!dept) throw new Error("Department not found");
  }

  let hashedPassword = null;
  if (password) {
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    hashedPassword = await bcrypt.hash(password, 10);
  }

  if (cleanUsername) {
    const usernameTaken = await prisma.user.findUnique({ where: { username: cleanUsername } });
    if (usernameTaken && usernameTaken.email !== cleanEmail) {
      throw new Error("Username is already taken by another user");
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });

  const data = {
    role,
    departmentId: role === 'SUB_ADMIN' ? departmentId! : null,
    username: cleanUsername || existing?.username || null,
    password: hashedPassword || existing?.password || null,
  };

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data, select: SAFE_ADMIN_FIELDS })
    : await prisma.user.create({
        data: { email: cleanEmail, name: cleanEmail.split('@')[0], ...data },
        select: SAFE_ADMIN_FIELDS,
      });

  await writeAuditLog('USER_ELEVATION', { desc: `Elevated user ${cleanEmail} to ${role}` });

  return user;
}

export async function deleteAdminAction(userId: string) {
  const actor = await requireAdmin();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true }
  });

  if (!targetUser) throw new Error("User not found");
  if (targetUser.role !== 'ADMIN' && targetUser.role !== 'SUB_ADMIN') throw new Error("User is not an administrator");
  if (targetUser.email.toLowerCase() === actor.email.toLowerCase()) {
    throw new Error("You cannot delete your own administrator account.");
  }

  // Prevent deleting all admins
  if (targetUser.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      throw new Error("Cannot delete administrator. There must be at least one System Administrator.");
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  await writeAuditLog('ADMIN_REVOKE', { desc: `Deleted ${targetUser.role} ${targetUser.email}` });

  return { success: true };
}

/**
 * Lets a signed-in admin or sub admin change their own password.
 * Returns errors instead of throwing, because Next.js hides thrown messages in production.
 */
export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const actor = await requireStaff();

  if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.` };
  }
  if (newPassword.length > 72) return { success: false, error: 'New password must be at most 72 characters long.' }; // bcrypt limit

  const user = await prisma.user.findUnique({ where: { email: actor.email }, select: { id: true, password: true } });
  if (!user?.password) return { success: false, error: 'This account does not use a password login.' };

  const valid = await bcrypt.compare(typeof currentPassword === 'string' ? currentPassword : '', user.password);
  if (!valid) return { success: false, error: 'Current password is incorrect.' };

  await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(newPassword, 10) } });
  await writeAuditLog('PASSWORD_CHANGED', { desc: `Changed own password` });

  return { success: true };
}
