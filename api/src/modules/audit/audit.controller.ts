import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('take') take?: string) {
    const n = take ? Math.min(200, Math.max(1, Number(take))) : 50;
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Number.isFinite(n) ? n : 50,
      include: { actor: { select: { login: true, id: true } } },
    });
  }
}
