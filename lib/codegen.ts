import { EducationLevel } from '@prisma/client';

/**
 * Generates a random alphanumeric code segment of the specified length.
 * Uses only unambiguous characters — no O/0/I/1/L to avoid read/type confusion.
 */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCodeSegment(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return result;
}

/**
 * Maps EducationLevel and Department names to standard short prefixes.
 */
export function getDeptAbbreviation(level: EducationLevel, deptName: string): string {
  const nameUpper = deptName.toUpperCase();
  
  if (level === 'JHS' || nameUpper.includes('JUNIOR HIGH')) {
    return 'JHS';
  }
  if (level === 'SHS' || nameUpper.includes('SENIOR HIGH')) {
    return 'SHS';
  }
  if (level === 'GRADUATE') return 'GRAD';

  if (nameUpper.includes('ENGINEERING') || nameUpper.includes('ARCHITECTURE') || nameUpper.includes('CEA')) {
    return 'CEA';
  }
  if (nameUpper.includes('COMPUTER') || nameUpper.includes('INFORMATION TECHNOLOGY') || nameUpper.includes('CIT')) {
    return 'CIT';
  }
  if (nameUpper.includes('EDUCATION') || nameUpper.includes('TEACHER') || nameUpper.includes('SED')) {
    return 'SED';
  }
  if (nameUpper.includes('BUSINESS') || nameUpper.includes('PUBLIC ADMINISTRATION') || nameUpper.includes('SBPA')) {
    return 'SBPA';
  }
  if (nameUpper.includes('ACCOUNTANCY') || nameUpper.includes('COA')) {
    return 'COA';
  }
  if (nameUpper.includes('NURSING') || nameUpper.includes('PHARMACY') || nameUpper.includes('CONP')) {
    return 'CONP';
  }
  if (nameUpper.includes('HOSPITALITY') || nameUpper.includes('TOURISM') || nameUpper.includes('CHTM')) {
    return 'CHTM';
  }
  if (nameUpper.includes('ARTS') || nameUpper.includes('SCIENCES') || nameUpper.includes('SAS')) {
    return 'SAS';
  }
  
  // Fallback: initials from department name words (skipping minor terms)
  const ignoreWords = ['OF', 'AND', 'THE', 'DEPARTMENT', 'DIVISION', 'SCHOOL'];
  const words = nameUpper.split(/[\s-]+/).filter(w => w && !ignoreWords.includes(w));
  if (words.length > 0) {
    const initials = words.map(w => w[0]).join('');
    if (initials.length >= 2) return initials.slice(0, 4);
  }
  
  return nameUpper.replace(/[^A-Z]/g, '').slice(0, 4) || 'COL';
}

/**
 * Normalizes academic year spans into 4 digits (e.g. "2026-2027" -> "2627").
 */
export function formatAcademicYear(year: string): string {
  const digits = year.replace(/[^0-9]/g, '');
  if (digits.length === 8) {
    return digits.slice(2, 4) + digits.slice(6, 8);
  }
  return digits.slice(-4) || '2627';
}

/**
 * Normalizes semesters into a 2-character form (e.g. "1st" -> "1S", "2nd" -> "2S", "Summer" -> "SU").
 */
export function formatSemester(semester: string): string {
  const clean = semester.toUpperCase();
  if (clean.includes('1ST') || clean.includes('1')) return '1S';
  if (clean.includes('2ND') || clean.includes('2')) return '2S';
  return 'SU';
}

/**
 * Combines elements into a unified section access code (e.g. UA-CIT-ABCD-1S2627).
 */
export function buildSectionCode(
  level: EducationLevel,
  deptName: string,
  randomPart: string,
  academicYear: string,
  semester: string
): string {
  const dept = getDeptAbbreviation(level, deptName);
  const year = formatAcademicYear(academicYear);
  const sem = formatSemester(semester);
  return `UA-${dept}-${randomPart}-${sem}${year}`;
}
