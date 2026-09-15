export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';
import { deleteStorageFile, getSignedUrl } from '@/lib/supabase';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      beneficiary: true,
      operator: { select: { name: true } },
      jornada: { select: { description: true } },
    },
  });
  if (!delivery) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });

  let photoUrl: string | null = null;
  try {
    photoUrl = await getSignedUrl('delivery-photos', delivery.photoPath, 3600);
  } catch {
    photoUrl = null;
  }

  return NextResponse.json({ ...delivery, photoUrl });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { beneficiary: true, jornada: { select: { status: true } } },
  });
  if (!delivery) return NextResponse.json({ error: 'Entrega no encontrada' }, { status: 404 });
  if (delivery.jornada.status !== 'ACTIVA' && delivery.jornada.status !== 'REABIERTA') {
    return NextResponse.json({ error: 'La jornada debe estar activa o reabierta para eliminar una entrega.' }, { status: 409 });
  }

  // Delete photo from storage
  try {
    await deleteStorageFile('delivery-photos', delivery.photoPath);
    if (delivery.photoOriginalPath) {
      await deleteStorageFile('delivery-photos', delivery.photoOriginalPath);
    }
  } catch {
    console.error('Error eliminando fotos del storage');
  }

  // Delete audit logs for this delivery first
  await prisma.auditLog.deleteMany({ where: { deliveryId: id } });
  await prisma.delivery.delete({ where: { id } });

  const { ipAddress, userAgent } = getClientInfo(request);
  await logAudit({
    actionType: 'DELIVERY_DELETED',
    entityType: 'Delivery',
    entityId: id,
    adminId: admin.adminId,
    jornadaId: delivery.jornadaId,
    detail: `Entrega eliminada: ${delivery.beneficiary?.fullName} (CC ${delivery.beneficiary?.cedula})`,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
}
