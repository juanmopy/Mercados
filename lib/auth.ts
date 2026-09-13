import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'fallback-secret');

export interface AdminPayload extends JWTPayload {
  type: 'admin';
  adminId: string;
  email: string;
  name: string;
  lastActivity: number;
}

export interface OperatorPayload extends JWTPayload {
  type: 'operator';
  operatorId: string;
  name: string;
  lastActivity: number;
}

export async function createAdminToken(admin: { id: string; email: string; name: string }): Promise<string> {
  return new SignJWT({
    type: 'admin',
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    lastActivity: Date.now(),
  } as AdminPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function createOperatorToken(operator: { id: string; name: string }): Promise<string> {
  return new SignJWT({
    type: 'operator',
    operatorId: operator.id,
    name: operator.name,
    lastActivity: Date.now(),
  } as OperatorPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function getAdminFromCookie(): Promise<AdminPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session')?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload || (payload as any).type !== 'admin') return null;
    const adminPayload = payload as AdminPayload;
    // Check inactivity (8 hours for admin)
    const lastActivity = adminPayload.lastActivity ?? 0;
    if (Date.now() - lastActivity > 8 * 60 * 60 * 1000) return null;
    return adminPayload;
  } catch {
    return null;
  }
}

export async function getOperatorFromCookie(): Promise<OperatorPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('operator_session')?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload || (payload as any).type !== 'operator') return null;
    const opPayload = payload as OperatorPayload;
    // Check inactivity (30 min)
    const lastActivity = opPayload.lastActivity ?? 0;
    if (Date.now() - lastActivity > 30 * 60 * 1000) return null;
    return opPayload;
  } catch {
    return null;
  }
}

export async function refreshOperatorToken(payload: OperatorPayload): Promise<string> {
  return new SignJWT({
    ...payload,
    lastActivity: Date.now(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function hashOperatorCode(code: string): string {
  const salt = process.env.OPERATOR_CODE_SALT ?? 'default-salt';
  return crypto.createHash('sha256').update(code + salt).digest('hex');
}
