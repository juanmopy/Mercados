export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';
import { normalizeCedula, normalizeName } from '@/lib/excel';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const jornada = await prisma.jornada.findUnique({ where: { id } });
  if (!jornada) return NextResponse.json({ error: 'Jornada no encontrada' }, { status: 404 });
  if (jornada.status !== 'CONFIGURADA' && jornada.status !== 'REABIERTA') {
    return NextResponse.json({ error: 'Solo se pueden agregar beneficiarios en jornadas configuradas o reabiertas' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const fullName = normalizeName(body?.fullName);
    const cedula = normalizeCedula(body?.cedula);

    if (!fullName || !cedula) {
      return NextResponse.json({ error: 'Nombre completo y cédula son requeridos' }, { status: 400 });
    }
    if (cedula.length < 5 || cedula.length > 12) {
      return NextResponse.json({ error: 'La cédula debe tener entre 5 y 12 dígitos' }, { status: 400 });
    }

    const beneficiary = await prisma.beneficiary.create({
      data: { fullName, cedula, jornadaId: id },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'BENEFICIARY_CREATED_MANUALLY',
      entityType: 'Beneficiary',
      entityId: beneficiary.id,
      adminId: admin.adminId,
      jornadaId: id,
      detail: `Beneficiario agregado manualmente: ${fullName} (CC ${cedula})`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(beneficiary, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un beneficiario con esa cédula en esta jornada' }, { status: 409 });
    }
    console.error('Error agregando beneficiario:', error);
    return NextResponse.json({ error: 'Error agregando beneficiario' }, { status: 500 });
  }
}
