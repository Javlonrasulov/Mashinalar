import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(filters?: { vehicleId?: string; categoryId?: string; spentFrom?: Date; spentTo?: Date }) {
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
   * Total expense amount per vehicle (admin “who spends most” = which plate / car).
   */
  async totalsByVehicle(filters?: { categoryId?: string; spentFrom?: Date; spentTo?: Date }) {
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
      new Prisma.Decimal(b.totalAmount).comparedTo(new Prisma.Decimal(a.totalAmount)),
    );

    return rows;
  }
}
