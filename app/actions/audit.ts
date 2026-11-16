'use server';

import { prisma } from '@/lib/prisma';
import { decryptWithServerKey } from '@/lib/crypto';
import { requireAdmin } from '@/lib/authz';

export async function getAuditLogs(limit = 100) {
  await requireAdmin();

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(1, limit), 500), // Hard ceiling at 500 to avoid accidental large fetches
  });

  return logs.map((log) => {
    let details: any;
    try {
      details = decryptWithServerKey(Buffer.from(log.encryptedEvent), Buffer.from(log.iv), Buffer.from(log.authTag));
    } catch {
      console.error(`Failed to decrypt audit log ${log.id}`);
      details = { error: 'Failed to decrypt log payload' };
    }
    return {
      id: log.id,
      eventType: log.eventType,
      actorEmail: log.actorEmail,
      createdAt: log.createdAt,
      details,
    };
  });
}
