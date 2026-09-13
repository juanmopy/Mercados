export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashOperatorCode, createOperatorToken } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body ?? {};

    if (!code || typeof code !== 'string' || code.length !== 4 || !/^\d{4}$/.test(code)) {
      return NextResponse.json({ error: 'Código debe ser de 4 dígitos numéricos' }, { status: 400 });
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    const loginAttemptKey = `${ipAddress}|${userAgent}`;
    const now = new Date();
    const loginAttempt = await prisma.operatorLoginAttempt.findUnique({ where: { key: loginAttemptKey } });

    if (loginAttempt?.blockedUntil && loginAttempt.blockedUntil > now) {
      return NextResponse.json({ error: 'La cuenta fue bloqueada por intentos fallidos. Solicite desbloqueo al administrador.' }, { status: 403 });
    }

    const codeHash = hashOperatorCode(code);

    const operator = await prisma.operator.findUnique({ where: { codeHash } });

    if (!operator) {
      const failedAttempts = (loginAttempt?.failedAttempts ?? 0) + 1;
      await prisma.operatorLoginAttempt.upsert({
        where: { key: loginAttemptKey },
        create: {
          key: loginAttemptKey,
          failedAttempts,
          blockedUntil: failedAttempts >= 3 ? new Date(now.getTime() + 15 * 60 * 1000) : null,
        },
        update: {
          failedAttempts,
          blockedUntil: failedAttempts >= 3 ? new Date(now.getTime() + 15 * 60 * 1000) : null,
        },
      });
      await logAudit({ actionType: 'OPERATOR_LOGIN_FAILED', detail: 'Código no encontrado', ipAddress, userAgent });
      const remaining = Math.max(0, 3 - failedAttempts);
      return NextResponse.json({ error: remaining > 0 ? `Código incorrecto. Intentos restantes: ${remaining} de 3.` : 'La cuenta fue bloqueada por intentos fallidos. Solicite desbloqueo al administrador.' }, { status: 401 });
    }

    if (!operator.isActive) {
      return NextResponse.json({ error: 'La cuenta está desactivada. Contacte al administrador.' }, { status: 403 });
    }

    // Check if blocked
    if (operator.blockedUntil && new Date(operator.blockedUntil) > new Date()) {
      return NextResponse.json({ error: 'La cuenta fue bloqueada por intentos fallidos. Solicite desbloqueo al administrador.' }, { status: 403 });
    }

    // Reset failed attempts on successful login
    await prisma.operator.update({
      where: { id: operator.id },
      data: { failedAttempts: 0, blockedUntil: null },
    });
    await prisma.operatorLoginAttempt.deleteMany({ where: { key: loginAttemptKey } });

    const token = await createOperatorToken(operator);
    await logAudit({ actionType: 'OPERATOR_LOGIN', operatorId: operator.id, ipAddress, userAgent });

    // Get active jornada
    const activeJornada = await prisma.jornada.findFirst({
      where: { status: 'ACTIVA' },
      select: { id: true, description: true },
    });

    // Get delivery count for this operator in active jornada
    let deliveryCount = 0;
    if (activeJornada) {
      deliveryCount = await prisma.delivery.count({
        where: { operatorId: operator.id, jornadaId: activeJornada.id },
      });
    }

    const response = NextResponse.json({
      success: true,
      name: operator.name,
      operatorId: operator.id,
      activeJornada: activeJornada ?? null,
      deliveryCount,
    });
    response.cookies.set('operator_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (e: any) {
    console.error('Error en login operador:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Handle failed login separately for proper counting
export async function PUT(request: NextRequest) {
  // This is used for handling "wrong code" - we check all operators
  // Actually the main POST handles everything. This route unused.
  return NextResponse.json({ error: 'Método no permitido' }, { status: 405 });
}
