import { BadRequestException, Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseDayStartUtc(s: string | undefined, fallback: Date): Date {
  if (s && YMD.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(fallback);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseDayEndUtc(s: string | undefined, fallback: Date): Date {
  if (s && YMD.test(s)) {
    const d = new Date(`${s}T23:59:59.999Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(fallback);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const dailyReports = await this.prisma.dailyKmReport.findMany({
      where: {
        reportDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const todayKm = dailyReports.reduce((sum: number, r) => {
      if (r.endKm == null) return sum;
      return sum + Math.max(0, Number(r.endKm) - Number(r.startKm));
    }, 0);

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const activeVehicles = await this.prisma.vehicle.count({
      where: { lastLocationAt: { gte: fifteenMinAgo } },
    });

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const staleVehicles = await this.prisma.vehicle.findMany({
      where: {
        OR: [{ lastLocationAt: null }, { lastLocationAt: { lt: oneHourAgo } }],
      },
      select: {
        id: true,
        plateNumber: true,
        lastLocationAt: true,
        drivers: { take: 1, select: { fullName: true, id: true } },
      },
    });

    const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const insuranceSoon = await this.prisma.vehicle.findMany({
      where: {
        insuranceEndDate: { not: null, lte: in30d, gte: now },
      },
      select: { id: true, plateNumber: true, insuranceEndDate: true },
    });

    const overdueTasks = await this.prisma.task.findMany({
      where: {
        deadlineAt: { lt: now },
        status: { in: [TaskStatus.PENDING, TaskStatus.SUBMITTED] },
      },
      include: { driver: true, vehicle: true },
    });

    const upcomingDeadlines = await this.prisma.task.findMany({
      where: {
        deadlineAt: { gte: now },
        status: { in: [TaskStatus.PENDING, TaskStatus.SUBMITTED] },
      },
      orderBy: { deadlineAt: 'asc' },
      take: 10,
      include: { driver: true, vehicle: true },
    });

    return {
      todayKm,
      activeVehicles,
      staleVehicles,
      insuranceSoon,
      overdueTasks,
      upcomingDeadlines,
    };
  }
}
