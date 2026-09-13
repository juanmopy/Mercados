export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, createAdminToken } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({ where: { email: email?.toLowerCase?.() ?? '' } });
    const { ipAddress, userAgent } = getClientInfo(request);

    if (!admin || !admin.isActive) {
      await logAudit({ actionType: 'ADMIN_LOGIN_FAILED', detail: `Intento con email: ${email}`, ipAddress, userAgent });
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    if (!comparePassword(password, admin.passwordHash)) {
      await logAudit({ actionType: 'ADMIN_LOGIN_FAILED', adminId: admin.id, detail: 'Contraseña incorrecta', ipAddress, userAgent });
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const token = await createAdminToken(admin);
    await logAudit({ actionType: 'ADMIN_LOGIN', adminId: admin.id, ipAddress, userAgent });

    const response = NextResponse.json({ success: true, name: admin.name });
    response.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (e: any) {
    console.error('Error en login admin:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
