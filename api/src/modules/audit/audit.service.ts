import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    actorUserId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    meta?: Record<string, unknown>;
    ip?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? undefined,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? undefined,
        meta: params.meta as object | undefined,
        ip: params.ip ?? undefined,
      },
    });
  }
}
