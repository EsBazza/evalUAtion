import { NextResponse } from 'next/server';
import { generateServerKeyPair, computeSharedSecretAndHKDF, encryptSessionKey } from '@/lib/crypto/ecdh';

export async function POST(req: Request) {
  try {
    const { clientPublicKey } = await req.json();
    
    if (!clientPublicKey) {
      return NextResponse.json({ error: 'clientPublicKey is required' }, { status: 400 });
    }

    const { publicKey: serverPublicKey, privateKey: serverPrivateKey } = generateServerKeyPair();
    
    // Derive session key server-side
    const sessionKey = computeSharedSecretAndHKDF(serverPrivateKey, clientPublicKey);
    
    // Encrypt the session key with the master key to create a stateless token
    const masterKeyBase64 = process.env.AES_MASTER_KEY;
    if (!masterKeyBase64) {
      throw new Error('Server misconfiguration: missing AES_MASTER_KEY');
    }
    
    const sessionToken = encryptSessionKey(sessionKey, masterKeyBase64);
    
    return NextResponse.json({
      serverPublicKey,
      sessionToken
    });
  } catch (error) {
    console.error('Error in key exchange:', error);
    return NextResponse.json({ error: 'Failed to exchange keys' }, { status: 500 });
  }
}
