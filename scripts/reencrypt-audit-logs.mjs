// One-time: re-encrypt audit logs that were written with the old all-zero fallback key
// (used whenever AUDIT_LOG_KEY was missing) under the real AUDIT_LOG_KEY.
//
// Run once after copying data into a database, with AUDIT_LOG_KEY set:
//   node --env-file=.env scripts/reencrypt-audit-logs.mjs
// Safe to re-run: logs already readable with AUDIT_LOG_KEY are skipped.
import crypto from 'crypto';
import pg from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const hex = process.env.AUDIT_LOG_KEY?.trim();
if (!url) throw new Error('Set DATABASE_URL_UNPOOLED or DATABASE_URL');
if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('AUDIT_LOG_KEY must be 64 hex characters');

const newKey = Buffer.from(hex, 'hex');
const legacyKey = Buffer.alloc(32); // the old "000...0" fallback

function tryDecrypt(key, data, iv, tag) {
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]);
  } catch {
    return null;
  }
}

const client = new pg.Client({ connectionString: url });
await client.connect();
let migrated = 0, alreadyOk = 0, unreadable = 0;

try {
  await client.query('BEGIN');
  const { rows } = await client.query('SELECT id, "encryptedEvent", iv, "authTag" FROM "AuditLog"');
  for (const row of rows) {
    if (tryDecrypt(newKey, row.encryptedEvent, row.iv, row.authTag)) { alreadyOk++; continue; }
    const plain = tryDecrypt(legacyKey, row.encryptedEvent, row.iv, row.authTag);
    if (!plain) { unreadable++; continue; }

    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', newKey, iv);
    const data = Buffer.concat([c.update(plain), c.final()]);
    await client.query(
      'UPDATE "AuditLog" SET "encryptedEvent" = $1, iv = $2, "authTag" = $3 WHERE id = $4',
      [data, iv, c.getAuthTag(), row.id]);
    migrated++;
  }
  await client.query('COMMIT');
  console.log(`Re-encrypted: ${migrated}, already using AUDIT_LOG_KEY: ${alreadyOk}, unreadable with either key: ${unreadable}`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Failed, nothing was changed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
