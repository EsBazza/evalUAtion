export async function generateClientKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function deriveSessionKey(clientPrivateKey: CryptoKey, serverPublicKeyBase64: string): Promise<CryptoKey> {
  const serverPubKeyBuf = Uint8Array.from(atob(serverPublicKeyBase64), c => c.charCodeAt(0));
  const serverPubKey = await window.crypto.subtle.importKey(
    'raw',
    serverPubKeyBuf,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  const sharedSecret = await window.crypto.subtle.deriveBits(
    { name: 'ECDH', public: serverPubKey },
    clientPrivateKey,
    256
  );

  const hkdfKey = await window.crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey']
  );

  const sessionKey = await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('evaluation-session')
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return sessionKey;
}

export async function encryptPayloadClient(payload: any, sessionKey: CryptoKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  
  const ciphertextBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    encoded
  );
  
  const cipherBytes = new Uint8Array(ciphertextBuf);
  // In AES-GCM, WebCrypto appends the 16-byte auth tag at the end of the ciphertext
  const ciphertext = cipherBytes.slice(0, -16);
  const authTag = cipherBytes.slice(-16);
  
  return {
    ciphertext: btoa(String.fromCharCode(...ciphertext)),
    iv: btoa(String.fromCharCode(...iv)),
    authTag: btoa(String.fromCharCode(...authTag))
  };
}
