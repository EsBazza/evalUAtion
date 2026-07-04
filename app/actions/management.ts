'use server';

import { prisma } from '@/lib/prisma';

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
  return prisma.section.create({
    data: {
      name,
      departmentId,
    },
  });
}

export async function createProfessor(name: string, email: string, departmentId: string) {
  if (!name.trim() || !email.trim()) throw new Error("Name and Email are required");
  
  // Verify email domain constraint
  if (!email.endsWith('@ua.edu.ph')) {
    throw new Error("Faculty email must use the university domain @ua.edu.ph");
  }

  // Check if professor already exists
  const existing = await prisma.professor.findUnique({ where: { email } });
  if (existing) throw new Error("A professor with this email is already registered");

  return prisma.professor.create({
    data: {
      name,
      email,
      departmentId,
    },
  });
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

  return prisma.professor.update({
    where: { id },
    data: {
      name,
      email,
      sections: {
        set: sectionIds.map(secId => ({ id: secId })),
      },
    },
  });
}
