import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class FuelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(params?: { date?: string }) {
    const date = params?.date?.trim();
    let createdAt: { gte: Date; lt: Date } | undefined;
    if (date) {
      // Expecting YYYY-MM-DD in local timezone (admin UI).
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d = Number(m[3]);
        const start = new Date(y, mo - 1, d, 0, 0, 0, 0);
        const end = new Date(y, mo - 1, d + 1, 0, 0, 0, 0);
        createdAt = { gte: start, lt: end };
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
