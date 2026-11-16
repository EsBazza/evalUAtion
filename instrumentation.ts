// Runs once when the Next.js server starts. Fails fast on missing secrets
// instead of letting the app run half-configured (e.g. audit logs with no key).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set');
  if (!process.env.AUTH_SECRET) problems.push('AUTH_SECRET is not set');
  if (!/^[0-9a-fA-F]{64}$/.test(process.env.AUDIT_LOG_KEY?.trim() || '')) {
    problems.push('AUDIT_LOG_KEY must be 64 hex characters (generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")');
  }

  if (problems.length > 0) {
    throw new Error(`Server configuration error:\n - ${problems.join('\n - ')}`);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set: AI summaries and template import will be unavailable.');
  }
}
