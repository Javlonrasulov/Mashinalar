import { Injectable } from '@nestjs/common';
import { ExpenseType } from '@prisma/client';
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
}
