import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('last-days')
  @Roles(UserRole.DRIVER)
  lastDays(@CurrentUser() user: JwtUser, @Query('days') days?: string) {
    if (!user.driverId) throw new BadRequestException('No driver');
    return this.stats.lastDaysForDriver(user.driverId, days);
  }
}
