'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function getSystemSettings() {
  const settings = await prisma.systemSetting.findUnique({
    where: { id: 'active' }
  });

  if (!settings) {
    return prisma.systemSetting.create({
      data: {
        id: 'active',
        academicYear: '2026-2027',
        semester: '1st'
      }
    });
  }

  return settings;
}

export async function updateSystemSettings(academicYear: string, semester: string) {
  if (!academicYear.trim() || !semester.trim()) {
    throw new Error("Academic Year and Semester cannot be empty");
  }

  return prisma.systemSetting.upsert({
    where: { id: 'active' },
    update: { academicYear, semester },
    create: { id: 'active', academicYear, semester }
  });
}

export async function getAdmins() {
  return prisma.user.findMany({
    where: { role: 'ADMIN' },
    orderBy: { email: 'asc' }
  });
}

export async function elevateUserToAdmin(email: string, username?: string, password?: string) {
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

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { 
        role: 'ADMIN',
        username: cleanUsername || existing.username,
        password: hashedPassword || existing.password
      }
    });
  }

  // Create placeholder user
  return prisma.user.create({
    data: {
      email: cleanEmail,
      role: 'ADMIN',
      name: email.split('@')[0], // placeholder name
      username: cleanUsername,
      password: hashedPassword
    }
  });
}

export async function revokeAdminAction(userId: string) {
  // Prevent deleting all admins (optional safety check)
  const adminCount = await prisma.user.count({
    where: { role: 'ADMIN' }
  });

  if (adminCount <= 1) {
    throw new Error("Cannot revoke privileges. There must be at least one System Administrator.");
  }

  // Demote to FACULTY (safest default role)
  return prisma.user.update({
    where: { id: userId },
    data: { role: 'FACULTY' }
  });
}
