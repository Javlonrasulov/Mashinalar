import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
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
  findAll() {
    return this.categories.findAll();
  }

  @Post()
  create(@Body() dto: CreateExpenseCategoryDto) {
    return this.categories.create(dto.name);
  }
}
