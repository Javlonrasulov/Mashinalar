import { Injectable } from '@nestjs/common';
import { ExpenseType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(filters?: { vehicleId?: string; type?: ExpenseType }) {
    return this.prisma.expense.findMany({
      where: {
        vehicleId: filters?.vehicleId,
        type: filters?.type,
      },
      orderBy: { spentAt: 'desc' },
      include: { vehicle: true },
    });
  }

  async create(dto: CreateExpenseDto, actorUserId: string) {
    const row = await this.prisma.expense.create({
      data: {
        vehicleId: dto.vehicleId,
        type: dto.type,
        amount: dto.amount,
        note: dto.note,
        spentAt: dto.spentAt ? new Date(dto.spentAt) : new Date(),
      },
      include: { vehicle: true },
    });
    await this.audit.log({
      actorUserId,
      action: 'expense.create',
      entity: 'Expense',
      entityId: row.id,
    });
    return row;
  }

  totalsByType() {
    return this.prisma.expense.groupBy({
      by: ['type'],
      _sum: { amount: true },
    });
  }

  /**
   * Total expense amount per vehicle (admin “who spends most” = which plate / car).
   */
  async totalsByVehicle(filters?: { type?: ExpenseType }) {
    const grouped = await this.prisma.expense.groupBy({
      by: ['vehicleId'],
      where: filters?.type ? { type: filters.type } : {},
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
