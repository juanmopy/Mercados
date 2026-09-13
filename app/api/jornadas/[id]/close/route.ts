export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const jornada = await prisma.jornada.findUnique({ where: { id } });
  if (!jornada) return NextResponse.json({ error: 'Jornada no encontrada' }, { status: 404 });
  if (jornada.status !== 'ACTIVA' && jornada.status !== 'REABIERTA') {
    return NextResponse.json({ error: 'Solo se pueden cerrar jornadas activas o reabiertas para correcciones' }, { status: 400 });
  }

  const updated = await prisma.jornada.update({ where: { id }, data: { status: 'CERRADA' } });

  const { ipAddress, userAgent } = getClientInfo(request);
  await logAudit({
    actionType: 'JORNADA_CLOSED',
    entityType: 'Jornada',
    entityId: id,
    adminId: admin.adminId,
    jornadaId: id,
    detail: `Jornada cerrada: ${jornada.description}`,
    ipAddress,
    userAgent,
  });

  return NextResponse.json(updated);
}
