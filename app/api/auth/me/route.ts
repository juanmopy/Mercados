export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { getAdminFromCookie, getOperatorFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const admin = await getAdminFromCookie();
  if (admin) {
    return NextResponse.json({ type: 'admin', name: admin.name, email: admin.email, adminId: admin.adminId });
  }
  const operator = await getOperatorFromCookie();
  if (operator) {
    const activeJornada = await prisma.jornada.findFirst({
      where: { status: 'ACTIVA' },
      select: { id: true },
    });
    const deliveryCount = activeJornada
      ? await prisma.delivery.count({
          where: { operatorId: operator.operatorId, jornadaId: activeJornada.id },
        })
      : 0;

    return NextResponse.json({
      type: 'operator',
      name: operator.name,
      operatorId: operator.operatorId,
      deliveryCount,
    });
  }
  return NextResponse.json({ type: null }, { status: 401 });
}
