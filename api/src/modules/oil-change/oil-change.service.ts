import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type OilUrgency = 'unknown' | 'ok' | 'soon' | 'overdue';

@Injectable()
export class OilChangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Kunlik KM yozuvlaridan taxminiy joriy odometr (oxirgi endKm / startKm). */
  async estimateOdometerKm(vehicleId: string): Promise<number> {
    const v = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!v) return 0;
    let max = Number(v.initialKm);
    const reports = await this.prisma.dailyKmReport.findMany({
      where: { vehicleId },
      orderBy: [{ reportDate: 'desc' }],
      take: 120,
    });
    for (const r of reports) {
      max = Math.max(max, Number(r.startKm));
      if (r.endKm != null) max = Math.max(max, Number(r.endKm));
    }
    return max;
  }

  static urgency(kmRemaining: number | null, intervalKm: number | null): OilUrgency {
    if (kmRemaining === null) return 'unknown';
    if (kmRemaining < 0) return 'overdue';
    const warn =
      intervalKm != null && intervalKm > 0
        ? Math.min(500, Math.max(150, Math.round(intervalKm * 0.12)))
        : 400;
    if (kmRemaining <= warn) return 'soon';
    return 'ok';
  }

  async createFromDriver(params: {
    driverId: string;
    kmAtChange: number;
    photoUrl?: string | null;
    actorUserId: string;
  }) {
    const { driverId, kmAtChange, photoUrl, actorUserId } = params;
    if (!Number.isFinite(kmAtChange) || kmAtChange <= 0) {
      throw new BadRequestException('oil_change.invalid_km_at_change');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { vehicle: true },
    });
    if (!driver?.vehicleId || !driver.vehicle) {
      throw new BadRequestException('oil_change.no_vehicle');
    }
    const vehicle = driver.vehicle;
    const prevLast = vehicle.lastOilChangeKm != null ? Number(vehicle.lastOilChangeKm) : null;

    const row = await this.prisma.oilChangeReport.create({
      data: {
        vehicleId: vehicle.id,
        driverId,
        kmAtChange,
        photoUrl: photoUrl ?? null,
      },
    });

    // Moy almashtirishni "orqaga" kiritishga ruxsat beriladi (masalan, haydovchi keyinroq yozadi).
    // Lekin `lastOilChangeKm/At` ni faqat yangi yozuv haqiqatdan ham eng so‘nggi bo‘lsa yangilaymiz.
    const shouldUpdateVehicle = prevLast == null || kmAtChange > prevLast;
    if (shouldUpdateVehicle) {
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          lastOilChangeKm: kmAtChange,
          lastOilChangeAt: new Date(),
        },
      });
    }

    await this.audit.log({
      actorUserId,
      action: 'oilChange.create',
      entity: 'OilChangeReport',
      entityId: row.id,
      meta: { vehicleId: vehicle.id, kmAtChange },
    });

    return {
      id: row.id,
      vehicleId: row.vehicleId,
      driverId: row.driverId,
      kmAtChange: String(row.kmAtChange),
      photoUrl: row.photoUrl,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async findMine(driverId: string, limitRaw?: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver?.vehicleId) return [];
    const n = limitRaw != null && limitRaw !== '' ? Number(limitRaw) : 50;
    const take = Number.isFinite(n) && n > 0 && n <= 100 ? Math.floor(n) : 50;
    const rows = await this.prisma.oilChangeReport.findMany({
      where: { vehicleId: driver.vehicleId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { driver: { include: { user: { select: { login: true } } } } },
    });
    return rows.map((r) => ({
      id: r.id,
      kmAtChange: String(r.kmAtChange),
      photoUrl: r.photoUrl,
      createdAt: r.createdAt.toISOString(),
      driverLogin: r.driver.user.login,
    }));
  }

  async adminOverview() {
    const vehicles = await this.prisma.vehicle.findMany({
      orderBy: { plateNumber: 'asc' },
      include: {
        drivers: { take: 1, include: { user: { select: { login: true } } } },
      },
    });

    const out = [];
    for (const v of vehicles) {
      const est = await this.estimateOdometerKm(v.id);
      const lastOil = v.lastOilChangeKm != null ? Number(v.lastOilChangeKm) : null;
      const interval = v.oilChangeIntervalKm ?? null;
      const nextOilKm =
        lastOil !== null && interval != null && interval > 0 ? lastOil + interval : null;
      const kmRemaining = nextOilKm != null ? nextOilKm - est : null;
      const urgency = OilChangeService.urgency(kmRemaining, interval);
      const driverLogin = v.drivers[0]?.user?.login ?? null;
      out.push({
        vehicleId: v.id,
        name: v.name,
        plateNumber: v.plateNumber,
        driverLogin,
        lastOilChangeKm: lastOil,
        lastOilChangeAt: v.lastOilChangeAt ? v.lastOilChangeAt.toISOString() : null,
        oilChangeIntervalKm: interval,
        nextOilChangeKm: nextOilKm,
        estimatedCurrentKm: est,
        kmRemainingToNext: kmRemaining,
        oilUrgency: urgency,
      });
    }
    return out;
  }

  async adminListReports(limitRaw?: string) {
    const n = limitRaw != null && limitRaw !== '' ? Number(limitRaw) : 100;
    const take = Number.isFinite(n) && n > 0 && n <= 200 ? Math.floor(n) : 100;
    const rows = await this.prisma.oilChangeReport.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        vehicle: { select: { plateNumber: true, name: true } },
        driver: { include: { user: { select: { login: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      kmAtChange: String(r.kmAtChange),
      photoUrl: r.photoUrl,
      createdAt: r.createdAt.toISOString(),
      plateNumber: r.vehicle.plateNumber,
      vehicleName: r.vehicle.name,
      driverLogin: r.driver.user.login,
    }));
  }

}
