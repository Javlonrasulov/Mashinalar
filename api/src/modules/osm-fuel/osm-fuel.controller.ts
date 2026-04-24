import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReverseGeocodeBatchDto } from './dto/reverse-geocode-batch.dto';
import { OsmFuelService } from './osm-fuel.service';

function num(q: string | undefined, fallback: number): number {
  if (q == null || q === '') return fallback;
  const n = Number(q);
  if (!Number.isFinite(n)) throw new BadRequestException('Invalid bbox');
  return n;
}

@Controller('map')
export class OsmFuelController {
  constructor(private readonly osmFuel: OsmFuelService) {}

  @Get('fuel-stations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async fuelStations(
    @Query('south') southQ?: string,
    @Query('west') westQ?: string,
    @Query('north') northQ?: string,
    @Query('east') eastQ?: string,
  ) {
    const d = this.osmFuel.defaultBbox();
    const bbox = {
      south: num(southQ, d.south),
      west: num(westQ, d.west),
      north: num(northQ, d.north),
      east: num(eastQ, d.east),
    };
    if (bbox.south >= bbox.north || bbox.west >= bbox.east) {
      throw new BadRequestException('Invalid bbox');
    }
    return this.osmFuel.listFuelStations(bbox);
  }

  /** Koordinata → qisqa manzil (OSM Nominatim, kesh). */
  @Post('reverse-geocode-batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async reverseGeocodeBatch(@Body() dto: ReverseGeocodeBatchDto) {
    if (!dto.points?.length) return { labels: {} as Record<string, string> };
    return { labels: await this.osmFuel.reverseGeocodeBatch(dto.points) };
  }
}
