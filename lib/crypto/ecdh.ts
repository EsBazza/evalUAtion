import crypto from 'crypto';

export function generateServerKeyPair() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey('base64'),
    privateKey: ecdh.getPrivateKey('base64'),
  };
}

export function computeSharedSecretAndHKDF(serverPrivateKeyBase64: string, clientPublicKeyBase64: string): Buffer {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from(serverPrivateKeyBase64, 'base64'));
  const sharedSecret = ecdh.computeSecret(Buffer.from(clientPublicKeyBase64, 'base64'));
  
  // HKDF-SHA256 to derive 32-byte AES key
  const sessionKey = crypto.hkdfSync('sha256', sharedSecret, Buffer.alloc(0), Buffer.from('evaluation-session'), 32);
  return Buffer.from(sessionKey);
}

export function encryptSessionKey(sessionKey: Buffer, masterKeyBase64: string): string {
  const masterKey = Buffer.from(masterKeyBase64, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  
  const ciphertext = Buffer.concat([cipher.update(sessionKey), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  const token = JSON.stringify({
    sk: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64')
  });
  
  return Buffer.from(token).toString('base64');
}

export function decryptSessionKey(sessionTokenBase64: string, masterKeyBase64: string): Buffer {
  const tokenStr = Buffer.from(sessionTokenBase64, 'base64').toString('utf8');
  const { sk, iv, tag } = JSON.parse(tokenStr);
  
  const masterKey = Buffer.from(masterKeyBase64, 'base64');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', 
    masterKey, 
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  
  const sessionKey = Buffer.concat([
    decipher.update(Buffer.from(sk, 'base64')), 
    decipher.final()
  ]);
  
  return sessionKey;
}
