import { prisma } from '@/lib/prisma';
import { encryptWithServerKey } from '@/lib/crypto';
import { auth } from '@/auth';

/**
 * Server-only helper (intentionally NOT a server action, so it can't be called
 * from the browser to forge audit entries).
 */
export async function writeAuditLog(eventType: string, payload: unknown) {
  try {
    const session = await auth();
    const actorEmail = session?.user?.email || 'SYSTEM';
    const { ciphertext, iv, authTag } = encryptWithServerKey(payload);

    await prisma.auditLog.create({
      data: {
        eventType,
        actorEmail,
        encryptedEvent: new Uint8Array(ciphertext),
        iv: new Uint8Array(iv),
        authTag: new Uint8Array(authTag),
      },
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to write audit log:', error);
    return { success: false, error: 'Logging failure' };
  }
}
