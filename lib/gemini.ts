import { GoogleGenAI } from '@google/genai';

// Use the lightweight model for all AI evaluation work
export const GEMINI_MODEL = 'gemini-3.1-flash-lite';

let client: GoogleGenAI | null = null;

/**
 * Created on first use, so a missing GEMINI_API_KEY only breaks the AI features
 * instead of every module that imports this file.
 */
export function getGemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY?.replace(/"/g, '').trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** Google's "busy/overloaded" style errors, which usually clear within seconds. */
function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b(503|500|502|504|429)\b|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|fetch failed|ECONNRESET/i.test(msg);
}

/**
 * Runs a Gemini call, retrying transient failures (e.g. 503 "high demand")
 * twice with a short backoff before giving up.
 */
export async function withGeminiRetry<T>(call: () => Promise<T>, delaysMs: number[] = [1500, 4000]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (e) {
      if (attempt >= delaysMs.length || !isTransient(e)) throw e;
      console.warn(`Gemini busy (attempt ${attempt + 1}), retrying in ${delaysMs[attempt]} ms`);
      await new Promise(r => setTimeout(r, delaysMs[attempt]));
    }
  }
}

/** Maps a Gemini failure to a message that is safe to show users (no internals). */
export function describeGeminiError(e: unknown): string {
  const reason = e instanceof Error ? e.message : String(e);
  console.error('Gemini processing error:', reason);
  if (reason.includes('API_KEY') || reason.includes('API key') || reason.includes('401') || reason.includes('not configured')) {
    return 'AI summary unavailable: the Gemini API key is missing or invalid.';
  }
  if (reason.includes('quota') || reason.includes('429')) {
    return 'AI summary unavailable: Gemini API quota exceeded. Try again later.';
  }
  return 'AI summary generation failed. Please try again later.';
}
