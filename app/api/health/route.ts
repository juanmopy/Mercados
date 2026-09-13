export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString(), db: 'connected' });
  } catch (e: any) {
    return NextResponse.json({ status: 'error', db: 'disconnected', error: e?.message }, { status: 500 });
  }
}
