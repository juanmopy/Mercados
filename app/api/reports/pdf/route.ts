export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { downloadFile } from '@/lib/supabase';
import { generateDeliveryPDF } from '@/lib/pdf';
import { logAudit, getClientInfo } from '@/lib/audit';
import { formatBogota } from '@/lib/timezone';

function dateBoundary(value: string, endOfDay = false): Date {
  const date = new Date(`${value}T00:00:00-05:00`);
  if (endOfDay) date.setTime(date.getTime() + 24 * 60 * 60 * 1000);
  return date;
}

function buildPdfWhere(jornadaId: string, searchParams: URLSearchParams) {
  const where: any = { jornadaId, photoPath: { not: '' } };
  const operatorId = searchParams.get('operatorId');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const cedulaFrom = searchParams.get('cedulaFrom');
  const cedulaTo = searchParams.get('cedulaTo');
  const cedulas = (searchParams.get('cedulas') ?? '').split(',').map((cedula) => cedula.trim()).filter(Boolean);

  if (operatorId) where.operatorId = operatorId;
  if (fromDate || toDate) {
    where.serverTimestamp = {};
    if (fromDate) where.serverTimestamp.gte = dateBoundary(fromDate);
    if (toDate) where.serverTimestamp.lt = dateBoundary(toDate, true);
  }
  if (cedulaFrom || cedulaTo || cedulas.length > 0) {
    const cedulaFilter: any = {};
    if (cedulaFrom) cedulaFilter.gte = cedulaFrom;
    if (cedulaTo) cedulaFilter.lte = cedulaTo;
    if (cedulas.length > 0) cedulaFilter.in = cedulas;
    where.beneficiary = { cedula: cedulaFilter };
  }

  return where;
}

function getPdfPagination(searchParams: URLSearchParams) {
  const requestedPart = Number.parseInt(searchParams.get('part') ?? '1', 10);
  const requestedPageSize = Number.parseInt(searchParams.get('pageSize') ?? '200', 10);

  return {
    part: Number.isFinite(requestedPart) && requestedPart > 0 ? requestedPart : 1,
    pageSize: Number.isFinite(requestedPageSize)
      ? Math.min(Math.max(requestedPageSize, 1), 200)
      : 200,
  };
}

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jornadaId = searchParams.get('jornadaId');
  if (!jornadaId) return NextResponse.json({ error: 'jornadaId requerido' }, { status: 400 });

  const jornada = await prisma.jornada.findUnique({ where: { id: jornadaId } });
  if (!jornada) return NextResponse.json({ error: 'Jornada no encontrada' }, { status: 404 });
  if (jornada.status !== 'CERRADA') {
    return NextResponse.json({ error: 'El PDF solo se puede generar con jornadas cerradas' }, { status: 400 });
  }

  try {
    const order = searchParams.get('order') ?? 'time';
    const { part, pageSize } = getPdfPagination(searchParams);
    const where = buildPdfWhere(jornadaId, searchParams);

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        beneficiary: { select: { fullName: true, cedula: true } },
      },
      orderBy: order === 'cedula'
        ? { beneficiary: { cedula: 'asc' } }
        : { serverTimestamp: 'asc' },
    });

    const totalItems = deliveries?.length ?? 0;
    const totalParts = Math.max(Math.ceil(totalItems / pageSize), 1);
    const startIndex = (part - 1) * pageSize;
    const pageDeliveries = (deliveries ?? []).slice(startIndex, startIndex + pageSize);

    // Download only the requested PDF part to keep memory bounded.
    const pdfItems: any[] = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < pageDeliveries.length; i += BATCH_SIZE) {
      const batch = pageDeliveries.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (d: any) => {
          try {
            const buffer = await downloadFile('delivery-photos', d.photoPath);
            return {
              id: d.id,
              beneficiaryName: d.beneficiary?.fullName ?? 'Sin nombre',
              beneficiaryCedula: d.beneficiary?.cedula ?? '',
              serverTimestamp: d.serverTimestamp,
              correctedTimestamp: d.correctedTimestamp,
              photoBuffer: buffer,
            };
          } catch { return null; }
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) pdfItems.push(r.value);
      }
    }

    const pdfBytes = await generateDeliveryPDF(pdfItems);

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'PDF_GENERATED',
      adminId: admin.adminId,
      jornadaId,
      detail: `PDF generado parte ${part} de ${totalParts} con ${pdfItems.length} entregas`,
      ipAddress,
      userAgent,
    });

    const fileName = `jornada_${(jornada.description ?? 'reporte').replace(/\s+/g, '_')}_${formatBogota(jornada.officialDate, 'yyyy-MM-dd')}_parte_${part}_de_${totalParts}.pdf`;
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'X-PDF-Part': String(part),
        'X-PDF-Total-Parts': String(totalParts),
        'X-PDF-Total-Items': String(totalItems),
      },
    });
  } catch (e: any) {
    console.error('Error generando PDF:', e);
    return NextResponse.json({ error: 'Error generando PDF' }, { status: 500 });
  }
}
