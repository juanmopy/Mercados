export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOperatorFromCookie, getAdminFromCookie } from '@/lib/auth';

export async function GET() {
  const operator = await getOperatorFromCookie();
  const admin = await getAdminFromCookie();
  if (!operator && !admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const jornada = await prisma.jornada.findFirst({
    where: { status: 'ACTIVA' },
    select: { id: true, description: true, officialDate: true, status: true },
  });

  return NextResponse.json({ jornada: jornada ?? null });
}
