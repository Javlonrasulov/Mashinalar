import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OilChangeService } from './oil-change.service';

const uploadDir = join(process.cwd(), 'uploads');

function ensureUploadDir() {
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
}

function fileName(_req: unknown, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) {
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
    if (!Number.isFinite(km) || km <= 0) throw new BadRequestException('Invalid kmAtChange');
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
  adminOverview() {
    return this.oil.adminOverview();
  }

  @Get('admin/list')
  @Roles(UserRole.ADMIN)
  adminList(@Query('limit') limit?: string) {
    return this.oil.adminListReports(limit);
  }
}
