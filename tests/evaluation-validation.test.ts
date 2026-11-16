import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAnswers,
  submissionSchema,
  anonymizedEvaluationDate,
  type CriterionRule,
} from '../lib/evaluation-validation.ts';

const criteria: CriterionRule[] = [
  { id: 'q1', type: 'SCALE_0_TO_4', options: null },
  { id: 'q2', type: 'SCALE_1_TO_5', options: null },
  { id: 'q3', type: 'RADIO_EXPECTATION', options: ['Exceeds', 'Meets', 'Below'] },
  { id: 'q4', type: 'CHECKBOX_AREAS', options: ['Communication', 'Instruction', 'None'] },
  { id: 'q5', type: 'TEXT_LONG', options: null },
];

const valid = () => [
  { criterionId: 'q1', score: 4 },
  { criterionId: 'q2', score: 1 },
  { criterionId: 'q3', textVal: 'Meets' },
  { criterionId: 'q4', jsonVal: ['Communication', 'None'] },
  { criterionId: 'q5', textVal: '  Great teacher  ' },
];

test('accepts a complete, valid submission and trims text', () => {
  const r = validateAnswers(criteria, valid());
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.answers.find(a => a.criterionId === 'q5')?.textVal, 'Great teacher');
});

test('strips fields that do not belong to the question type', () => {
  const answers = valid();
  answers[0] = { criterionId: 'q1', score: 3, textVal: 'sneaky', jsonVal: ['x'] } as never;
  const r = validateAnswers(criteria, answers);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.answers[0], { criterionId: 'q1', score: 3 });
});

test('rejects scores outside the scale', () => {
  for (const [id, score] of [['q1', 5], ['q1', -1], ['q2', 0], ['q2', 6]] as const) {
    const answers = valid().map(a => (a.criterionId === id ? { criterionId: id, score } : a));
    assert.equal(validateAnswers(criteria, answers).ok, false, `${id}=${score}`);
  }
});

test('rejects questions from another template', () => {
  assert.equal(validateAnswers(criteria, [...valid(), { criterionId: 'other', score: 3 }]).ok, false);
});

test('rejects missing and duplicate answers', () => {
  assert.equal(validateAnswers(criteria, valid().slice(1)).ok, false, 'missing');
  assert.equal(validateAnswers(criteria, [...valid(), { criterionId: 'q1', score: 2 }]).ok, false, 'duplicate');
});

test('rejects choices that are not in the options', () => {
  const badRadio = valid().map(a => (a.criterionId === 'q3' ? { criterionId: 'q3', textVal: 'Made up' } : a));
  assert.equal(validateAnswers(criteria, badRadio).ok, false);
  const badBox = valid().map(a => (a.criterionId === 'q4' ? { criterionId: 'q4', jsonVal: ['Hacked'] } : a));
  assert.equal(validateAnswers(criteria, badBox).ok, false);
  const dupBox = valid().map(a => (a.criterionId === 'q4' ? { criterionId: 'q4', jsonVal: ['None', 'None'] } : a));
  assert.equal(validateAnswers(criteria, dupBox).ok, false);
});

test('rejects blank feedback', () => {
  const blank = valid().map(a => (a.criterionId === 'q5' ? { criterionId: 'q5', textVal: '   ' } : a));
  assert.equal(validateAnswers(criteria, blank).ok, false);
});

test('schema rejects oversized or malformed input', () => {
  assert.equal(submissionSchema.safeParse({ sectionId: 's', professorId: 'p', answers: [] }).success, false);
  assert.equal(submissionSchema.safeParse({ sectionId: 's', professorId: 'p', answers: [{ criterionId: 'q', textVal: 'x'.repeat(2001) }] }).success, false);
  assert.equal(submissionSchema.safeParse({ sectionId: 's', professorId: 'p', answers: [{ criterionId: 'q', score: 2.5 }] }).success, false);
  assert.equal(submissionSchema.safeParse('not an object').success, false);
});

test('evaluation dates keep only the day', () => {
  const d = anonymizedEvaluationDate(new Date('2026-11-16T13:45:12.345Z'));
  assert.equal(d.toISOString(), '2026-11-16T00:00:00.000Z');
});
