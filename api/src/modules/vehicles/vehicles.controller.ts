import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  AdminRoutePage,
  AdminRoutePageAny,
} from '../../common/decorators/admin-route-page.decorator';
import {
  ADMIN_PAGES_ALLOW_VEHICLE_LIST,
  ADMIN_PAGES_VEHICLE_GAS_PRICE,
} from '../../common/admin-page-keys';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleGasPriceDto } from './dto/update-vehicle-gas-price.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @AdminRoutePageAny(ADMIN_PAGES_ALLOW_VEHICLE_LIST)
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
  @AdminRoutePage('VEHICLES')
  allAssignments() {
    return this.vehicles.allDriverAssignments();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('VEHICLES')
  findOne(@Param('id') id: string) {
    return this.vehicles.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('VEHICLES')
  create(@Body() dto: CreateVehicleDto, @CurrentUser() user: JwtUser) {
    return this.vehicles.create(dto, user.userId);
  }

  @Patch(':id/gas-price')
  @Roles(UserRole.ADMIN)
  @AdminRoutePageAny(ADMIN_PAGES_VEHICLE_GAS_PRICE)
  updateGasPrice(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleGasPriceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.vehicles.updateGasPricePerM3(id, dto.gasPricePerM3, user.userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('VEHICLES')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.vehicles.update(id, dto, user.userId);
  }

  @Get(':id/driver-history')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('VEHICLES')
  driverHistory(@Param('id') id: string) {
    return this.vehicles.driverHistory(id);
  }

  @Patch(':id/assign-driver')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('VEHICLES')
  assignDriver(
    @Param('id') id: string,
    @Body() body: { driverId?: string | null; startAt?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.vehicles.assignDriver(id, body, user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('VEHICLES')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.vehicles.remove(id, user.userId);
  }
}
