import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FuelService } from './fuel.service';

const uploadDir = join(process.cwd(), 'uploads');

function ensureUploadDir() {
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
}

function fileName(_req: unknown, file: Express.Multer.File, cb: (e: Error | null, name: string) => void) {
  const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
  cb(null, name);
}

@Controller('fuel-reports')
export class FuelController {
  constructor(private readonly fuel: FuelService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(@Query('date') date?: string) {
    return this.fuel.findAll({ date });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'vehiclePhoto', maxCount: 1 },
        { name: 'receiptPhoto', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: (_req, _file, cb) => {
            ensureUploadDir();
            cb(null, uploadDir);
          },
          filename: fileName,
        }),
        limits: { fileSize: 8 * 1024 * 1024 },
      },
    ),
  )
  async create(
    @UploadedFiles()
    files: {
      vehiclePhoto?: Express.Multer.File[];
      receiptPhoto?: Express.Multer.File[];
    },
    @Body() body: { amount?: string; latitude?: string; longitude?: string },
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.driverId) throw new BadRequestException('No driver');
    const amount = body.amount ? Number(body.amount) : NaN;
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Invalid amount');

    const base = '/uploads';
    const vehiclePhotoUrl = files?.vehiclePhoto?.[0] ? `${base}/${files.vehiclePhoto[0].filename}` : undefined;
    const receiptPhotoUrl = files?.receiptPhoto?.[0] ? `${base}/${files.receiptPhoto[0].filename}` : undefined;

    return this.fuel.createFromDriver({
      driverId: user.driverId,
      amount,
      vehiclePhotoUrl,
      receiptPhotoUrl,
      latitude: body.latitude !== undefined ? Number(body.latitude) : undefined,
      longitude: body.longitude !== undefined ? Number(body.longitude) : undefined,
      actorUserId: user.userId,
    });
  }
}
