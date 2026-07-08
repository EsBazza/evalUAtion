import crypto from 'crypto';

export function generateSubmissionHash(studentId: string, facultyId: string, periodId: string, secretPepper: string): string {
  const hmac = crypto.createHmac('sha256', secretPepper);
  hmac.update(`${studentId}:${facultyId}:${periodId}`);
  return hmac.digest('hex');
}
