export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie, hashOperatorCode } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';
import crypto from 'node:crypto';

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const operators = await prisma.operator.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      failedAttempts: true,
      blockedUntil: true,
      createdAt: true,
      _count: { select: { deliveries: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(operators);
}

export async function POST(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json();
    const { name } = body ?? {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'El nombre del operador es requerido' }, { status: 400 });
    }

    let code = '';
    let codeHash = '';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      code = crypto.randomInt(0, 10000).toString().padStart(4, '0');
      codeHash = hashOperatorCode(code);
      const existing = await prisma.operator.findUnique({ where: { codeHash } });
      if (!existing) break;
      code = '';
    }
    if (!code || !codeHash) {
      return NextResponse.json({ error: 'No fue posible generar un código disponible' }, { status: 409 });
    }

    const op = await prisma.operator.create({
      data: { name, codeHash },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'OPERATOR_CREATED',
      entityType: 'Operator',
      entityId: op.id,
      adminId: admin.adminId,
      detail: `Operador creado: ${name}`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ id: op.id, name: op.name, code }, { status: 201 });
  } catch (e: any) {
    console.error('Error creando operador:', e);
    return NextResponse.json({ error: 'Error creando operador' }, { status: 500 });
  }
}
