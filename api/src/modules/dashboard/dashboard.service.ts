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

  async statistics(fromRaw?: string, toRaw?: string) {
    const now = new Date();
    const to = parseDayEndUtc(toRaw, now);
    const defaultFrom = new Date(to);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
    defaultFrom.setUTCHours(0, 0, 0, 0);
    const from = parseDayStartUtc(fromRaw, defaultFrom);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('Invalid date range');
    }

    const [dailyRows, expenseGroups, fuelGroups, openByDriver, overdueOpenByDriver] = await Promise.all([
      this.prisma.dailyKmReport.findMany({
        where: {
          reportDate: { gte: from, lte: to },
          endKm: { not: null },
        },
        select: {
          vehicleId: true,
          startKm: true,
          endKm: true,
        },
      }),
      this.prisma.expense.groupBy({
        by: ['vehicleId'],
        where: { spentAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      this.prisma.fuelReport.groupBy({
        by: ['vehicleId'],
        where: { createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['driverId'],
        where: { status: { in: [TaskStatus.PENDING, TaskStatus.SUBMITTED] } },
        _count: { _all: true },
      }),
      this.prisma.task.groupBy({
        by: ['driverId'],
        where: {
          status: { in: [TaskStatus.PENDING, TaskStatus.SUBMITTED] },
          deadlineAt: { lt: now },
        },
        _count: { _all: true },
      }),
    ]);

    const kmMap = new Map<string, number>();
    for (const r of dailyRows) {
      if (r.endKm == null) continue;
      const delta = Math.max(0, Number(r.endKm) - Number(r.startKm));
      kmMap.set(r.vehicleId, (kmMap.get(r.vehicleId) ?? 0) + delta);
    }

    const vehicleIds = new Set<string>();
    for (const id of kmMap.keys()) vehicleIds.add(id);
    for (const e of expenseGroups) vehicleIds.add(e.vehicleId);
    for (const f of fuelGroups) vehicleIds.add(f.vehicleId);

    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: [...vehicleIds] } },
      select: { id: true, plateNumber: true, name: true },
    });
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));

    const attachVehicle = (vehicleId: string) => {
      const v = vehicleById.get(vehicleId);
      return {
        vehicleId,
        plateNumber: v?.plateNumber ?? vehicleId,
        name: v?.name ?? '',
      };
    };

    const kmByVehicle = [...kmMap.entries()]
      .map(([vehicleId, totalKm]) => ({ ...attachVehicle(vehicleId), totalKm }))
      .sort((a, b) => b.totalKm - a.totalKm);

    const expensesByVehicle = expenseGroups
      .map((g) => ({
        ...attachVehicle(g.vehicleId),
        totalAmount: Number(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    const fuelByVehicle = fuelGroups
      .map((g) => ({
        ...attachVehicle(g.vehicleId),
        reportCount: g._count._all,
        totalAmount: Number(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.reportCount - a.reportCount);

    const driverIds = new Set<string>();
    for (const r of openByDriver) driverIds.add(r.driverId);
    for (const r of overdueOpenByDriver) driverIds.add(r.driverId);

    const openCount = new Map(openByDriver.map((r) => [r.driverId, r._count._all]));
    const overdueCount = new Map(overdueOpenByDriver.map((r) => [r.driverId, r._count._all]));

    const drivers = driverIds.size
      ? await this.prisma.driver.findMany({
          where: { id: { in: [...driverIds] } },
          select: { id: true, fullName: true, phone: true },
        })
      : [];

    const driversIncomplete = drivers
      .map((d) => ({
        driverId: d.id,
        fullName: d.fullName,
        phone: d.phone,
        openTasks: openCount.get(d.id) ?? 0,
        overdueOpenTasks: overdueCount.get(d.id) ?? 0,
      }))
      .filter((d) => d.openTasks > 0)
      .sort((a, b) => b.openTasks - a.openTasks);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      kmByVehicle,
      expensesByVehicle,
      fuelByVehicle,
      driversIncomplete,
    };
  }
}
