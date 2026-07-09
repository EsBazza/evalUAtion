import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decryptSessionKey } from '@/lib/crypto/ecdh';
import { encrypt, decrypt } from '@/lib/crypto/aes';
import { generateSubmissionHash } from '@/lib/crypto/anonymity';

export async function POST(req: Request) {
  try {
    const { 
      facultyId, 
      periodId, 
      ciphertext, 
      iv, 
      authTag, 
      studentId, 
      sessionToken 
    } = await req.json();

    if (!facultyId || !periodId || !ciphertext || !iv || !authTag || !studentId || !sessionToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const masterKeyBase64 = process.env.AES_MASTER_KEY;
    const hmacPepper = process.env.HMAC_PEPPER;
    
    if (!masterKeyBase64 || !hmacPepper) {
      throw new Error('Server misconfiguration: missing security variables');
    }

    // 1. Recover the session key
    const sessionKey = decryptSessionKey(sessionToken, masterKeyBase64);

    // 2. Decrypt the payload from the client using the ephemeral session key
    // We expect ciphertext, iv, authTag from client to be base64 strings
    const decryptedPayloadJson = decrypt(
      Buffer.from(ciphertext, 'base64'),
      sessionKey,
      Buffer.from(iv, 'base64'),
      Buffer.from(authTag, 'base64')
    );

    // 3. Re-encrypt with the master key for at-rest storage (Option A)
    const masterKey = Buffer.from(masterKeyBase64, 'base64');
    const { 
      ciphertext: masterCiphertext, 
      iv: masterIv, 
      authTag: masterAuthTag 
    } = encrypt(decryptedPayloadJson, masterKey);

    // 4. Compute submission hash to prevent duplicates
    const submissionHash = generateSubmissionHash(studentId, facultyId, periodId, hmacPepper);

    // 5. Check for duplicate
    const existing = await prisma.secureEvaluation.findUnique({
      where: { submissionHash }
    });

    if (existing) {
      return NextResponse.json({ error: 'already submitted' }, { status: 409 });
    }

    // 6. Save to DB without student identity
    const evaluation = await prisma.secureEvaluation.create({
      data: {
        facultyId,
        periodId,
        encryptedData: new Uint8Array(masterCiphertext),
        iv: new Uint8Array(masterIv),
        authTag: new Uint8Array(masterAuthTag),
        submissionHash
      }
    });

    return NextResponse.json({ success: true, id: evaluation.id });
  } catch (error) {
    console.error('Error submitting evaluation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
