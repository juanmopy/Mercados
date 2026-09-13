export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookie, hashOperatorCode } from '@/lib/auth';
import { logAudit, getClientInfo } from '@/lib/audit';
import crypto from 'node:crypto';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminFromCookie();
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const op = await prisma.operator.findUnique({ where: { id } });
  if (!op) return NextResponse.json({ error: 'Operador no encontrado' }, { status: 404 });

  try {
    const body = await request.json();
    const { isActive, name, regenerateCode } = body ?? {};

    const updateData: any = {};
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (name) updateData.name = name;
    let generatedCode: string | null = null;
    if (regenerateCode === true) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = crypto.randomInt(0, 10000).toString().padStart(4, '0');
        const codeHash = hashOperatorCode(candidate);
        const existing = await prisma.operator.findUnique({ where: { codeHash } });
        if (!existing || existing.id === id) {
          generatedCode = candidate;
          updateData.codeHash = codeHash;
          break;
        }
      }
      if (!generatedCode) {
        return NextResponse.json({ error: 'No fue posible generar un código disponible' }, { status: 409 });
      }
    }

    const updated = await prisma.operator.update({ where: { id }, data: updateData });

    const { ipAddress, userAgent } = getClientInfo(request);
    await logAudit({
      actionType: generatedCode ? 'OPERATOR_CODE_REGENERATED' : 'OPERATOR_UPDATED',
      entityType: 'Operator',
      entityId: id,
      adminId: admin.adminId,
      detail: `Operador actualizado: ${op.name}`,
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ id: updated.id, name: updated.name, isActive: updated.isActive, code: generatedCode });
  } catch (e: any) {
    console.error('Error actualizando operador:', e);
    return NextResponse.json({ error: 'Error actualizando operador' }, { status: 500 });
  }
}
