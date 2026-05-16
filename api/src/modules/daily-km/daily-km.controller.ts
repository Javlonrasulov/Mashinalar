import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { ADMIN_PAGES_DAILY_KM_SHARED } from '../../common/admin-page-keys';
import { AdminRoutePageAny } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DailyKmService } from './daily-km.service';
import { compressMulterFiles } from '../../common/upload/image-compress';

const uploadDir = join(process.cwd(), 'uploads');

function ensureUploadDir() {
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
}

function fileName(
  _req: unknown,
  file: Express.Multer.File,
  cb: (e: Error | null, name: string) => void,
) {
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
  cb(null, name);
}

function parseNum(v: string | undefined): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

@Controller('daily-km-reports')
export class DailyKmController {
  constructor(private readonly dailyKm: DailyKmService) {}

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  findMine(@CurrentUser() user: JwtUser, @Query('limit') limit?: string) {
    if (!user.driverId) throw new BadRequestException('daily_km.no_driver');
    return this.dailyKm.findMine(user.driverId, limit);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePageAny(ADMIN_PAGES_DAILY_KM_SHARED)
  async findAll(
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const hasRange = from != null && from !== '' && to != null && to !== '';
    return await this.dailyKm.findAll(hasRange ? { from, to } : { date });
  }

  /** Admin: оралиқ KM аудити (саналар oralig‘и) */
  @Get('gap-audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePageAny(ADMIN_PAGES_DAILY_KM_SHARED)
  async gapAudit(@Query('from') from: string, @Query('to') to: string) {
    return await this.dailyKm.findGapAudit({ from, to });
  }

  /** Admin: kunlar bo‘yicha boshlanish/tugash yuborilganlari (avtopark) */
  @Get('submission-overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePageAny(ADMIN_PAGES_DAILY_KM_SHARED)
  submissionOverview(@Query('from') from: string, @Query('to') to: string) {
    return this.dailyKm.submissionOverview({ from, to });
  }

  /** Admin: yuborilgan boshlang‘ich / yakuniy KM ni tuzatish (rasm va vaqtlar o‘zgarmaydi) */
  @Patch('admin/:id/km')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePageAny(ADMIN_PAGES_DAILY_KM_SHARED)
  async adminPatchKm(
    @Param('id') id: string,
    @Body() body: { startKm?: string; endKm?: string },
    @CurrentUser() user: JwtUser,
  ) {
    const patch: { startKm?: number; endKm?: number } = {};
    if (body.startKm != null && String(body.startKm).trim() !== '') {
      const n = Number(body.startKm);
      if (!Number.isFinite(n))
        throw new BadRequestException('daily_km.invalid_start_km_number');
      patch.startKm = n;
    }
    if (body.endKm != null && String(body.endKm).trim() !== '') {
      const n = Number(body.endKm);
      if (!Number.isFinite(n))
        throw new BadRequestException('daily_km.invalid_end_km_number');
      patch.endKm = n;
    }
    if (patch.startKm === undefined && patch.endKm === undefined) {
      throw new BadRequestException('daily_km.nothing_to_patch');
    }
    const { warnings } = await this.dailyKm.adminPatchReportKm({
      reportId: id,
      actorUserId: user.userId,
      ...patch,
    });
    return { ok: true as const, warnings };
  }

  /** Kun boshlanishi: boshlang‘ich KM + start rasm + lokatsiya + vaqt */
  @Post('start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'startOdometer', maxCount: 1 }], {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, uploadDir);
        },
        filename: fileName,
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async startDay(
    @UploadedFiles() files: { startOdometer?: Express.Multer.File[] },
    @Body()
    body: {
      reportDate?: string;
      startKm?: string;
      latitude?: string;
      longitude?: string;
      recordedAt?: string;
    },
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.driverId) throw new BadRequestException('daily_km.no_driver');
    if (!body.reportDate)
      throw new BadRequestException('daily_km.report_date_required');
    const startKm = body.startKm ? Number(body.startKm) : NaN;
    if (!Number.isFinite(startKm))
      throw new BadRequestException('daily_km.invalid_start_km_number');

    await compressMulterFiles(files);

    const base = '/uploads';
    const startOdometerUrl = files?.startOdometer?.[0]
      ? `${base}/${files.startOdometer[0].filename}`
      : undefined;

    return this.dailyKm.submitDayStart({
      driverId: user.driverId,
      reportDate: body.reportDate,
      startKm,
      startOdometerUrl,
      startLatitude: parseNum(body.latitude),
      startLongitude: parseNum(body.longitude),
      recordedAtIso: body.recordedAt,
      actorUserId: user.userId,
    });
  }

  /** Kun tugashi: yakuniy KM + end rasm + lokatsiya + vaqt */
  @Patch(':id/end')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'endOdometer', maxCount: 1 }], {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, uploadDir);
        },
        filename: fileName,
      }),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async endDay(
    @Param('id') id: string,
    @UploadedFiles() files: { endOdometer?: Express.Multer.File[] },
    @Body()
    body: {
      endKm?: string;
      latitude?: string;
      longitude?: string;
      recordedAt?: string;
    },
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.driverId) throw new BadRequestException('daily_km.no_driver');
    const endKm = body.endKm ? Number(body.endKm) : NaN;
    if (!Number.isFinite(endKm))
      throw new BadRequestException('daily_km.invalid_end_km_number');

    await compressMulterFiles(files);

    const base = '/uploads';
    const endOdometerUrl = files?.endOdometer?.[0]
      ? `${base}/${files.endOdometer[0].filename}`
      : undefined;

    return this.dailyKm.submitDayEnd({
      reportId: id,
      driverId: user.driverId,
      endKm,
      endOdometerUrl,
      endLatitude: parseNum(body.latitude),
      endLongitude: parseNum(body.longitude),
      recordedAtIso: body.recordedAt,
      actorUserId: user.userId,
    });
  }
}
