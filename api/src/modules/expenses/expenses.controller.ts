import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { AdminRoutePage } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

function parseOptionalIsoDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @AdminRoutePage('EXPENSES')
  findAll(
    @Query('vehicleId') vehicleId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('spentFrom') spentFrom?: string,
    @Query('spentTo') spentTo?: string,
  ) {
    return this.expenses.findAll({
      vehicleId: vehicleId || undefined,
      categoryId: categoryId || undefined,
      spentFrom: parseOptionalIsoDate(spentFrom),
      spentTo: parseOptionalIsoDate(spentTo),
    });
  }

  @Get('totals')
  @AdminRoutePage('EXPENSES')
  totals() {
    return this.expenses.totalsByCategory();
  }

  @Get('stats/by-category')
  @AdminRoutePage('EXPENSES_STATS')
  statsByCategory(
    @Query('categoryId') categoryId?: string,
    @Query('spentFrom') spentFrom?: string,
    @Query('spentTo') spentTo?: string,
    @Query('rangeFrom') rangeFrom?: string,
    @Query('rangeTo') rangeTo?: string,
    @Query('tzOffset') tzOffset?: string,
  ) {
    const tz = tzOffset != null ? Number(tzOffset) : 0;
    return this.expenses.statsByCategory({
      categoryId: categoryId || undefined,
      spentFrom: parseOptionalIsoDate(spentFrom),
      spentTo: parseOptionalIsoDate(spentTo),
      rangeFrom: rangeFrom || undefined,
      rangeTo: rangeTo || undefined,
      tzOffsetMin: Number.isFinite(tz) ? tz : 0,
    });
  }

  @Get('stats/gas-by-vehicle')
  @AdminRoutePage('EXPENSES_STATS')
  gasStatsByVehicle(
    @Query('spentFrom') spentFrom?: string,
    @Query('spentTo') spentTo?: string,
    @Query('rangeFrom') rangeFrom?: string,
    @Query('rangeTo') rangeTo?: string,
  ) {
    return this.expenses.gasStatsByVehicle({
      spentFrom: parseOptionalIsoDate(spentFrom),
      spentTo: parseOptionalIsoDate(spentTo),
      rangeFrom: rangeFrom || undefined,
      rangeTo: rangeTo || undefined,
    });
  }

  @Get('stats/by-vehicle')
  @AdminRoutePage('EXPENSES_STATS')
  statsByVehicle(
    @Query('categoryId') categoryId?: string,
    @Query('spentFrom') spentFrom?: string,
    @Query('spentTo') spentTo?: string,
  ) {
    return this.expenses.totalsByVehicle({
      categoryId: categoryId || undefined,
      spentFrom: parseOptionalIsoDate(spentFrom),
      spentTo: parseOptionalIsoDate(spentTo),
    });
  }

  @Post()
  @AdminRoutePage('EXPENSES')
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: JwtUser) {
    return this.expenses.create(dto, user.userId);
  }

  @Patch(':id')
  @AdminRoutePage('EXPENSES')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.expenses.update(id, dto, user.userId);
  }

  @Delete(':id')
  @AdminRoutePage('EXPENSES')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.expenses.remove(id, user.userId);
  }
}
