export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie, getOperatorFromCookie } from '@/lib/auth';
import { normalizeCedula } from '@/lib/excel';

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  const operator = await getOperatorFromCookie();
  if (!admin && !operator) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rawCedula = searchParams.get('cedula') ?? '';
  const jornadaId = searchParams.get('jornadaId') ?? '';

  const cedula = normalizeCedula(rawCedula);
  if (!cedula) return NextResponse.json({ error: 'Cédula requerida' }, { status: 400 });

  // If no jornadaId, search in active jornada
  let targetJornadaId = jornadaId;
  if (!targetJornadaId) {
    const activeJornada = await prisma.jornada.findFirst({ where: { status: 'ACTIVA' } });
    if (!activeJornada) {
      return NextResponse.json({
        found: false,
        message: 'No hay jornada habilitada en este momento. Contacte al administrador.',
      });
    }
    targetJornadaId = activeJornada.id;
  }

  const beneficiary = await prisma.beneficiary.findFirst({
    where: { cedula, jornadaId: targetJornadaId },
    include: {
      delivery: {
        select: { id: true, serverTimestamp: true, operatorId: true },
      },
    },
  });

  if (!beneficiary) {
    return NextResponse.json({
      found: false,
      message: 'Beneficiario no encontrado. Verifique el número de cédula digitado.',
    });
  }

  return NextResponse.json({
    found: true,
    beneficiary: {
      id: beneficiary.id,
      fullName: beneficiary.fullName,
      cedula: beneficiary.cedula,
      jornadaId: beneficiary.jornadaId,
    },
    hasDelivery: !!beneficiary.delivery,
    deliveryId: beneficiary.delivery?.id ?? null,
  });
}
