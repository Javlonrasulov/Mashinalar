import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function isPrismaUniqueViolation(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002');
}

/** Mashina bo‘yicha barcha kunlik KM yozuvlaridan eng yuqori o‘qish (bitta hisobotni chiqarib tashlash — kun boshini qayta yozish). */
async function maxRecordedOdometerKm(
  prisma: PrismaService,
  vehicleId: string,
  excludeReportId: string | null,
  baselineMin: number,
): Promise<number> {
  let maxKm = baselineMin;
  const rows = await prisma.dailyKmReport.findMany({
    where: {
      vehicleId,
      ...(excludeReportId ? { NOT: { id: excludeReportId } } : {}),
    },
    select: { startKm: true, endKm: true },
  });
  for (const r of rows) {
    const s = Number(r.startKm);
    if (Number.isFinite(s)) maxKm = Math.max(maxKm, s);
    if (r.endKm != null) {
      const e = Number(r.endKm);
      if (Number.isFinite(e)) maxKm = Math.max(maxKm, e);
    }
  }
  return maxKm;
}

@Injectable()
export class DailyKmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Haydovchi o‘zining so‘nggi kunlik KM yozuvlari */
  async findMine(driverId: string, limitRaw?: string) {
    const n = limitRaw != null && limitRaw !== '' ? Number(limitRaw) : 31;
    const take = Number.isFinite(n) && n > 0 && n <= 90 ? Math.floor(n) : 31;
    const rows = await this.prisma.dailyKmReport.findMany({
      where: { driverId },
      orderBy: { reportDate: 'desc' },
      take,
      select: {
        id: true,
        reportDate: true,
        startKm: true,
        endKm: true,
        startRecordedAt: true,
        endRecordedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      reportDate: r.reportDate.toISOString(),
      startKm: String(r.startKm),
      endKm: r.endKm == null ? null : String(r.endKm),
      startRecordedAt: r.startRecordedAt?.toISOString() ?? null,
      endRecordedAt: r.endRecordedAt?.toISOString() ?? null,
    }));
  }

  findAll(params?: { date?: string }) {
    const where =
      params?.date != null && params.date !== ''
        ? (() => {
            const d = new Date(params.date!);
            if (Number.isNaN(d.getTime())) return undefined;
            d.setUTCHours(0, 0, 0, 0);
            const next = new Date(d);
            next.setUTCDate(next.getUTCDate() + 1);
            return { reportDate: { gte: d, lt: next } };
          })()
        : undefined;
    return this.prisma.dailyKmReport.findMany({
      where,
      orderBy: { reportDate: 'desc' },
      include: { vehicle: true, driver: true },
    });
  }

  async submitDayStart(params: {
    driverId: string;
    reportDate: string;
    startKm: number;
    startOdometerUrl?: string;
    startLatitude?: number;
    startLongitude?: number;
    recordedAtIso?: string;
    actorUserId: string;
  }) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: params.driverId },
      include: { vehicle: true },
    });
    if (!driver?.vehicleId || !driver.vehicle) throw new BadRequestException('daily_km.no_vehicle');
    const minKm = Number(driver.vehicle.initialKm);
    if (!Number.isFinite(minKm)) throw new BadRequestException('daily_km.invalid_vehicle_baseline');
    if (params.startKm < minKm) {
      throw new BadRequestException(`daily_km.start_below_initial|${minKm}`);
    }
    if (!params.startOdometerUrl) throw new BadRequestException('daily_km.start_odo_required');

    const reportDate = new Date(params.reportDate);
    reportDate.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(reportDate.getTime())) throw new BadRequestException('daily_km.invalid_report_date');

    const startRecordedAt = params.recordedAtIso ? new Date(params.recordedAtIso) : new Date();
    if (Number.isNaN(startRecordedAt.getTime())) throw new BadRequestException('daily_km.invalid_recorded_at_start');

    const existing = await this.prisma.dailyKmReport.findUnique({
      where: { vehicleId_reportDate: { vehicleId: driver.vehicleId, reportDate } },
    });

    const maxRecorded = await maxRecordedOdometerKm(
      this.prisma,
      driver.vehicleId,
      existing?.id ?? null,
      minKm,
    );
    if (params.startKm < maxRecorded) {
      throw new BadRequestException(`daily_km.start_below_max|${maxRecorded}`);
    }

    if (existing?.endKm != null) {
      throw new ConflictException('daily_km.report_day_closed');
    }

    const updateStart = async (id: string) =>
      this.prisma.dailyKmReport.update({
        where: { id },
        data: {
          startKm: params.startKm,
          startOdometerUrl: params.startOdometerUrl ?? undefined,
          startLatitude: params.startLatitude ?? null,
          startLongitude: params.startLongitude ?? null,
          startRecordedAt,
        },
        include: { vehicle: true, driver: true },
      });

    if (existing) {
      const row = await updateStart(existing.id);
      await this.audit.log({
        actorUserId: params.actorUserId,
        action: 'dailyKm.start',
        entity: 'DailyKmReport',
        entityId: row.id,
      });
      return row;
    }

    let row;
    try {
      row = await this.prisma.dailyKmReport.create({
        data: {
          vehicleId: driver.vehicleId,
          driverId: params.driverId,
          reportDate,
          startKm: params.startKm,
          endKm: null,
          startOdometerUrl: params.startOdometerUrl,
          startLatitude: params.startLatitude ?? null,
          startLongitude: params.startLongitude ?? null,
          startRecordedAt,
        },
        include: { vehicle: true, driver: true },
      });
    } catch (e: unknown) {
      if (!isPrismaUniqueViolation(e)) throw e;
      const again = await this.prisma.dailyKmReport.findUnique({
        where: { vehicleId_reportDate: { vehicleId: driver.vehicleId, reportDate } },
      });
      if (again?.endKm != null) {
        throw new ConflictException('daily_km.report_day_closed');
      }
      if (!again) throw e;
      row = await updateStart(again.id);
    }

    await this.audit.log({
      actorUserId: params.actorUserId,
      action: 'dailyKm.start',
      entity: 'DailyKmReport',
      entityId: row.id,
    });
    return row;
  }

  async submitDayEnd(params: {
    reportId: string;
    driverId: string;
    endKm: number;
    endOdometerUrl?: string;
    endLatitude?: number;
    endLongitude?: number;
    recordedAtIso?: string;
    actorUserId: string;
  }) {
    const row = await this.prisma.dailyKmReport.findUnique({
      where: { id: params.reportId },
      include: { vehicle: true },
    });
    if (!row) throw new NotFoundException('daily_km.not_found');
    if (row.driverId !== params.driverId) throw new ForbiddenException('daily_km.forbidden_not_owner');
    if (row.endKm != null) throw new ConflictException('daily_km.end_already_submitted');
    const minKm = Number(row.vehicle.initialKm);
    if (!Number.isFinite(minKm)) throw new BadRequestException('daily_km.invalid_vehicle_baseline');
    const maxOthers = await maxRecordedOdometerKm(this.prisma, row.vehicleId, row.id, minKm);
    const minEndAllowed = Math.max(maxOthers, Number(row.startKm));
    if (params.endKm < minEndAllowed) {
      throw new BadRequestException(`daily_km.end_below_min|${minEndAllowed}`);
    }
    if (!params.endOdometerUrl) throw new BadRequestException('daily_km.end_odo_required');

    const endRecordedAt = params.recordedAtIso ? new Date(params.recordedAtIso) : new Date();
    if (Number.isNaN(endRecordedAt.getTime())) throw new BadRequestException('daily_km.invalid_recorded_at_end');

    const updated = await this.prisma.dailyKmReport.update({
      where: { id: params.reportId },
      data: {
        endKm: params.endKm,
        endOdometerUrl: params.endOdometerUrl,
        endLatitude: params.endLatitude ?? null,
        endLongitude: params.endLongitude ?? null,
        endRecordedAt,
      },
      include: { vehicle: true, driver: true },
    });
    await this.audit.log({
      actorUserId: params.actorUserId,
      action: 'dailyKm.end',
      entity: 'DailyKmReport',
      entityId: updated.id,
    });
    return updated;
  }
}
