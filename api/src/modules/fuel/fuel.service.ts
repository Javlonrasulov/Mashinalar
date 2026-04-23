import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FuelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Haydovchi o‘zining so‘nggi zapravka (fuel) yozuvlari */
  async findMine(driverId: string, limitRaw?: string) {
    const n = limitRaw != null && limitRaw !== '' ? Number(limitRaw) : 50;
    const take = Number.isFinite(n) && n > 0 && n <= 100 ? Math.floor(n) : 50;
    const rows = await this.prisma.fuelReport.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        vehiclePhotoUrl: true,
        receiptPhotoUrl: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      amount: String(r.amount),
      createdAt: r.createdAt.toISOString(),
      vehiclePhotoUrl: r.vehiclePhotoUrl ?? null,
      receiptPhotoUrl: r.receiptPhotoUrl ?? null,
    }));
  }

  findAll(params?: { date?: string; from?: string; to?: string }) {
    const date = params?.date?.trim();
    const fromRaw = params?.from?.trim();
    const toRaw = params?.to?.trim();

    let createdAt: { gte: Date; lt: Date } | undefined;

    // Preferred: explicit ISO range computed on the client (matches admin browser local day).
    if (fromRaw && toRaw) {
      const gte = new Date(fromRaw);
      const lt = new Date(toRaw);
      if (Number.isFinite(gte.getTime()) && Number.isFinite(lt.getTime()) && lt > gte) {
        createdAt = { gte, lt };
      }
    }

    // Fallback: calendar date string (UTC day boundaries; stable regardless of server TZ).
    if (!createdAt && date) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
          const start = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
          const end = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));
          createdAt = { gte: start, lt: end };
        }
      }
    }
    return this.prisma.fuelReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: { vehicle: true, driver: true },
      where: createdAt ? { createdAt } : undefined,
    });
  }

  async createFromDriver(params: {
    driverId: string;
    amount: number;
    vehiclePhotoUrl?: string;
    receiptPhotoUrl?: string;
    latitude?: number;
    longitude?: number;
    actorUserId: string;
  }) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: params.driverId },
      include: { vehicle: true },
    });
    if (!driver?.vehicleId) throw new BadRequestException('No vehicle assigned');

    const row = await this.prisma.fuelReport.create({
      data: {
        vehicleId: driver.vehicleId,
        driverId: params.driverId,
        amount: params.amount,
        vehiclePhotoUrl: params.vehiclePhotoUrl,
        receiptPhotoUrl: params.receiptPhotoUrl,
        latitude: params.latitude,
        longitude: params.longitude,
      },
      include: { vehicle: true, driver: true },
    });

    await this.prisma.expense.create({
      data: {
        vehicleId: driver.vehicleId,
        type: 'FUEL',
        amount: params.amount,
        note: `Fuel report ${row.id}`,
        spentAt: row.createdAt,
      },
    });

    await this.audit.log({
      actorUserId: params.actorUserId,
      action: 'fuel.create',
      entity: 'FuelReport',
      entityId: row.id,
    });
    return row;
  }
}
