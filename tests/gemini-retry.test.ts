import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withGeminiRetry } from '../lib/gemini.ts';

test('retries a busy (503) Gemini error, then succeeds', async () => {
  let calls = 0;
  const result = await withGeminiRetry(async () => {
    calls++;
    if (calls < 3) throw new Error('{"error":{"code":503,"status":"UNAVAILABLE","message":"high demand"}}');
    return 'ok';
  }, [1, 1]);
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('gives up after the retries are used', async () => {
  let calls = 0;
  await assert.rejects(withGeminiRetry(async () => { calls++; throw new Error('503 UNAVAILABLE'); }, [1, 1]));
  assert.equal(calls, 3);
});

test('does not retry permanent errors such as a bad API key', async () => {
  let calls = 0;
  await assert.rejects(withGeminiRetry(async () => { calls++; throw new Error('API key not valid (400)'); }, [1, 1]));
  assert.equal(calls, 1);
});
