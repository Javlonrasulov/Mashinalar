import {
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
import { ADMIN_PAGES_ALLOW_DRIVER_LIST } from '../../common/admin-page-keys';
import {
  AdminRoutePage,
  AdminRoutePageAny,
} from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  @AdminRoutePageAny(ADMIN_PAGES_ALLOW_DRIVER_LIST)
  findAll() {
    return this.drivers.findAll();
  }

  @Get(':id')
  @AdminRoutePage('DRIVERS')
  findOne(@Param('id') id: string) {
    return this.drivers.findOne(id);
  }

  @Get(':id/sessions')
  @AdminRoutePage('DRIVERS')
  listSessions(@Param('id') id: string) {
    return this.drivers.listSessions(id);
  }

  @Delete(':id/sessions/:sessionId')
  @AdminRoutePage('DRIVERS')
  revokeSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.drivers.revokeSession(id, sessionId, user.userId);
  }

  @Delete(':id/sessions')
  @AdminRoutePage('DRIVERS')
  revokeAllSessions(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.drivers.revokeAllSessions(id, user.userId);
  }

  @Post()
  @AdminRoutePage('DRIVERS')
  create(@Body() dto: CreateDriverDto, @CurrentUser() user: JwtUser) {
    return this.drivers.create(dto, user.userId);
  }

  @Patch(':id')
  @AdminRoutePage('DRIVERS')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.drivers.update(id, dto, user.userId);
  }

  @Delete(':id')
  @AdminRoutePage('DRIVERS')
  remove(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.drivers.remove(id, user.userId);
  }
}
