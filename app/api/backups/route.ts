export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { uploadBackup } from '@/lib/supabase';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function GET() {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const backups = await prisma.backup.findMany({
    orderBy: { createdAt: 'desc' },
    include: { jornada: { select: { description: true } } },
  });
  return NextResponse.json(backups);
}

export async function POST(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const jornadaId = (body as any)?.jornadaId ?? null;
    const trigger = (body as any)?.trigger ?? 'MANUAL';

    // Export data
    const where = jornadaId ? { id: jornadaId } : {};
    const jornadas = await prisma.jornada.findMany({
      where,
      include: {
        beneficiaries: true,
        deliveries: { include: { beneficiary: { select: { fullName: true, cedula: true } } } },
      },
    });

    const operators = await prisma.operator.findMany({
      select: { id: true, name: true, isActive: true, createdAt: true },
    });

    const backupData = JSON.stringify({
      version: '1.0',
      createdAt: new Date().toISOString(),
      jornadas,
      operators,
    }, null, 2);

    const timestamp = Date.now();
    const path = `backup_${timestamp}.json`;
    await uploadBackup(path, backupData);

    const backup = await prisma.backup.create({
      data: {
        jornadaId,
        storagePath: path,
        sizeBytes: Buffer.byteLength(backupData, 'utf-8'),
        createdByAdminId: admin.adminId,
        trigger,
      },
    });

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'BACKUP_CREATED',
      adminId: admin.adminId,
      jornadaId: jornadaId ?? undefined,
      detail: `Backup creado: ${path} (${trigger})`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(backup, { status: 201 });
  } catch (e: any) {
    console.error('Error creando backup:', e);
    return NextResponse.json({ error: 'Error creando backup' }, { status: 500 });
  }
}
