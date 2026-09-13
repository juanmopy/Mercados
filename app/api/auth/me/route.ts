export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromCookie, getOperatorFromCookie } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const admin = await getAdminFromCookie();
  if (admin) {
    return NextResponse.json({ type: 'admin', name: admin.name, email: admin.email, adminId: admin.adminId });
  }
  const operator = await getOperatorFromCookie();
  if (operator) {
    return NextResponse.json({ type: 'operator', name: operator.name, operatorId: operator.operatorId });
  }
  return NextResponse.json({ type: null }, { status: 401 });
}
