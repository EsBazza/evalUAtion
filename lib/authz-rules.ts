// Pure authorization rules — no database or session access, so they can be unit tested.

export type AppRole = 'STUDENT' | 'FACULTY' | 'ADMIN' | 'SUB_ADMIN';

export interface CurrentUser {
  email: string;
  name: string | null;
  role: AppRole;
  departmentId: string | null;
}

export class AuthorizationError extends Error {
  constructor(message = 'You are not allowed to perform this action.') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

const UNIVERSITY_DOMAIN = '@ua.edu.ph';
const STUDENT_DOMAIN = '.student@ua.edu.ph';

/**
 * Decide a user's effective role from the database, not the (possibly stale) JWT.
 * - Admin roles only count while the DB record still says so, so revoking an
 *   admin takes effect immediately instead of when their session expires.
 * - Students and faculty are recognised by their university email, the same
 *   rule the sign-in callback uses.
 */
export function resolveRole(
  email: string,
  dbUser: { role: AppRole; departmentId: string | null } | null
): { role: AppRole; departmentId: string | null } | null {
  const lower = email.toLowerCase();

  if (dbUser && (dbUser.role === 'ADMIN' || dbUser.role === 'SUB_ADMIN')) {
    if (dbUser.role === 'SUB_ADMIN' && !dbUser.departmentId) return null; // misconfigured sub admin gets nothing
    return { role: dbUser.role, departmentId: dbUser.departmentId };
  }
  if (lower.endsWith(STUDENT_DOMAIN)) {
    return { role: 'STUDENT', departmentId: null };
  }
  if (lower.endsWith(UNIVERSITY_DOMAIN)) {
    return { role: dbUser?.role === 'STUDENT' ? 'STUDENT' : 'FACULTY', departmentId: dbUser?.departmentId ?? null };
  }
  return null;
}

export function hasRole(user: CurrentUser | null, roles: AppRole[]): user is CurrentUser {
  return !!user && roles.includes(user.role);
}

/** ADMIN: any department. SUB_ADMIN: only their own. Everyone else: none. */
export function canAccessDepartment(user: CurrentUser, departmentId: string | null | undefined): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'SUB_ADMIN') return !!departmentId && departmentId === user.departmentId;
  return false;
}

/** ADMIN: anyone. SUB_ADMIN: faculty in their department. FACULTY: only themselves. */
export function canAccessProfessor(
  user: CurrentUser,
  professor: { email: string; departmentId: string }
): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'SUB_ADMIN') return canAccessDepartment(user, professor.departmentId);
  if (user.role === 'FACULTY') return professor.email.toLowerCase() === user.email.toLowerCase();
  return false;
}

/** Sub admins are always pinned to their own department, whatever the client asked for. */
export function scopeDepartmentId(user: CurrentUser, requested?: string | null): string | undefined {
  if (user.role === 'SUB_ADMIN') return user.departmentId ?? undefined;
  return requested || undefined;
}
