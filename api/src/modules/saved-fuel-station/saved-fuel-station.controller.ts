import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ADMIN_PAGES_MAP_FUEL_OSM } from '../../common/admin-page-keys';
import { AdminRoutePageAny } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSavedFuelStationDto } from './dto/create-saved-fuel-station.dto';
import { UpdateSavedFuelStationDto } from './dto/update-saved-fuel-station.dto';
import { SavedFuelStationService } from './saved-fuel-station.service';

@Controller('map/saved-fuel-stations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoutePageAny(ADMIN_PAGES_MAP_FUEL_OSM)
export class SavedFuelStationController {
  constructor(private readonly savedFuel: SavedFuelStationService) {}

  @Get()
  list() {
    return this.savedFuel.list();
  }

  @Post()
  create(@Body() dto: CreateSavedFuelStationDto) {
    return this.savedFuel.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSavedFuelStationDto) {
    return this.savedFuel.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.savedFuel.remove(id);
  }
}
