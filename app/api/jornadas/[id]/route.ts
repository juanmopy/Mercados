export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const jornada = await prisma.jornada.findUnique({
    where: { id },
    include: {
      _count: { select: { beneficiaries: true, deliveries: true } },
      admin: { select: { name: true } },
    },
  });
  if (!jornada) return NextResponse.json({ error: 'Jornada no encontrada' }, { status: 404 });
  return NextResponse.json(jornada);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const jornada = await prisma.jornada.findUnique({ where: { id } });
  if (!jornada) return NextResponse.json({ error: 'Jornada no encontrada' }, { status: 404 });
  if (jornada.status !== 'CONFIGURADA' && jornada.status !== 'CERRADA') {
    return NextResponse.json({ error: 'Solo se pueden eliminar jornadas configuradas o cerradas' }, { status: 400 });
  }

  await prisma.jornada.delete({ where: { id } });

  const { ipAddress, userAgent } = getClientInfo(request);
  await logAudit({
    actionType: 'JORNADA_DELETED',
    entityType: 'Jornada',
    entityId: id,
    adminId: admin.adminId,
    jornadaId: id,
    detail: `Jornada eliminada: ${jornada.description}`,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
}
