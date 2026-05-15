import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ADMIN_PAGES_ALLOW_EXPENSE_CATEGORY_LIST } from '../../common/admin-page-keys';
import {
  AdminRoutePage,
  AdminRoutePageAny,
} from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { ExpenseCategoriesService } from './expense-categories.service';

@Controller('expense-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ExpenseCategoriesController {
  constructor(private readonly categories: ExpenseCategoriesService) {}

  @Get()
  @AdminRoutePageAny(ADMIN_PAGES_ALLOW_EXPENSE_CATEGORY_LIST)
  findAll() {
    return this.categories.findAll();
  }

  @Post()
  @AdminRoutePage('EXPENSES')
  create(@Body() dto: CreateExpenseCategoryDto) {
    return this.categories.create(dto.name);
  }
}
