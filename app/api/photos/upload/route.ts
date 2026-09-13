export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getOperatorFromCookie } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadPhoto } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const operator = await getOperatorFromCookie();
  if (!operator) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    const deviceTimestamp = formData.get('deviceTimestamp') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'Para completar la entrega se requiere una fotografía válida del adulto mayor con el mercado.' }, { status: 400 });
    }

    // Verify active jornada
    const activeJornada = await prisma.jornada.findFirst({ where: { status: 'ACTIVA' } });
    if (!activeJornada) {
      return NextResponse.json({ error: 'No hay jornada habilitada en este momento.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const path = `jornada_${activeJornada.id}/temp_${operator.operatorId}_${timestamp}.jpg`;

    await uploadPhoto('delivery-photos', path, buffer, 'image/jpeg');

    return NextResponse.json({
      photoPath: path,
      uploadedAt: new Date().toISOString(),
      jornadaId: activeJornada.id,
      deviceTimestamp: deviceTimestamp ?? null,
    });
  } catch (e: any) {
    console.error('Error subiendo foto:', e);
    return NextResponse.json({ error: 'No fue posible registrar la entrega. Revise la conexión e intente nuevamente. La información no se guardó.' }, { status: 500 });
  }
}
