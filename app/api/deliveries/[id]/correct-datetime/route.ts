export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const delivery = await prisma.delivery.findUnique({ where: { id }, include: { jornada: { select: { status: true } } } });
  if (!delivery) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
  if (delivery.jornada.status !== 'REABIERTA') {
    return NextResponse.json({ error: 'Reabra la jornada para realizar correcciones administrativas.' }, { status: 409 });
  }

  try {
    const body = await request.json();
    const { correctedTimestamp, reason } = body ?? {};

    if (!correctedTimestamp || !reason) {
      return NextResponse.json({ error: 'Fecha corregida y motivo son requeridos' }, { status: 400 });
    }

    await prisma.delivery.update({
      where: { id },
      data: {
        correctedTimestamp: new Date(correctedTimestamp),
        correctionReason: reason,
        correctedAt: new Date(),
        correctedByAdminId: admin.adminId,
      },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'DATETIME_CORRECTED',
      entityType: 'Delivery',
      entityId: id,
      adminId: admin.adminId,
      jornadaId: delivery.jornadaId,
      deliveryId: id,
      detail: `Fecha corregida: ${reason}`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Error corrigiendo fecha:', e);
    return NextResponse.json({ error: 'Error corrigiendo fecha' }, { status: 500 });
  }
}
