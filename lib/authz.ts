import { cache } from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  AuthorizationError,
  canAccessDepartment,
  canAccessProfessor,
  hasRole,
  resolveRole,
  type AppRole,
  type CurrentUser,
} from '@/lib/authz-rules';

export { AuthorizationError, scopeDepartmentId } from '@/lib/authz-rules';
export type { AppRole, CurrentUser } from '@/lib/authz-rules';

/**
 * The signed-in user with their role re-checked against the database.
 * Cached per request, so several guards in one request cost one query.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const dbUser = await prisma.user.findUnique({
    where: { email },
    select: { role: true, departmentId: true, name: true },
  });

  const resolved = resolveRole(email, dbUser);
  if (!resolved) return null;

  return {
    email,
    name: dbUser?.name ?? session.user?.name ?? null,
    ...resolved,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError('Please sign in to continue.');
  return user;
}

export async function requireRole(...roles: AppRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!hasRole(user, roles)) throw new AuthorizationError();
  return user;
}

/** Full system administrators only. */
export const requireAdmin = () => requireRole('ADMIN');

/** Administrators and department sub admins. */
export const requireStaff = () => requireRole('ADMIN', 'SUB_ADMIN');

export async function requireDepartmentAccess(departmentId: string): Promise<CurrentUser> {
  const user = await requireStaff();
  if (!canAccessDepartment(user, departmentId)) throw new AuthorizationError();
  return user;
}

/** Admins, the professor's department sub admin, or the professor themself. */
export async function requireProfessorAccess(professorId: string): Promise<CurrentUser> {
  const user = await requireUser();
  const professor = await prisma.professor.findUnique({
    where: { id: professorId },
    select: { email: true, departmentId: true },
  });
  if (!professor || !canAccessProfessor(user, professor)) throw new AuthorizationError();
  return user;
}
