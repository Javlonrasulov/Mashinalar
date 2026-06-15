import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import {
  CurrentUser,
  JwtUser,
} from '../../common/decorators/current-user.decorator';
import { AdminRoutePage } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OilChangeService } from './oil-change.service';
import { compressMulterFile } from '../../common/upload/image-compress';

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

@Controller('oil-change-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OilChangeController {
  constructor(private readonly oil: OilChangeService) {}

  @Get('mine')
  @Roles(UserRole.DRIVER)
  findMine(@CurrentUser() user: JwtUser, @Query('limit') limit?: string) {
    if (!user.driverId) throw new BadRequestException('No driver');
    return this.oil.findMine(user.driverId, limit);
  }

  @Post()
  @Roles(UserRole.DRIVER)
  @UseInterceptors(
    FileInterceptor('panelPhoto', {
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
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtUser,
    @Body() body: { kmAtChange?: string },
  ) {
    if (!user.driverId) throw new BadRequestException('No driver');
    const kmRaw = body?.kmAtChange;
    const km = kmRaw != null && kmRaw !== '' ? Number(kmRaw) : NaN;
    if (!Number.isFinite(km) || km <= 0)
      throw new BadRequestException('Invalid kmAtChange');
    await compressMulterFile(file);
    const base = '/uploads';
    const photoUrl = file ? `${base}/${file.filename}` : undefined;
    return this.oil.createFromDriver({
      driverId: user.driverId,
      kmAtChange: km,
      photoUrl,
      actorUserId: user.userId,
    });
  }

  @Get('admin/overview')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('OIL')
  adminOverview() {
    return this.oil.adminOverview();
  }

  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('OIL')
  adminList(@Query('limit') limit?: string) {
    return this.oil.adminListReports(limit);
  }

  /** Admin: mashinaning oxirgi moy km ni tuzatish */
  @Patch('admin/vehicle/:vehicleId/last-oil-km')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('OIL')
  adminPatchVehicleLastOilKm(
    @Param('vehicleId') vehicleId: string,
    @Body() body: { lastOilChangeKm?: string },
    @CurrentUser() user: JwtUser,
  ) {
    const raw = body?.lastOilChangeKm;
    const km = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
    if (!Number.isFinite(km)) {
      throw new BadRequestException('oil_change.invalid_km_at_change');
    }
    return this.oil.adminPatchVehicleLastOilKm({
      vehicleId,
      lastOilChangeKm: km,
      actorUserId: user.userId,
    });
  }

  /** Admin: yuborilgan moy yozuvidagi km ni tuzatish */
  @Patch('admin/:id/km')
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('OIL')
  adminPatchReportKm(
    @Param('id') id: string,
    @Body() body: { kmAtChange?: string },
    @CurrentUser() user: JwtUser,
  ) {
    const raw = body?.kmAtChange;
    const km = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
    if (!Number.isFinite(km)) {
      throw new BadRequestException('oil_change.invalid_km_at_change');
    }
    return this.oil.adminPatchReportKm({
      reportId: id,
      kmAtChange: km,
      actorUserId: user.userId,
    });
  }
}
