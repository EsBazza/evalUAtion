import { z } from 'zod';

// Pure validation for student evaluation submissions (no database access, unit tested).

export const MAX_TEXT_LENGTH = 2000;

export const submissionSchema = z.object({
  sectionId: z.string().min(1).max(64),
  professorId: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(64),
  answers: z
    .array(
      z.object({
        criterionId: z.string().min(1).max(64),
        score: z.number().int().optional(),
        textVal: z.string().max(MAX_TEXT_LENGTH).optional(),
        jsonVal: z.array(z.string().max(200)).max(50).optional(),
      })
    )
    .min(1)
    .max(500),
});

export type SubmissionInput = z.infer<typeof submissionSchema>;

export interface CriterionRule {
  id: string;
  type: 'SCALE_1_TO_5' | 'SCALE_0_TO_4' | 'RADIO_EXPECTATION' | 'CHECKBOX_AREAS' | 'TEXT_LONG';
  options: unknown;
}

export interface CleanAnswer {
  criterionId: string;
  score?: number;
  textVal?: string;
  jsonVal?: string[];
}

export type ValidationResult = { ok: true; answers: CleanAnswer[] } | { ok: false; error: string };

const SCALE_RANGES = {
  SCALE_0_TO_4: [0, 4],
  SCALE_1_TO_5: [1, 5],
} as const;

function optionList(options: unknown): string[] | null {
  return Array.isArray(options) && options.every(o => typeof o === 'string') ? (options as string[]) : null;
}

/**
 * Checks every answer against the template the server chose for the section:
 * every question answered exactly once, nothing from other templates,
 * scores inside the scale, choices from the allowed options.
 * Returns cleaned answers holding only the field each question type uses.
 */
export function validateAnswers(criteria: CriterionRule[], answers: SubmissionInput['answers']): ValidationResult {
  const byId = new Map(criteria.map(c => [c.id, c]));
  const seen = new Set<string>();
  const clean: CleanAnswer[] = [];

  for (const ans of answers) {
    const crit = byId.get(ans.criterionId);
    if (!crit) return { ok: false, error: 'Your answers do not match the current evaluation form. Please reload the page.' };
    if (seen.has(crit.id)) return { ok: false, error: 'Each question can only be answered once.' };
    seen.add(crit.id);

    switch (crit.type) {
      case 'SCALE_0_TO_4':
      case 'SCALE_1_TO_5': {
        const [min, max] = SCALE_RANGES[crit.type];
        if (typeof ans.score !== 'number' || ans.score < min || ans.score > max) {
          return { ok: false, error: `Ratings must be between ${min} and ${max}.` };
        }
        clean.push({ criterionId: crit.id, score: ans.score });
        break;
      }
      case 'RADIO_EXPECTATION': {
        const value = ans.textVal?.trim();
        const allowed = optionList(crit.options);
        if (!value || value.length > 200 || (allowed && !allowed.includes(value))) {
          return { ok: false, error: 'Please choose one of the listed options.' };
        }
        clean.push({ criterionId: crit.id, textVal: value });
        break;
      }
      case 'CHECKBOX_AREAS': {
        const values = ans.jsonVal ?? [];
        const allowed = optionList(crit.options);
        if (values.length === 0 || new Set(values).size !== values.length || (allowed && values.some(v => !allowed.includes(v)))) {
          return { ok: false, error: 'Please select options only from the list, without duplicates.' };
        }
        clean.push({ criterionId: crit.id, jsonVal: values });
        break;
      }
      case 'TEXT_LONG': {
        const value = ans.textVal?.trim();
        if (!value) return { ok: false, error: 'Please answer every feedback question.' };
        clean.push({ criterionId: crit.id, textVal: value });
        break;
      }
      default:
        return { ok: false, error: 'Unsupported question type.' };
    }
  }

  if (seen.size !== criteria.length) {
    return { ok: false, error: 'Please answer every question before submitting.' };
  }
  return { ok: true, answers: clean };
}

/** Evaluation timestamps are kept only to the day, so they can't be matched to attendance receipts. */
export function anonymizedEvaluationDate(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
