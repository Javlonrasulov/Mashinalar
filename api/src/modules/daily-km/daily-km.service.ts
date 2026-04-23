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
    if (!driver?.vehicleId || !driver.vehicle) throw new BadRequestException('No vehicle assigned');
    const minKm = Number(driver.vehicle.initialKm);
    if (!Number.isFinite(minKm)) throw new BadRequestException('Invalid vehicle odometer baseline');
    if (params.startKm < minKm) {
      throw new BadRequestException(
        `Boshlash KM kamida mashina boshlang‘ich KM (${minKm}) bo‘lishi kerak.`,
      );
    }
    if (!params.startOdometerUrl) throw new BadRequestException('startOdometer required');

    const reportDate = new Date(params.reportDate);
    reportDate.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(reportDate.getTime())) throw new BadRequestException('Invalid reportDate');

    const startRecordedAt = params.recordedAtIso ? new Date(params.recordedAtIso) : new Date();
    if (Number.isNaN(startRecordedAt.getTime())) throw new BadRequestException('Invalid recordedAt');

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
      throw new BadRequestException(
        `Boshlash KM avvalgi yozuvlardagi eng yuqori KM (${maxRecorded}) dan kam bo‘lmasligi kerak.`,
      );
    }

    if (existing?.endKm != null) {
      throw new ConflictException(
        'Bu kun uchun hisobot allaqachon yopilgan (yakuniy KM yuborilgan). ' +
          'Yangi boshlash uchun ertangi kunni kuting yoki admin bilan bog‘laning.',
      );
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
        throw new ConflictException(
          'Bu kun uchun hisobot allaqachon yopilgan (yakuniy KM yuborilgan). ' +
            'Yangi boshlash uchun ertangi kunni kuting yoki admin bilan bog‘laning.',
        );
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
    if (!row) throw new NotFoundException('Report not found');
    if (row.driverId !== params.driverId) throw new ForbiddenException('Not your report');
    if (row.endKm != null) throw new ConflictException('End already submitted for this report');
    const minKm = Number(row.vehicle.initialKm);
    if (!Number.isFinite(minKm)) throw new BadRequestException('Invalid vehicle odometer baseline');
    const maxOthers = await maxRecordedOdometerKm(this.prisma, row.vehicleId, row.id, minKm);
    const minEndAllowed = Math.max(maxOthers, Number(row.startKm));
    if (params.endKm < minEndAllowed) {
      throw new BadRequestException(
        `Yakuniy KM kamida ${minEndAllowed} bo‘lishi kerak (boshlash KM va avvalgi yozuvlar bo‘yicha).`,
      );
    }
    if (!params.endOdometerUrl) throw new BadRequestException('endOdometer required');

    const endRecordedAt = params.recordedAtIso ? new Date(params.recordedAtIso) : new Date();
    if (Number.isNaN(endRecordedAt.getTime())) throw new BadRequestException('Invalid recordedAt');

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
