export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_session', '', { httpOnly: true, maxAge: 0, path: '/' });
  response.cookies.set('operator_session', '', { httpOnly: true, maxAge: 0, path: '/' });
  return response;
}
