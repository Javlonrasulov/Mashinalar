import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { AdminRoutePage } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
@AdminRoutePage('VEHICLES')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.vehicles.findAll();
  }

  @Get('my')
  @Roles(UserRole.DRIVER)
  my(@CurrentUser() user: JwtUser) {
    if (!user.driverId) throw new BadRequestException('No driver');
    return this.vehicles.findMineForDriver(user.driverId);
  }

  @Get('assignments')
  @Roles(UserRole.ADMIN)
  allAssignments() {
    return this.vehicles.allDriverAssignments();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.vehicles.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateVehicleDto, @CurrentUser() user: JwtUser) {
    return this.vehicles.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto, @CurrentUser() user: JwtUser) {
    return this.vehicles.update(id, dto, user.userId);
  }

  @Get(':id/driver-history')
  @Roles(UserRole.ADMIN)
  driverHistory(@Param('id') id: string) {
    return this.vehicles.driverHistory(id);
  }

  @Patch(':id/assign-driver')
  @Roles(UserRole.ADMIN)
  assignDriver(
    @Param('id') id: string,
    @Body() body: { driverId?: string | null; startAt?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.vehicles.assignDriver(id, body, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.vehicles.remove(id, user.userId);
  }
}
