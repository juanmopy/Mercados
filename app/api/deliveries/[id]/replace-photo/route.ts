export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';
import { uploadPhoto } from '@/lib/supabase';

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
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    if (!file) return NextResponse.json({ error: 'Foto requerida' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const newPath = `jornada_${delivery.jornadaId}/delivery_${id}_replacement_${timestamp}.jpg`;

    await uploadPhoto('delivery-photos', newPath, buffer, 'image/jpeg');

    await prisma.delivery.update({
      where: { id },
      data: {
        photoOriginalPath: delivery.isPhotoReplaced ? delivery.photoOriginalPath : delivery.photoPath,
        photoPath: newPath,
        isPhotoReplaced: true,
        photoReplacedAt: new Date(),
      },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'PHOTO_REPLACED',
      entityType: 'Delivery',
      entityId: id,
      adminId: admin.adminId,
      jornadaId: delivery.jornadaId,
      deliveryId: id,
      detail: `Foto reemplazada para entrega ${id}`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true, newPhotoPath: newPath });
  } catch (e: any) {
    console.error('Error reemplazando foto:', e);
    return NextResponse.json({ error: 'Error reemplazando foto' }, { status: 500 });
  }
}
