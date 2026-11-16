import crypto from 'crypto';

/**
 * AES-256-GCM encryption for audit log payloads.
 * AUDIT_LOG_KEY must be 64 hex characters (32 bytes). There is deliberately no
 * fallback key: a missing key fails loudly instead of "encrypting" with zeros.
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function getAuditKey(): Buffer {
  const hex = process.env.AUDIT_LOG_KEY?.trim();
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('AUDIT_LOG_KEY must be set to 64 hex characters (32 bytes).');
  }
  return Buffer.from(hex, 'hex');
}

export function encryptWithServerKey(payload: unknown, key: Buffer = getAuditKey()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptWithServerKey(ciphertext: Buffer, iv: Buffer, authTag: Buffer, key: Buffer = getAuditKey()) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}
