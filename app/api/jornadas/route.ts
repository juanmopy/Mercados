export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function GET() {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const jornadas = await prisma.jornada.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { beneficiaries: true, deliveries: true } },
    },
  });
  return NextResponse.json(jornadas);
}

export async function POST(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { description, officialDate, allowEarly, allowLate } = body ?? {};

    if (!description || !officialDate) {
      return NextResponse.json({ error: 'Descripción y fecha son requeridos' }, { status: 400 });
    }

    const jornada = await prisma.jornada.create({
      data: {
        description,
        officialDate: new Date(officialDate),
        allowEarly: allowEarly ?? false,
        allowLate: allowLate ?? false,
        createdByAdminId: admin.adminId,
      },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'JORNADA_CREATED',
      entityType: 'Jornada',
      entityId: jornada.id,
      adminId: admin.adminId,
      jornadaId: jornada.id,
      detail: `Jornada creada: ${description}`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(jornada, { status: 201 });
  } catch (e: any) {
    console.error('Error creando jornada:', e);
    return NextResponse.json({ error: 'Error creando jornada' }, { status: 500 });
  }
}
