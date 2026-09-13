export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { formatBogota } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jornadaId = searchParams.get('jornadaId');

  if (!jornadaId) {
    return NextResponse.json({ error: 'jornadaId requerido' }, { status: 400 });
  }

  const [totalBeneficiaries, totalDeliveries, deliveriesByOperator, deliveriesByHour] = await Promise.all([
    prisma.beneficiary.count({ where: { jornadaId } }),
    prisma.delivery.count({ where: { jornadaId } }),
    prisma.delivery.groupBy({
      by: ['operatorId'],
      where: { jornadaId },
      _count: { id: true },
    }),
    prisma.delivery.findMany({
      where: { jornadaId },
      select: { serverTimestamp: true },
      orderBy: { serverTimestamp: 'asc' },
    }),
  ]);

  // Get operator names
  const operatorIds = (deliveriesByOperator ?? []).map((d: any) => d.operatorId);
  const operators = await prisma.operator.findMany({
    where: { id: { in: operatorIds } },
    select: { id: true, name: true },
  });
  const opMap = new Map((operators ?? []).map((o: any) => [o.id, o.name]));

  const byOperator = (deliveriesByOperator ?? []).map((d: any) => ({
    operatorId: d.operatorId,
    operatorName: opMap.get(d.operatorId) ?? 'Desconocido',
    count: d._count?.id ?? 0,
  }));

  // Group by hour
  const hourMap = new Map<string, number>();
  for (const d of (deliveriesByHour ?? [])) {
    const ts = new Date(d.serverTimestamp);
    const hour = formatBogota(ts, 'HH:00');
    hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
  }
  const byHour = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour.localeCompare(b.hour));

  const pending = totalBeneficiaries - totalDeliveries;
  const percentage = totalBeneficiaries > 0 ? Math.round((totalDeliveries / totalBeneficiaries) * 100) : 0;

  return NextResponse.json({
    totalBeneficiaries,
    totalDeliveries,
    pending,
    percentage,
    byOperator,
    byHour,
  });
}
