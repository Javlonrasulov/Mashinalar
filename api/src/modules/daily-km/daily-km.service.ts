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

/**
 * Shu kun (`reportDate`) dan oldingi eng so‘nggi kunlik yozuv bo‘yicha minimal boshlash KM:
 * `max(initialKm, oldingi yozuvning yakuniy KM yoki yakuni yo‘q bo‘lsa boshlanish KM)`.
 * Global tarixdagi eski/noto‘g‘ri yuqori qiymatlar bugungi 200 kabi qonuniy o‘sishni bloklamasligi uchun.
 */
async function minStartKmFromChain(
  prisma: PrismaService,
  vehicleId: string,
  dayStart: Date,
  initialKm: number,
): Promise<number> {
  const prev = await prisma.dailyKmReport.findFirst({
    where: { vehicleId, reportDate: { lt: dayStart } },
    orderBy: { reportDate: 'desc' },
    select: { startKm: true, endKm: true },
  });
  if (!prev) return initialKm;
  const end = prev.endKm != null ? Number(prev.endKm) : NaN;
  const st = Number(prev.startKm);
  const reading = Number.isFinite(end) ? end : st;
  if (!Number.isFinite(reading)) return initialKm;
  return Math.max(initialKm, reading);
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

  async findAll(params?: { date?: string }) {
    const dayStart =
      params?.date != null && params.date !== ''
        ? (() => {
            const d = new Date(params.date!);
            if (Number.isNaN(d.getTime())) return null;
            d.setUTCHours(0, 0, 0, 0);
            return d;
          })()
        : null;
    if (params?.date && dayStart == null) throw new BadRequestException('daily_km.invalid_report_date');

    const dayEnd =
      dayStart != null
        ? (() => {
            const next = new Date(dayStart);
            next.setUTCDate(next.getUTCDate() + 1);
            return next;
          })()
        : null;

    const rows = await this.prisma.dailyKmReport.findMany({
      where: dayStart != null ? { reportDate: { gte: dayStart, lt: dayEnd! } } : undefined,
      orderBy: { reportDate: 'desc' },
      select: {
        id: true,
        reportDate: true,
        startKm: true,
        endKm: true,
        startOdometerUrl: true,
        endOdometerUrl: true,
        startRecordedAt: true,
        endRecordedAt: true,
        startLatitude: true,
        startLongitude: true,
        endLatitude: true,
        endLongitude: true,
        vehicleId: true,
        vehicle: { select: { plateNumber: true } },
        driver: { select: { fullName: true } },
      },
    });

    const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
    const prevByVehicleId =
      dayStart != null && vehicleIds.length > 0
        ? await this.prisma.dailyKmReport.findMany({
            where: { vehicleId: { in: vehicleIds }, reportDate: { lt: dayStart }, endKm: { not: null } },
            orderBy: { reportDate: 'desc' },
            distinct: ['vehicleId'],
            select: { vehicleId: true, reportDate: true, endKm: true },
          })
        : [];

    const prevMap = new Map(prevByVehicleId.map((p) => [p.vehicleId, p]));

    return rows.map((r) => {
      const prev = prevMap.get(r.vehicleId);
      const startKmNum = Number(r.startKm);
      const prevEndNum = prev?.endKm != null ? Number(prev.endKm) : NaN;
      const gapNum =
        prev && Number.isFinite(startKmNum) && Number.isFinite(prevEndNum) ? startKmNum - prevEndNum : null;
      return {
        id: r.id,
        reportDate: r.reportDate.toISOString(),
        startKm: String(r.startKm),
        endKm: r.endKm == null ? null : String(r.endKm),
        startOdometerUrl: r.startOdometerUrl ?? null,
        endOdometerUrl: r.endOdometerUrl ?? null,
        startRecordedAt: r.startRecordedAt?.toISOString() ?? null,
        endRecordedAt: r.endRecordedAt?.toISOString() ?? null,
        startLatitude: r.startLatitude == null ? null : String(r.startLatitude),
        startLongitude: r.startLongitude == null ? null : String(r.startLongitude),
        endLatitude: r.endLatitude == null ? null : String(r.endLatitude),
        endLongitude: r.endLongitude == null ? null : String(r.endLongitude),
        vehicle: r.vehicle,
        driver: r.driver,
        /** Oldingi yopilgan hisobotdan farq (oraliq km). */
        gapKm: gapNum == null ? null : String(gapNum),
        gapFromReportDate: prev?.reportDate ? prev.reportDate.toISOString() : null,
        gapFromEndKm: prev?.endKm == null ? null : String(prev.endKm),
      };
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

    const minFromChain = await minStartKmFromChain(this.prisma, driver.vehicleId, reportDate, minKm);
    if (params.startKm < minFromChain) {
      throw new BadRequestException(`daily_km.start_below_max|${minFromChain}`);
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
    const minEndAllowed = Math.max(minKm, Number(row.startKm));
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
