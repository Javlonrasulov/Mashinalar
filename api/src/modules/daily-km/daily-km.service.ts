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

  async findAll(params?: { date?: string; from?: string; to?: string }) {
    const parseDayUtc = (s: string): Date | null => {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      d.setUTCHours(0, 0, 0, 0);
      return d;
    };

    let fromD: Date | null = null;
    let toExclusive: Date | null = null;

    const hasRange =
      params?.from != null &&
      params.from !== '' &&
      params?.to != null &&
      params.to !== '';

    if (hasRange) {
      const a = parseDayUtc(params!.from!);
      const b = parseDayUtc(params!.to!);
      if (!a || !b) throw new BadRequestException('daily_km.invalid_report_date');
      if (a.getTime() > b.getTime()) throw new BadRequestException('daily_km.range_invalid');
      const spanDays = Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      if (spanDays > 366) throw new BadRequestException('daily_km.range_too_wide');
      fromD = a;
      toExclusive = new Date(b);
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    } else if (params?.date != null && params.date !== '') {
      const d = parseDayUtc(params.date);
      if (!d) throw new BadRequestException('daily_km.invalid_report_date');
      fromD = d;
      toExclusive = new Date(d);
      toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    }

    const selectFull = {
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
    } as const;

    if (fromD == null || toExclusive == null) {
      const rows = await this.prisma.dailyKmReport.findMany({
        where: undefined,
        orderBy: { reportDate: 'desc' },
        select: selectFull,
      });
      return rows.map((r) => ({
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
        gapKm: null as string | null,
        gapFromReportDate: null as string | null,
        gapFromEndKm: null as string | null,
      }));
    }

    const rows = await this.prisma.dailyKmReport.findMany({
      where: { reportDate: { gte: fromD, lt: toExclusive } },
      orderBy: [{ reportDate: 'desc' }, { vehicleId: 'asc' }],
      select: selectFull,
    });

    const vehicleIds = Array.from(new Set(rows.map((r) => r.vehicleId)));
    const lookback = new Date(fromD);
    lookback.setUTCDate(lookback.getUTCDate() - 400);

    const beforeRows =
      vehicleIds.length > 0
        ? await this.prisma.dailyKmReport.findMany({
            where: { vehicleId: { in: vehicleIds }, reportDate: { gte: lookback, lt: fromD } },
            select: { id: true, vehicleId: true, reportDate: true, startKm: true, endKm: true },
            orderBy: [{ vehicleId: 'asc' }, { reportDate: 'asc' }],
          })
        : [];

    const inRangeSlim = rows.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      reportDate: r.reportDate,
      startKm: r.startKm,
      endKm: r.endKm,
    }));

    type ChainRow = (typeof inRangeSlim)[number];
    const byVehicle = new Map<string, ChainRow[]>();
    for (const r of beforeRows) {
      if (!byVehicle.has(r.vehicleId)) byVehicle.set(r.vehicleId, []);
      byVehicle.get(r.vehicleId)!.push({
        id: r.id,
        vehicleId: r.vehicleId,
        reportDate: r.reportDate,
        startKm: r.startKm,
        endKm: r.endKm,
      });
    }
    for (const r of inRangeSlim) {
      if (!byVehicle.has(r.vehicleId)) byVehicle.set(r.vehicleId, []);
      byVehicle.get(r.vehicleId)!.push(r);
    }

    const gapMeta = new Map<string, { gapKm: string | null; gapFromReportDate: string | null; gapFromEndKm: string | null }>();

    for (const vid of vehicleIds) {
      const hist = (byVehicle.get(vid) ?? []).sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime());
      let prevClosedEnd: number | null = null;
      let prevReportDate: Date | null = null;
      let prevEndKmStr: string | null = null;
      for (const r of hist) {
        const inWindow = r.reportDate >= fromD && r.reportDate < toExclusive;
        const startNum = Number(r.startKm);
        let gapNum: number | null = null;
        if (prevClosedEnd != null && Number.isFinite(startNum)) {
          gapNum = Math.max(0, startNum - prevClosedEnd);
        }
        if (inWindow) {
          gapMeta.set(r.id, {
            gapKm: gapNum == null ? null : String(gapNum),
            gapFromReportDate: prevReportDate ? prevReportDate.toISOString() : null,
            gapFromEndKm: prevEndKmStr,
          });
        }
        if (r.endKm != null) {
          const e = Number(r.endKm);
          if (Number.isFinite(e)) {
            prevClosedEnd = e;
            prevReportDate = r.reportDate;
            prevEndKmStr = String(r.endKm);
          }
        }
      }
    }

    return rows.map((r) => {
      const g = gapMeta.get(r.id);
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
        gapKm: g?.gapKm ?? null,
        gapFromReportDate: g?.gapFromReportDate ?? null,
        gapFromEndKm: g?.gapFromEndKm ?? null,
      };
    });
  }

  /**
   * Admin: sanalar oralig‘ida har bir kun uchun «oldingi yopilgan тугаш KM» → «shu kun бошланиш KM» farqi.
   * Oldingi kun yopilmagan bo‘lsa (endKm null), keyingi kun uchun farq hisoblanmaydi (null).
   */
  async findGapAudit(params: { from: string; to: string }) {
    const fromD = new Date(params.from);
    const toD = new Date(params.to);
    if (Number.isNaN(fromD.getTime()) || Number.isNaN(toD.getTime())) {
      throw new BadRequestException('daily_km.invalid_report_date');
    }
    fromD.setUTCHours(0, 0, 0, 0);
    toD.setUTCHours(0, 0, 0, 0);
    if (fromD.getTime() > toD.getTime()) {
      throw new BadRequestException('daily_km.range_invalid');
    }
    const toExclusive = new Date(toD);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    const inRange = await this.prisma.dailyKmReport.findMany({
      where: { reportDate: { gte: fromD, lt: toExclusive } },
      include: {
        vehicle: { select: { plateNumber: true } },
        driver: { select: { fullName: true } },
      },
      orderBy: [{ vehicleId: 'asc' }, { reportDate: 'asc' }],
    });

    if (inRange.length === 0) return [];

    const vehicleIds = Array.from(new Set(inRange.map((r) => r.vehicleId)));
    const lookback = new Date(fromD);
    lookback.setUTCDate(lookback.getUTCDate() - 400);

    const beforeRows = await this.prisma.dailyKmReport.findMany({
      where: { vehicleId: { in: vehicleIds }, reportDate: { gte: lookback, lt: fromD } },
      include: {
        vehicle: { select: { plateNumber: true } },
        driver: { select: { fullName: true } },
      },
      orderBy: [{ vehicleId: 'asc' }, { reportDate: 'asc' }],
    });

    const byVehicle = new Map<string, typeof inRange>();
    for (const r of [...beforeRows, ...inRange]) {
      if (!byVehicle.has(r.vehicleId)) byVehicle.set(r.vehicleId, []);
      byVehicle.get(r.vehicleId)!.push(r as (typeof inRange)[number]);
    }

    const out: Array<{
      reportId: string;
      reportDate: string;
      vehicleId: string;
      plateNumber: string;
      driverName: string;
      startKm: string;
      endKm: string | null;
      prevReportId: string | null;
      prevReportDate: string | null;
      prevEndKm: string | null;
      gapKm: string | null;
    }> = [];

    for (const vid of vehicleIds) {
      const hist = (byVehicle.get(vid) ?? []).sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime());
      let prevClosedEnd: number | null = null;
      let prevReportId: string | null = null;
      let prevReportDate: Date | null = null;
      for (const r of hist) {
        const inWindow = r.reportDate >= fromD && r.reportDate < toExclusive;
        const startNum = Number(r.startKm);
        let gapNum: number | null = null;
        if (prevClosedEnd != null && Number.isFinite(startNum)) {
          gapNum = Math.max(0, startNum - prevClosedEnd);
        }
        if (inWindow) {
          out.push({
            reportId: r.id,
            reportDate: r.reportDate.toISOString(),
            vehicleId: r.vehicleId,
            plateNumber: r.vehicle.plateNumber,
            driverName: r.driver.fullName,
            startKm: String(r.startKm),
            endKm: r.endKm == null ? null : String(r.endKm),
            prevReportId,
            prevReportDate: prevReportDate ? prevReportDate.toISOString() : null,
            prevEndKm: prevClosedEnd == null ? null : String(prevClosedEnd),
            gapKm: gapNum == null ? null : String(gapNum),
          });
        }
        if (r.endKm != null) {
          const e = Number(r.endKm);
          if (Number.isFinite(e)) {
            prevClosedEnd = e;
            prevReportId = r.id;
            prevReportDate = r.reportDate;
          }
        }
      }
    }

    out.sort((a, b) => {
      const ga = a.gapKm == null ? -1 : Number(a.gapKm);
      const gb = b.gapKm == null ? -1 : Number(b.gapKm);
      if (gb !== ga) return gb - ga;
      return new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime();
    });
    return out;
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
