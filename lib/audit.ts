import { prisma } from './prisma';

interface AuditParams {
  actionType: string;
  entityType?: string;
  entityId?: string;
  detail?: string;
  adminId?: string;
  operatorId?: string;
  jornadaId?: string;
  deliveryId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actionType: params.actionType,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        detail: params.detail ?? null,
        adminId: params.adminId ?? null,
        operatorId: params.operatorId ?? null,
        jornadaId: params.jornadaId ?? null,
        deliveryId: params.deliveryId ?? null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (e) {
    console.error('Error registrando auditoría:', e);
  }
}

export function getClientInfo(request: Request): { ipAddress: string; userAgent: string } {
  const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  return { ipAddress, userAgent };
}
