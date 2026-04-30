import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { AdminRoutePage } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BatchGpsOffSegmentsDto } from './dto/batch-gps-off-segments.dto';
import { BatchLocationDto } from './dto/batch-location.dto';
import { TrackingService } from './tracking.service';

@Controller()
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('tracking/locations/batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  batch(@Body() dto: BatchLocationDto, @CurrentUser() user: JwtUser) {
    if (!user.driverId) throw new BadRequestException('No driver profile');
    return this.tracking.ingest(user.driverId, dto);
  }

  @Post('tracking/gps-off-segments/batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  batchGpsOff(@Body() dto: BatchGpsOffSegmentsDto, @CurrentUser() user: JwtUser) {
    if (!user.driverId) throw new BadRequestException('No driver profile');
    return this.tracking.ingestGpsOffSegments(user.driverId, dto);
  }

  @Get('tracking/gps-off-segments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('MAP')
  gpsOffSegments(
    @Query('vehicleId') vehicleId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!vehicleId || !from || !to) throw new BadRequestException('vehicleId, from, to required');
    const f = new Date(from);
    const t = new Date(to);
    return this.tracking.gpsOffSegments(vehicleId, f, t);
  }

  @Get('tracking/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('MAP')
  history(
    @Query('vehicleId') vehicleId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!vehicleId || !from || !to) throw new BadRequestException('vehicleId, from, to required');
    const f = new Date(from);
    const t = new Date(to);
    return this.tracking.history(vehicleId, f, t);
  }

  @Get('tracking/path-summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('MAP')
  pathSummary(
    @Query('vehicleId') vehicleId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!vehicleId || !from || !to) throw new BadRequestException('vehicleId, from, to required');
    return this.tracking.pathDistanceKm(vehicleId, new Date(from), new Date(to));
  }

  /** GPS marshrut, to‘xtashlar, klasterlar va odometr (Kun KM) bo‘yicha yig‘ma. */
  @Get('tracking/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('MAP')
  analytics(
    @Query('vehicleId') vehicleId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!vehicleId || !from || !to) throw new BadRequestException('vehicleId, from, to required');
    return this.tracking.mapAnalytics(vehicleId, new Date(from), new Date(to));
  }

  @Get('tracking/live')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('MAP')
  live() {
    return this.tracking.livePositions();
  }
}
