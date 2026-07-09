import crypto from 'crypto';

// In-memory store for active session keys (ephemeral)
// In production, a distributed cache like Redis or a fast database table can be used,
// but for development and standard single-instance deployment, a global memory map is perfect.
const globalSessionKeys = (global as any).sessionKeys || new Map<string, string>();
if (!(global as any).sessionKeys) {
  (global as any).sessionKeys = globalSessionKeys;
}

/**
 * Generate a new server P-256 ECDH keypair and store the private key.
 * Returns the session ID and the uncompressed public key as base64.
 */
export function generateServerECDHSession(): { sessionId: string; publicKey: string } {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  
  const sessionId = crypto.randomUUID();
  const publicKey = ecdh.getPublicKey('base64');
  const privateKey = ecdh.getPrivateKey('base64');
  
  // Store private key for this session
  globalSessionKeys.set(sessionId, privateKey);
  
  // Clean up keys older than 1 hour to prevent memory leaks
  // We can run a quick cleanup on generate
  setTimeout(() => {
    globalSessionKeys.delete(sessionId);
  }, 1000 * 60 * 60); // 1 hour TTL
  
  return { sessionId, publicKey };
}

/**
 * Decrypts a client payload encrypted with ECDH + AES-256-GCM.
 */
export function decryptClientPayload(
  sessionId: string,
  clientPublicKeyBase64: string,
  encryptedPayloadBase64: string,
  ivBase64: string,
  authTagBase64: string
): any {
  const serverPrivateKeyBase64 = globalSessionKeys.get(sessionId);
  if (!serverPrivateKeyBase64) {
    throw new Error('Crypto session expired or invalid. Please refresh the page and try again.');
  }

  // Remove the single-use key to enforce ephemerality
  globalSessionKeys.delete(sessionId);

  // Compute ECDH shared secret
  const serverECDH = crypto.createECDH('prime256v1');
  serverECDH.setPrivateKey(Buffer.from(serverPrivateKeyBase64, 'base64'));
  const sharedSecret = serverECDH.computeSecret(Buffer.from(clientPublicKeyBase64, 'base64'));

  // Derive AES key using HKDF-SHA256
  const aesKey = crypto.hkdfSync(
    'sha256',
    sharedSecret,
    Buffer.alloc(0), // salt
    Buffer.from('evaluation-session'), // info
    32 // 256 bits key size
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
