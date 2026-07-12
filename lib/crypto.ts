import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Store the ECDH private key in the database so it survives
 * across serverless function invocations (Vercel, etc.).
 * Keys are single-use and expire after 1 hour.
 */
async function setSessionKey(sessionId: string, privateKey: string) {
  await prisma.cryptoSession.create({
    data: { id: sessionId, privateKey },
  });

  // Fire-and-forget cleanup of keys older than 1 hour
  prisma.cryptoSession
    .deleteMany({
      where: {
        createdAt: { lt: new Date(Date.now() - 1000 * 60 * 60) },
      },
    })
    .catch(() => {/* ignore cleanup errors */});
}

async function getSessionKey(sessionId: string): Promise<string | undefined> {
  const row = await prisma.cryptoSession.findUnique({ where: { id: sessionId } });
  return row?.privateKey ?? undefined;
}

async function deleteSessionKey(sessionId: string) {
  await prisma.cryptoSession.delete({ where: { id: sessionId } }).catch(() => {/* already deleted */});
}

/**
 * Generate a new server P-256 ECDH keypair and store the private key.
 * Returns the session ID and the uncompressed public key as base64.
 */
export async function generateServerECDHSession(): Promise<{ sessionId: string; publicKey: string }> {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();

  const sessionId = crypto.randomUUID();
  const publicKey = ecdh.getPublicKey('base64');
  const privateKey = ecdh.getPrivateKey('base64');

  await setSessionKey(sessionId, privateKey);

  return { sessionId, publicKey };
}

/**
 * Decrypts a client payload encrypted with ECDH + AES-256-GCM.
 */
export async function decryptClientPayload(
  sessionId: string,
  clientPublicKeyBase64: string,
  encryptedPayloadBase64: string,
  ivBase64: string,
  authTagBase64: string
): Promise<any> {
  const serverPrivateKeyBase64 = await getSessionKey(sessionId);
  if (!serverPrivateKeyBase64) {
    throw new Error('Crypto session expired or invalid. Please refresh the page and try again.');
  }

  // Remove the single-use key to enforce ephemerality
  await deleteSessionKey(sessionId);

  // Compute ECDH shared secret
  const serverECDH = crypto.createECDH('prime256v1');
  serverECDH.setPrivateKey(Buffer.from(serverPrivateKeyBase64, 'base64'));
  const sharedSecret = serverECDH.computeSecret(Buffer.from(clientPublicKeyBase64, 'base64'));

  // Derive AES key using HKDF-SHA256
  const aesKey = crypto.hkdfSync(
    'sha256',
    sharedSecret,
    Buffer.alloc(0),         // salt
    Buffer.from('evaluation-session'), // info
    32                        // 256-bit key
  );

  // Decrypt payload
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(aesKey),
    Buffer.from(ivBase64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

  let decrypted = decipher.update(Buffer.from(encryptedPayloadBase64, 'base64'), undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Standard AES-256-GCM encryption with static server key (for Audit Logs)
 */
export function encryptWithServerKey(payload: any): { ciphertext: Buffer; iv: Buffer; authTag: Buffer } {
  const serverKeyHex = process.env.AUDIT_LOG_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
  const key = Buffer.from(serverKeyHex, 'hex');
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(JSON.stringify(payload), 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag };
}

/**
 * Standard AES-256-GCM decryption with static server key (for Audit Logs)
 */
export function decryptWithServerKey(ciphertext: Buffer, iv: Buffer, authTag: Buffer): any {
  const serverKeyHex = process.env.AUDIT_LOG_KEY || '0000000000000000000000000000000000000000000000000000000000000000';
  const key = Buffer.from(serverKeyHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}
