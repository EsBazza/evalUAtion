import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveRole,
  canAccessDepartment,
  canAccessProfessor,
  scopeDepartmentId,
  type CurrentUser,
} from '../lib/authz-rules.ts';

const admin: CurrentUser = { email: 'admin@ua.edu.ph', name: 'A', role: 'ADMIN', departmentId: null };
const subCit: CurrentUser = { email: 'sub@ua.edu.ph', name: 'S', role: 'SUB_ADMIN', departmentId: 'cit' };
const faculty: CurrentUser = { email: 'jane.doe@ua.edu.ph', name: 'J', role: 'FACULTY', departmentId: null };
const student: CurrentUser = { email: 'juan.student@ua.edu.ph', name: 'S', role: 'STUDENT', departmentId: null };

const citProf = { email: 'jane.doe@ua.edu.ph', departmentId: 'cit' };
const ceaProf = { email: 'alan@ua.edu.ph', departmentId: 'cea' };

test('admin roles come from the database, not the token', () => {
  assert.deepEqual(resolveRole('x@gmail.com', { role: 'ADMIN', departmentId: null }), { role: 'ADMIN', departmentId: null });
  assert.deepEqual(resolveRole('sub@ua.edu.ph', { role: 'SUB_ADMIN', departmentId: 'cit' }), { role: 'SUB_ADMIN', departmentId: 'cit' });
});

test('a revoked admin loses admin access immediately', () => {
  // No DB record any more: falls back to the email-based role
  assert.deepEqual(resolveRole('old.admin@ua.edu.ph', null), { role: 'FACULTY', departmentId: null });
  // Non-university credentials admin with no DB record gets nothing
  assert.equal(resolveRole('someone@gmail.com', null), null);
});

test('sub admin without a department gets no access', () => {
  assert.equal(resolveRole('sub@ua.edu.ph', { role: 'SUB_ADMIN', departmentId: null }), null);
});

test('students and faculty are recognised by email', () => {
  assert.equal(resolveRole('Juan.Student@UA.EDU.PH', null)?.role, 'STUDENT');
  assert.equal(resolveRole('prof@ua.edu.ph', null)?.role, 'FACULTY');
  assert.equal(resolveRole('prof@ua.edu.ph', { role: 'FACULTY', departmentId: null })?.role, 'FACULTY');
});

test('department access', () => {
  assert.equal(canAccessDepartment(admin, 'cea'), true);
  assert.equal(canAccessDepartment(subCit, 'cit'), true);
  assert.equal(canAccessDepartment(subCit, 'cea'), false);
  assert.equal(canAccessDepartment(subCit, undefined), false);
  assert.equal(canAccessDepartment(faculty, 'cit'), false);
  assert.equal(canAccessDepartment(student, 'cit'), false);
});

test('professor access', () => {
  assert.equal(canAccessProfessor(admin, ceaProf), true);
  assert.equal(canAccessProfessor(subCit, citProf), true);
  assert.equal(canAccessProfessor(subCit, ceaProf), false);
  assert.equal(canAccessProfessor(faculty, citProf), true, 'faculty can see themselves');
  assert.equal(canAccessProfessor({ ...faculty, email: 'JANE.DOE@ua.edu.ph' }, citProf), true, 'email match is case-insensitive');
  assert.equal(canAccessProfessor(faculty, ceaProf), false, 'faculty cannot see colleagues');
  assert.equal(canAccessProfessor(student, citProf), false);
});

test('sub admins are pinned to their department whatever they request', () => {
  assert.equal(scopeDepartmentId(subCit, 'cea'), 'cit');
  assert.equal(scopeDepartmentId(subCit, undefined), 'cit');
  assert.equal(scopeDepartmentId(admin, 'cea'), 'cea');
  assert.equal(scopeDepartmentId(admin, ''), undefined);
});
