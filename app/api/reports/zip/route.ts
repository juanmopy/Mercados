export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { downloadFile } from '@/lib/supabase';
import { generatePhotosZIP } from '@/lib/zip';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jornadaId = searchParams.get('jornadaId');
  if (!jornadaId) return NextResponse.json({ error: 'jornadaId requerido' }, { status: 400 });

  const jornada = await prisma.jornada.findUnique({ where: { id: jornadaId } });
  if (!jornada) return NextResponse.json({ error: 'Jornada no encontrada' }, { status: 404 });
  if (jornada.status !== 'CERRADA') {
    return NextResponse.json({ error: 'El ZIP solo se puede generar con jornadas cerradas' }, { status: 400 });
  }

  try {
    const deliveries = await prisma.delivery.findMany({
      where: { jornadaId },
      include: {
        beneficiary: { select: { fullName: true, cedula: true } },
      },
    });

    const zipItems: any[] = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < (deliveries?.length ?? 0); i += BATCH_SIZE) {
      const batch = (deliveries ?? []).slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (d: any) => {
          const buffer = await downloadFile('delivery-photos', d.photoPath);
          return {
            cedula: d.beneficiary?.cedula ?? '',
            fullName: d.beneficiary?.fullName ?? '',
            photoBuffer: buffer,
          };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') zipItems.push(r.value);
      }
    }

    const zipBuffer = await generatePhotosZIP(zipItems);

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'ZIP_DOWNLOADED',
      adminId: admin.adminId,
      jornadaId,
      detail: `ZIP generado con ${zipItems.length} fotos`,
      ipAddress,
      userAgent,
    });

    const fileName = `fotos_jornada_${(jornada.description ?? '').replace(/\s+/g, '_')}.zip`;
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e: any) {
    console.error('Error generando ZIP:', e);
    return NextResponse.json({ error: 'Error generando ZIP' }, { status: 500 });
  }
}
