export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOperatorFromCookie, getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';
import { moveFile, deleteStorageFile } from '@/lib/supabase';
import { normalizeCedula } from '@/lib/excel';
import { isJornadaDeliveryAllowed, serverTimestamp } from '@/lib/timezone';

export async function POST(request: NextRequest) {
  const operator = await getOperatorFromCookie();
  if (!operator) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { beneficiaryCedula, jornadaId, photoPath, deviceTimestamp } = body ?? {};

    if (!beneficiaryCedula || !jornadaId || !photoPath) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // Verify active jornada
    const jornada = await prisma.jornada.findUnique({ where: { id: jornadaId } });
    if (jornada?.status !== 'ACTIVA' || !isJornadaDeliveryAllowed(jornada)) {
      return NextResponse.json({ error: 'No hay jornada habilitada en este momento. Contacte al administrador.' }, { status: 400 });
    }

    // Find beneficiary
    const cedula = normalizeCedula(beneficiaryCedula);
    const beneficiary = await prisma.beneficiary.findFirst({
      where: { cedula, jornadaId },
    });
    if (!beneficiary) {
      return NextResponse.json({ error: 'Beneficiario no encontrado. Verifique el número de cédula digitado.' }, { status: 404 });
    }

    // Create delivery
    try {
      const delivery = await prisma.delivery.create({
        data: {
          jornadaId,
          beneficiaryId: beneficiary.id,
          operatorId: operator.operatorId,
          photoPath,
          serverTimestamp: serverTimestamp(),
          deviceTimestamp: deviceTimestamp ? new Date(deviceTimestamp) : null,
        },
      });

      // Rename temp photo to final path
      const finalPath = `jornada_${jornadaId}/delivery_${delivery.id}.jpg`;
      try {
        await moveFile('delivery-photos', photoPath, finalPath);
        await prisma.delivery.update({ where: { id: delivery.id }, data: { photoPath: finalPath } });
      } catch {
        // Photo rename failed but delivery was created, keep temp path
        console.error('Error renombrando foto, manteniendo ruta temporal');
      }

      const { ipAddress, userAgent } = getClientInfo(request);
      await logAudit({
        actionType: 'DELIVERY_CREATED',
        entityType: 'Delivery',
        entityId: delivery.id,
        operatorId: operator.operatorId,
        jornadaId,
        deliveryId: delivery.id,
        detail: `Entrega registrada: ${beneficiary.fullName} (CC ${cedula})`,
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        beneficiaryName: beneficiary.fullName,
        deliveryId: delivery.id,
      });
    } catch (e: any) {
      // Check for unique constraint violation
      if (e?.code === 'P2002') {
        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
          actionType: 'DELIVERY_DUPLICATE_ATTEMPT',
          entityType: 'Beneficiary',
          entityId: beneficiary.id,
          operatorId: operator.operatorId,
          jornadaId,
          detail: `Intento de duplicado: ${beneficiary.fullName} (CC ${cedula})`,
          ipAddress,
          userAgent,
        });
        // Try to clean up temp photo
        try { await deleteStorageFile('delivery-photos', photoPath); } catch {}
        return NextResponse.json({
          error: 'Entrega no permitida: este adulto mayor ya tiene un mercado registrado en la jornada actual.',
        }, { status: 409 });
      }
      throw e;
    }
  } catch (e: any) {
    console.error('Error registrando entrega:', e);
    return NextResponse.json({ error: 'No fue posible registrar la entrega. Revise la conexión e intente nuevamente. La información no se guardó.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jornadaId = searchParams.get('jornadaId');
  const operatorId = searchParams.get('operatorId');
  const page = Number.parseInt(searchParams.get('page') ?? '1');
  const limit = Number.parseInt(searchParams.get('limit') ?? '50');
  const search = searchParams.get('search') ?? '';

  const where: any = {};
  if (jornadaId) where.jornadaId = jornadaId;
  if (operatorId) where.operatorId = operatorId;
  if (search) {
    where.OR = [
      { beneficiary: { fullName: { contains: search, mode: 'insensitive' } } },
      { beneficiary: { cedula: { contains: search } } },
    ];
  }

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: {
        beneficiary: { select: { fullName: true, cedula: true } },
        operator: { select: { name: true } },
        jornada: { select: { description: true, status: true } },
      },
      orderBy: { serverTimestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.delivery.count({ where }),
  ]);

  return NextResponse.json({
    deliveries,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
