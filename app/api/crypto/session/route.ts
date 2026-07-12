import { NextResponse } from 'next/server';
import { generateServerECDHSession } from '@/lib/crypto';

export async function GET() {
  try {
    const session = await generateServerECDHSession();
    return NextResponse.json(session);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to initialize session' }, { status: 500 });
  }
}
