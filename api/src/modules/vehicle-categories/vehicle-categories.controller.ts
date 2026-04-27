import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { AdminRoutePage } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateVehicleCategoryDto } from './dto/create-vehicle-category.dto';
import { UpdateVehicleCategoryDto } from './dto/update-vehicle-category.dto';
import { VehicleCategoriesService } from './vehicle-categories.service';

@Controller('vehicle-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoutePage('VEHICLES')
export class VehicleCategoriesController {
  constructor(private readonly cats: VehicleCategoriesService) {}

  @Get()
  findAll() {
    return this.cats.findAll();
  }

  @Post()
  create(@Body() dto: CreateVehicleCategoryDto, @CurrentUser() user: JwtUser) {
    return this.cats.create(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleCategoryDto, @CurrentUser() user: JwtUser) {
    return this.cats.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.cats.remove(id, user.userId);
  }
}

