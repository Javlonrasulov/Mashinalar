import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ExpenseType, UserRole } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  findAll(@Query('vehicleId') vehicleId?: string, @Query('type') type?: ExpenseType) {
    return this.expenses.findAll({
      vehicleId: vehicleId || undefined,
      type: type || undefined,
    });
  }

  @Get('totals')
  totals() {
    return this.expenses.totalsByType();
  }

  @Post()
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: JwtUser) {
    return this.expenses.create(dto, user.userId);
  }
}
