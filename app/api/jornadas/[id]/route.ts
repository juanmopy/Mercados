export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';
import { deleteStorageFile } from '@/lib/supabase';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const jornada = await prisma.jornada.findUnique({
    where: { id },
    include: {
      _count: { select: { beneficiaries: true, deliveries: true } },
      admin: { select: { name: true } },
      beneficiaries: {
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          cedula: true,
          delivery: { select: { id: true } },
        },
      },
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

  try {
    const [deliveries, backups] = await Promise.all([
      prisma.delivery.findMany({
        where: { jornadaId: id },
        select: { id: true, photoPath: true, photoOriginalPath: true },
      }),
      prisma.backup.findMany({
        where: { jornadaId: id },
        select: { storagePath: true },
      }),
    ]);

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { jornadaId: id },
            { deliveryId: { in: deliveries.map((delivery) => delivery.id) } },
          ],
        },
      });
      await tx.delivery.deleteMany({ where: { jornadaId: id } });
      await tx.beneficiary.deleteMany({ where: { jornadaId: id } });
      await tx.backup.deleteMany({ where: { jornadaId: id } });
      await tx.jornada.delete({ where: { id } });
    });

    const deliveryFiles = deliveries.flatMap((delivery) => [delivery.photoPath, delivery.photoOriginalPath])
      .filter((path): path is string => Boolean(path));
    await Promise.allSettled([
      ...deliveryFiles.map((path) => deleteStorageFile('delivery-photos', path)),
      ...backups.map((backup) => deleteStorageFile('backups', backup.storagePath)),
    ]);
  } catch (e) {
    console.error('Error eliminando jornada:', e);
    return NextResponse.json({ error: 'Error eliminando la jornada' }, { status: 500 });
  }

  const { ipAddress, userAgent } = getClientInfo(request);
  await logAudit({
    actionType: 'JORNADA_DELETED',
    entityType: 'Jornada',
    entityId: id,
    adminId: admin.adminId,
    detail: `Jornada eliminada: ${jornada.description}`,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
}
