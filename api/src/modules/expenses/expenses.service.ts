import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

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

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
}
