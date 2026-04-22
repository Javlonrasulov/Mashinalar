import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async lastDaysForDriver(driverId: string, daysRaw?: string) {
    const days = daysRaw ? Number(daysRaw) : 3;
    if (!Number.isFinite(days) || days <= 0 || days > 31) {
      throw new BadRequestException('Invalid days');
    }

    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver?.vehicleId) throw new BadRequestException('No vehicle assigned');

    const vehicleId = driver.vehicleId;

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const reports = await this.prisma.dailyKmReport.findMany({
      where: { vehicleId, reportDate: { gte: start, lte: end } },
      orderBy: { reportDate: 'asc' },
    });

    const perDay = reports.map((r) => {
      const km = r.endKm == null ? 0 : Number(r.endKm) - Number(r.startKm);
      return {
        date: r.reportDate.toISOString().slice(0, 10),
        km: Number.isFinite(km) && km >= 0 ? km : 0,
      };
    });

    const totalLastDays = perDay.reduce((acc, x) => acc + x.km, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReport = await this.prisma.dailyKmReport.findUnique({
      where: { vehicleId_reportDate: { vehicleId, reportDate: today } },
    });
    const todayKm =
      todayReport && todayReport.endKm != null
        ? Math.max(0, Number(todayReport.endKm) - Number(todayReport.startKm))
        : 0;

    return {
      vehicleId,
      days,
      range: { from: start.toISOString(), to: end.toISOString() },
      perDay,
      totalLastDays,
      todayKm,
    };
  }
}
