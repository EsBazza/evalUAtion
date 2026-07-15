import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto/aes';

export async function GET(
  req: Request,
  context: { params: Promise<{ facultyId: string }> }
) {
  try {
    const session = await auth();
    
    // Role-based check (only ADMIN or SUB_ADMIN can view)
    if (!session?.user || ((session.user as any).role !== 'ADMIN' && (session.user as any).role !== 'SUB_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { facultyId } = await context.params;
    
    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('periodId');

    if (!periodId) {
      return NextResponse.json({ error: 'periodId query parameter is required' }, { status: 400 });
    }

    const masterKeyBase64 = process.env.AES_MASTER_KEY;
    if (!masterKeyBase64) {
      throw new Error('Server misconfiguration: missing AES_MASTER_KEY');
    }
    const masterKey = Buffer.from(masterKeyBase64, 'base64');

    // Fetch encrypted records
    const records = await prisma.secureEvaluation.findMany({
      where: {
        facultyId,
        periodId
      }
    });

    // Decrypt server-side
    const decryptedRecords = records.map(record => {
      try {
        const jsonStr = decrypt(
          Buffer.from(record.encryptedData),
          masterKey,
          Buffer.from(record.iv),
          Buffer.from(record.authTag)
        );
        return JSON.parse(jsonStr);
      } catch (err) {
        console.error('Failed to decrypt record', record.id);
        return null;
      }
    }).filter(r => r !== null);

    // Aggregate/display only
    // This is a simple aggregation example
    const count = decryptedRecords.length;

    return NextResponse.json({
      facultyId,
      periodId,
      submissionCount: count,
      records: decryptedRecords // Or just aggregated data depending on requirements
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
