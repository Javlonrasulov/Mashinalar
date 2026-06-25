import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FuelKind, Prisma } from '@prisma/client';
import { ACTIVE_VEHICLE_WHERE } from '../../common/active-vehicle';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

function parseYmdParts(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatYmdParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function enumerateYmdRange(from: string, to: string): string[] {
  const a = parseYmdParts(from);
  const b = parseYmdParts(to);
  if (!a || !b) return [];
  const start = new Date(a.y, a.m - 1, a.d);
  const end = new Date(b.y, b.m - 1, b.d);
  if (end.getTime() < start.getTime()) return [];
  const out: string[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(formatYmdParts(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** `tzOffsetMin` = browser `Date.getTimezoneOffset()` (UTC − local, in minutes). */
function ymdInClientTz(d: Date, tzOffsetMin: number): string {
  const local = new Date(d.getTime() - tzOffsetMin * 60_000);
  return formatYmdParts(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
  );
}

function parseDayUtc(ymd: string): Date | null {
  const d = new Date(ymd.trim());
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertOwner(
    row: { createdByUserId: string | null },
    actorUserId: string,
  ) {
    if (!row.createdByUserId || row.createdByUserId !== actorUserId) {
      throw new ForbiddenException('Cannot modify this expense');
    }
  }

  findAll(filters?: {
    vehicleId?: string;
    categoryId?: string;
    spentFrom?: Date;
    spentTo?: Date;
  }) {
    const spentAt =
      filters?.spentFrom || filters?.spentTo
        ? {
            ...(filters.spentFrom ? { gte: filters.spentFrom } : {}),
            ...(filters.spentTo ? { lte: filters.spentTo } : {}),
          }
        : undefined;
    return this.prisma.expense.findMany({
      where: {
        vehicleId: filters?.vehicleId,
        categoryId: filters?.categoryId,
        ...(spentAt ? { spentAt } : {}),
      },
      orderBy: { spentAt: 'desc' },
      include: { vehicle: true, category: true },
    });
  }

  async create(dto: CreateExpenseDto, actorUserId: string) {
    const row = await this.prisma.expense.create({
      data: {
        vehicleId: dto.vehicleId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        note: dto.note,
        spentAt: dto.spentAt ? new Date(dto.spentAt) : new Date(),
        createdByUserId: actorUserId,
      },
      include: { vehicle: true, category: true },
    });
    await this.audit.log({
      actorUserId,
      action: 'expense.create',
      entity: 'Expense',
      entityId: row.id,
    });
    return row;
  }

  async update(id: string, dto: UpdateExpenseDto, actorUserId: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    this.assertOwner(existing, actorUserId);

    const row = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.vehicleId != null ? { vehicleId: dto.vehicleId } : {}),
        ...(dto.categoryId != null ? { categoryId: dto.categoryId } : {}),
        ...(dto.amount != null ? { amount: dto.amount } : {}),
        ...(dto.note !== undefined ? { note: dto.note || null } : {}),
        ...(dto.spentAt != null ? { spentAt: new Date(dto.spentAt) } : {}),
      },
      include: { vehicle: true, category: true },
    });
    await this.audit.log({
      actorUserId,
      action: 'expense.update',
      entity: 'Expense',
      entityId: row.id,
    });
    return row;
  }

  async remove(id: string, actorUserId: string) {
    const existing = await this.prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    this.assertOwner(existing, actorUserId);

    await this.prisma.expense.delete({ where: { id } });
    await this.audit.log({
      actorUserId,
      action: 'expense.delete',
      entity: 'Expense',
      entityId: id,
    });
    return { ok: true };
  }

  async totalsByCategory() {
    const grouped = await this.prisma.expense.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
    });
    if (grouped.length === 0) return [];
    const ids = grouped.map((g) => g.categoryId);
    const cats = await this.prisma.expenseCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true, name: true },
    });
    const byId = new Map(cats.map((c) => [c.id, c]));
    return grouped.map((g) => ({
      categoryId: g.categoryId,
      slug: byId.get(g.categoryId)?.slug ?? '',
      name: byId.get(g.categoryId)?.name ?? g.categoryId,
      totalAmount: (g._sum.amount ?? new Prisma.Decimal(0)).toString(),
    }));
  }

  /**
   * Category totals, share %, and daily series for wave charts (respects date/category filters).
   */
  async statsByCategory(filters?: {
    categoryId?: string;
    spentFrom?: Date;
    spentTo?: Date;
    rangeFrom?: string;
    rangeTo?: string;
    tzOffsetMin?: number;
  }) {
    const spentAt =
      filters?.spentFrom || filters?.spentTo
        ? {
            ...(filters.spentFrom ? { gte: filters.spentFrom } : {}),
            ...(filters.spentTo ? { lte: filters.spentTo } : {}),
          }
        : undefined;

    const tzOffsetMin = filters?.tzOffsetMin ?? 0;

    const rows = await this.prisma.expense.findMany({
      where: {
        ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(spentAt ? { spentAt } : {}),
      },
      select: { categoryId: true, amount: true, spentAt: true },
      orderBy: { spentAt: 'asc' },
    });

    const rangeFrom = filters?.rangeFrom?.trim() || null;
    const rangeTo = filters?.rangeTo?.trim() || null;

    if (rows.length === 0) {
      return {
        grandTotal: '0',
        rangeFrom,
        rangeTo,
        categories: [] as const,
      };
    }

    const catIds = [...new Set(rows.map((r) => r.categoryId))];
    const cats = await this.prisma.expenseCategory.findMany({
      where: { id: { in: catIds } },
      select: { id: true, slug: true, name: true },
    });
    const byId = new Map(cats.map((c) => [c.id, c]));

    const totals = new Map<string, { sum: Prisma.Decimal; count: number }>();
    const daily = new Map<string, Map<string, Prisma.Decimal>>();
    const allDates = new Set<string>();
    let grand = new Prisma.Decimal(0);

    for (const r of rows) {
      grand = grand.add(r.amount);
      const bucket = totals.get(r.categoryId) ?? {
        sum: new Prisma.Decimal(0),
        count: 0,
      };
      bucket.sum = bucket.sum.add(r.amount);
      bucket.count += 1;
      totals.set(r.categoryId, bucket);

      const ymd = ymdInClientTz(r.spentAt, tzOffsetMin);
      allDates.add(ymd);
      if (!daily.has(ymd)) daily.set(ymd, new Map());
      const dayMap = daily.get(ymd)!;
      dayMap.set(
        r.categoryId,
        (dayMap.get(r.categoryId) ?? new Prisma.Decimal(0)).add(r.amount),
      );
    }

    const sortedDates = [...allDates].sort();
    const dateSeries =
      rangeFrom && rangeTo ? enumerateYmdRange(rangeFrom, rangeTo) : sortedDates;
    const grandNum = Number(grand.toString());

    const categories = [...totals.entries()]
      .map(([categoryId, { sum, count }]) => {
        const meta = byId.get(categoryId);
        const totalAmount = sum.toString();
        return {
          categoryId,
          slug: meta?.slug ?? '',
          name: meta?.name ?? categoryId,
          totalAmount,
          expenseCount: count,
          percent: grandNum > 0 ? (Number(totalAmount) / grandNum) * 100 : 0,
          daily: dateSeries.map((date) => ({
            date,
            value: Number(
              (daily.get(date)?.get(categoryId) ?? new Prisma.Decimal(0)).toString(),
            ),
          })),
        };
      })
      .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount));

    return { grandTotal: grand.toString(), rangeFrom, rangeTo, categories };
  }

  /**
   * Total expense amount per vehicle (admin “who spends most” = which plate / car).
   */
  async totalsByVehicle(filters?: {
    categoryId?: string;
    spentFrom?: Date;
    spentTo?: Date;
  }) {
    const spentAt =
      filters?.spentFrom || filters?.spentTo
        ? {
            ...(filters.spentFrom ? { gte: filters.spentFrom } : {}),
            ...(filters.spentTo ? { lte: filters.spentTo } : {}),
          }
        : undefined;
    const grouped = await this.prisma.expense.groupBy({
      by: ['vehicleId'],
      where: {
        ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(spentAt ? { spentAt } : {}),
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    if (grouped.length === 0) return [];

    const vehicleIds = grouped.map((g) => g.vehicleId);
    const vehicles = await this.prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, plateNumber: true },
    });
    const plateById = new Map(vehicles.map((v) => [v.id, v.plateNumber]));

    const rows = grouped.map((g) => ({
      vehicleId: g.vehicleId,
      plateNumber: plateById.get(g.vehicleId) ?? g.vehicleId,
      totalAmount: (g._sum.amount ?? new Prisma.Decimal(0)).toString(),
      expenseCount: g._count.id,
    }));

    rows.sort((a, b) =>
      new Prisma.Decimal(b.totalAmount).comparedTo(
        new Prisma.Decimal(a.totalAmount),
      ),
    );

    return rows;
  }

  /**
   * Gaz zapravkalari (GAS) va kunlik KM bo‘yicha mashina statistikasi: jami summa, km, 1 km ga narx.
   */
  async gasStatsByVehicle(filters?: {
    spentFrom?: Date;
    spentTo?: Date;
    rangeFrom?: string;
    rangeTo?: string;
  }) {
    const rangeFrom = filters?.rangeFrom?.trim() || null;
    const rangeTo = filters?.rangeTo?.trim() || null;

    const fuelCreatedAt =
      filters?.spentFrom || filters?.spentTo
        ? {
            ...(filters.spentFrom ? { gte: filters.spentFrom } : {}),
            ...(filters.spentTo ? { lte: filters.spentTo } : {}),
          }
        : undefined;

    let fromD: Date | null = null;
    let toExclusive: Date | null = null;
    if (rangeFrom && rangeTo) {
      const a = parseDayUtc(rangeFrom);
      const b = parseDayUtc(rangeTo);
      if (a && b && a.getTime() <= b.getTime()) {
        fromD = a;
        toExclusive = new Date(b);
        toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
      }
    }

    const [fuelGrouped, dailyRows, vehicles] = await Promise.all([
      this.prisma.fuelReport.groupBy({
        by: ['vehicleId'],
        where: {
          fuelKind: FuelKind.GAS,
          vehicle: ACTIVE_VEHICLE_WHERE,
          ...(fuelCreatedAt ? { createdAt: fuelCreatedAt } : {}),
        },
        _sum: { amount: true, volume: true },
        _count: { id: true },
      }),
      fromD && toExclusive
        ? this.prisma.dailyKmReport.findMany({
            where: {
              reportDate: { gte: fromD, lt: toExclusive },
              vehicle: ACTIVE_VEHICLE_WHERE,
            },
            select: {
              vehicleId: true,
              reportDate: true,
              startKm: true,
              endKm: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.vehicle.findMany({
        where: ACTIVE_VEHICLE_WHERE,
        select: {
          id: true,
          plateNumber: true,
          name: true,
          drivers: { select: { fullName: true }, orderBy: { fullName: 'asc' } },
        },
      }),
    ]);

    const days =
      rangeFrom && rangeTo ? enumerateYmdRange(rangeFrom, rangeTo) : [];

    const submissionMap = new Map<string, { start: boolean; end: boolean }>();
    const kmMap = new Map<string, number>();
    for (const r of dailyRows) {
      const ymd = r.reportDate.toISOString().slice(0, 10);
      submissionMap.set(`${r.vehicleId}:${ymd}`, {
        start: true,
        end: r.endKm != null,
      });
      if (r.endKm != null) {
        const delta = Math.max(0, Number(r.endKm) - Number(r.startKm));
        kmMap.set(r.vehicleId, (kmMap.get(r.vehicleId) ?? 0) + delta);
      }
    }

    const amountMap = new Map<string, Prisma.Decimal>();
    const volumeMap = new Map<string, Prisma.Decimal>();
    const fuelCountMap = new Map<string, number>();
    for (const g of fuelGrouped) {
      amountMap.set(g.vehicleId, g._sum.amount ?? new Prisma.Decimal(0));
      if (g._sum.volume != null) {
        volumeMap.set(g.vehicleId, g._sum.volume);
      }
      fuelCountMap.set(g.vehicleId, g._count.id);
    }

    const vehicleIds = new Set<string>();
    for (const v of vehicles) vehicleIds.add(v.id);
    for (const id of kmMap.keys()) vehicleIds.add(id);
    for (const id of amountMap.keys()) vehicleIds.add(id);

    const byId = new Map(vehicles.map((v) => [v.id, v]));

    const rows = [...vehicleIds]
      .map((vehicleId) => {
        const meta = byId.get(vehicleId);
        const totalKm = kmMap.get(vehicleId) ?? 0;
        const totalAmountDec = amountMap.get(vehicleId) ?? new Prisma.Decimal(0);
        const totalAmount = totalAmountDec.toString();
        const vol = volumeMap.get(vehicleId);
        const costPerKm =
          totalKm > 0 ? Number(totalAmountDec) / totalKm : null;
        const dailyKm = days.map((d) => {
          const sub = submissionMap.get(`${vehicleId}:${d}`);
          return { start: Boolean(sub?.start), end: Boolean(sub?.end) };
        });
        return {
          vehicleId,
          plateNumber: meta?.plateNumber ?? vehicleId,
          name: meta?.name ?? '',
          driverName:
            meta?.drivers?.map((d) => d.fullName).join(', ') || '—',
          totalKm,
          totalAmount,
          totalVolumeM3: vol == null ? null : vol.toString(),
          fuelReportCount: fuelCountMap.get(vehicleId) ?? 0,
          costPerKm,
          dailyKm,
        };
      })
      .filter((r) => r.fuelReportCount > 0 || r.totalKm > 0);

    rows.sort((a, b) => {
      const ca = a.costPerKm;
      const cb = b.costPerKm;
      if (ca == null && cb == null) return b.totalKm - a.totalKm;
      if (ca == null) return 1;
      if (cb == null) return -1;
      if (cb !== ca) return cb - ca;
      return b.totalKm - a.totalKm;
    });

    return { rangeFrom, rangeTo, days, vehicles: rows };
  }
}
