// One-time: break the link between existing evaluations and attendance receipts.
// Older evaluations have time-ordered cuid ids and exact timestamps, which can be
// matched to EvaluationReceipt rows (which hold student emails).
// This gives them random UUIDs and day-only dates, like new submissions get.
//
// Run once after copying data into a database:
//   node --env-file=.env scripts/anonymize-evaluations.mjs
// Safe to re-run: rows that already have UUIDs are skipped.
import pg from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL_UNPOOLED or DATABASE_URL');

const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query('BEGIN');
  // Answer.evaluationId is ON UPDATE CASCADE, so answers follow their evaluation's new id
  const evals = await client.query(
    `UPDATE "Evaluation" SET id = gen_random_uuid()::text WHERE id !~ $1`, [UUID]);
  const answers = await client.query(
    `UPDATE "Answer" SET id = gen_random_uuid()::text WHERE id !~ $1`, [UUID]);
  const dates = await client.query(
    `UPDATE "Evaluation" SET "createdAt" = date_trunc('day', "createdAt")
     WHERE "createdAt" <> date_trunc('day', "createdAt")`);
  await client.query('COMMIT');
  console.log(`Evaluations re-keyed: ${evals.rowCount}, answers re-keyed: ${answers.rowCount}, dates truncated: ${dates.rowCount}`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Failed, nothing was changed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
