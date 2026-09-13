export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  await prisma.operator.update({
    where: { id },
    data: { failedAttempts: 0, blockedUntil: null },
  });

  const { ipAddress, userAgent } = getClientInfo(request);
  await logAudit({
    actionType: 'OPERATOR_UNBLOCKED',
    entityType: 'Operator',
    entityId: id,
    adminId: admin.adminId,
    detail: `Operador desbloqueado`,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
}
