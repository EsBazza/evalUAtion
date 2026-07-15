'use server';

import { prisma } from '@/lib/prisma';
import { encryptWithServerKey, decryptWithServerKey } from '@/lib/crypto';
import { auth } from '@/auth';

export async function writeAuditLog(eventType: string, payload: any) {
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

export async function getAuditLogs(limit = 100) {
  try {
    // Authenticate admin access
    const session = await auth();
    if (!session || !session.user) {
      throw new Error('Unauthorized');
    }

    if ((session.user as any).role !== 'ADMIN' && (session.user as any).role !== 'SUB_ADMIN') {
      throw new Error('Forbidden');
    }

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500), // Hard ceiling at 500 to avoid accidental large fetches
    });

    return logs.map((log: any) => {
      try {
        const details = decryptWithServerKey(
          Buffer.from(log.encryptedEvent),
          Buffer.from(log.iv),
          Buffer.from(log.authTag)
        );
        return {
          id: log.id,
          eventType: log.eventType,
          actorEmail: log.actorEmail,
          createdAt: log.createdAt,
          details,
        };
      } catch (err) {
        console.error(`Failed to decrypt audit log ${log.id}:`, err);
        return {
          id: log.id,
          eventType: log.eventType,
          actorEmail: log.actorEmail,
          createdAt: log.createdAt,
          details: { error: 'Failed to decrypt log payload' },
        };
      }
    });
  } catch (error: any) {
    console.error('Failed to read audit logs:', error);
    throw new Error(error.message || 'Audit retrieval error');
  }
}
