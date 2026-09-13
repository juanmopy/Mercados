export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie } from '@/lib/auth';
import { parseExcelFile } from '@/lib/excel';
import { logAudit, getClientInfo } from '@/lib/audit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const jornada = await prisma.jornada.findUnique({ where: { id } });
  if (!jornada) return NextResponse.json({ error: 'Jornada no encontrada' }, { status: 404 });
  if (jornada.status !== 'CONFIGURADA') {
    return NextResponse.json({ error: 'Solo se pueden importar beneficiarios en jornadas con estado CONFIGURADA' }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseExcelFile(buffer);

    // Check preview mode
    const mode = formData.get('mode') as string | null;
    if (mode === 'preview') {
      return NextResponse.json({
        valid: result.valid,
        errors: result.errors,
        duplicates: result.duplicates,
        totalValid: result.valid?.length ?? 0,
        totalErrors: result.errors?.length ?? 0,
      });
    }

    // Import mode - only if no blocking errors
    if ((result.errors?.length ?? 0) > 0) {
      return NextResponse.json({
        error: 'Hay errores en el archivo. Corríjalos antes de importar.',
        errors: result.errors,
        duplicates: result.duplicates,
      }, { status: 400 });
    }

    // Check existing beneficiaries to avoid duplicates with DB
    const existingCedulas = await prisma.beneficiary.findMany({
      where: { jornadaId: id },
      select: { cedula: true },
    });
    const existingSet = new Set((existingCedulas ?? []).map((b: any) => b.cedula));
    const newBeneficiaries = (result.valid ?? []).filter((b: any) => !existingSet.has(b.cedula));
    const skipped = (result.valid?.length ?? 0) - (newBeneficiaries?.length ?? 0);

    if (newBeneficiaries.length > 0) {
      await prisma.beneficiary.createMany({
        data: newBeneficiaries.map((b: any) => ({
          fullName: b.fullName,
          cedula: b.cedula,
          jornadaId: id,
        })),
        skipDuplicates: true,
      });
    }

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: 'EXCEL_IMPORTED',
      entityType: 'Jornada',
      entityId: id,
      adminId: admin.adminId,
      jornadaId: id,
      detail: `Importados ${newBeneficiaries.length} beneficiarios, ${skipped} ya existían`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      imported: newBeneficiaries.length,
      skipped,
      duplicatesInFile: result.duplicates,
    });
  } catch (e: any) {
    console.error('Error importando Excel:', e);
    return NextResponse.json({ error: 'Error procesando el archivo Excel' }, { status: 500 });
  }
}
