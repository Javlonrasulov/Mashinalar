import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../sessions/sessions.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionsService,
  ) {}

  async findAll() {
    const rows = await this.prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, login: true, role: true, createdAt: true },
        },
        vehicle: true,
      },
    });
    const userIds = rows.map((r) => r.userId);
    const counts = await this.sessions.countActiveByUserIds(userIds);
    return rows.map((r) => ({
      ...r,
      deviceCount: counts.get(r.userId) ?? 0,
    }));
  }

  async listSessions(driverId: string) {
    const d = await this.findOne(driverId);
    return this.sessions.listForUser(d.userId);
  }

  async revokeSession(
    driverId: string,
    sessionId: string,
    actorUserId: string,
  ) {
    const d = await this.findOne(driverId);
    await this.sessions.revokeOne(d.userId, sessionId);
    await this.audit.log({
      actorUserId,
      action: 'driver.session.revoke',
      entity: 'Driver',
      entityId: driverId,
      meta: { sessionId },
    });
    return { ok: true };
  }

  async revokeAllSessions(driverId: string, actorUserId: string) {
    const d = await this.findOne(driverId);
    await this.sessions.revokeAllForUser(d.userId);
    await this.audit.log({
      actorUserId,
      action: 'driver.session.revokeAll',
      entity: 'Driver',
      entityId: driverId,
    });
    return { ok: true };
  }

  async findOne(id: string) {
    const d = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, login: true, role: true } },
        vehicle: true,
      },
    });
    if (!d) throw new NotFoundException('Driver not found');
    return d;
  }

  async create(dto: CreateDriverDto, actorUserId: string) {
    const login = dto.login.trim().toLowerCase();
    const exists = await this.prisma.user.findFirst({
      where: { login: { equals: login, mode: 'insensitive' } },
      select: { id: true },
    });
    if (exists) throw new ConflictException('Login already taken');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const driver = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          login,
          passwordHash,
          role: UserRole.DRIVER,
        },
      });
      return tx.driver.create({
        data: {
          userId: user.id,
          fullName: dto.fullName,
          phone: dto.phone,
          vehicleId: dto.vehicleId,
        },
        include: {
          user: { select: { id: true, login: true, role: true } },
          vehicle: true,
        },
      });
    });

    await this.audit.log({
      actorUserId,
      action: 'driver.create',
      entity: 'Driver',
      entityId: driver.id,
      meta: { login },
    });
    return driver;
  }

  async update(id: string, dto: UpdateDriverDto, actorUserId: string) {
    await this.findOne(id);
    const driver = await this.prisma.driver.findUniqueOrThrow({
      where: { id },
    });

    if (dto.password) {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      await this.prisma.user.update({
        where: { id: driver.userId },
        data: { passwordHash },
      });
    }

    const updated = await this.prisma.driver.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        vehicleId: dto.vehicleId === undefined ? undefined : dto.vehicleId,
      },
      include: {
        user: { select: { id: true, login: true, role: true } },
        vehicle: true,
      },
    });

    await this.audit.log({
      actorUserId,
      action: 'driver.update',
      entity: 'Driver',
      entityId: id,
    });
    return updated;
  }

  async remove(id: string, actorUserId: string) {
    const d = await this.findOne(id);
    await this.prisma.user.delete({ where: { id: d.userId } });
    await this.audit.log({
      actorUserId,
      action: 'driver.delete',
      entity: 'Driver',
      entityId: id,
    });
    return { ok: true };
  }
}
