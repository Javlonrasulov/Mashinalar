import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DailyKmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
    const driver = await this.prisma.driver.findUnique({ where: { id: params.driverId } });
    if (!driver?.vehicleId) throw new BadRequestException('No vehicle assigned');
    if (!params.startOdometerUrl) throw new BadRequestException('startOdometer required');

    const reportDate = new Date(params.reportDate);
    reportDate.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(reportDate.getTime())) throw new BadRequestException('Invalid reportDate');

    const startRecordedAt = params.recordedAtIso ? new Date(params.recordedAtIso) : new Date();
    if (Number.isNaN(startRecordedAt.getTime())) throw new BadRequestException('Invalid recordedAt');

    const existing = await this.prisma.dailyKmReport.findUnique({
      where: { vehicleId_reportDate: { vehicleId: driver.vehicleId, reportDate } },
    });

    if (existing?.endKm != null) {
      throw new ConflictException('Report for this date is already completed');
    }

    if (existing) {
      const row = await this.prisma.dailyKmReport.update({
        where: { id: existing.id },
        data: {
          startKm: params.startKm,
          startOdometerUrl: params.startOdometerUrl ?? existing.startOdometerUrl,
          startLatitude: params.startLatitude ?? null,
          startLongitude: params.startLongitude ?? null,
          startRecordedAt,
        },
        include: { vehicle: true, driver: true },
      });
      await this.audit.log({
        actorUserId: params.actorUserId,
        action: 'dailyKm.start',
        entity: 'DailyKmReport',
        entityId: row.id,
      });
      return row;
    }

    const row = await this.prisma.dailyKmReport.create({
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
    const row = await this.prisma.dailyKmReport.findUnique({ where: { id: params.reportId } });
    if (!row) throw new NotFoundException('Report not found');
    if (row.driverId !== params.driverId) throw new ForbiddenException('Not your report');
    if (row.endKm != null) throw new ConflictException('End already submitted for this report');
    if (params.endKm < Number(row.startKm)) throw new BadRequestException('endKm must be >= startKm');
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
