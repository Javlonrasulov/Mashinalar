import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
import { AdminRoutePage } from '../../common/decorators/admin-route-page.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FuelKind } from '@prisma/client';
import { FuelService } from './fuel.service';
import { FuelReconciliationService } from './fuel-reconciliation.service';
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

@Controller('fuel-reports')
export class FuelController {
  constructor(
    private readonly fuel: FuelService,
    private readonly reconciliation: FuelReconciliationService,
  ) {}

  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DRIVER)
  findMine(@CurrentUser() user: JwtUser, @Query('limit') limit?: string) {
    if (!user.driverId) throw new BadRequestException('No driver');
    return this.fuel.findMine(user.driverId, limit);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  findAll(
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('fuelKind') fuelKind?: string,
  ) {
    return this.fuel.findAll({ date, from, to, fuelKind });
  }

  /** Zapravkalar sahifasi: saqlangan yoki OSM (xarita) zapravka nomi. */
  @Get('nearest-station')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  nearestStation(@Query('lat') latQ?: string, @Query('lon') lonQ?: string) {
    const lat = Number(latQ);
    const lon = Number(lonQ);
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
      throw new BadRequestException('Invalid coordinates');
    return this.fuel.nearestFuelStation(lat, lon);
  }

  /** Barcha eski yozuvlarga zapravka nomini qo‘llash (bir marta). */
  @Post('backfill-station-labels')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  backfillStationLabels() {
    return this.fuel.backfillStationLabels();
  }

  /** Ойлик сольиштириш: тизимдаги кунлик м³ + ведомость майдонлари */
  @Get('station-month-grid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  stationMonthGrid(
    @Query('savedFuelStationId') savedFuelStationId?: string,
    @Query('year') yearQ?: string,
    @Query('month') monthQ?: string,
    @Query('all') allQ?: string,
  ) {
    const id = savedFuelStationId?.trim();
    if (!id) throw new BadRequestException('savedFuelStationId required');
    const year = Number(yearQ);
    const month = Number(monthQ);
    return this.reconciliation.getMonthlyGrid({
      savedFuelStationId: id,
      year,
      month,
      includeAllFleet: allQ === '1',
    });
  }

  @Put('station-month-actual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  putStationMonthActual(
    @Body()
    body: {
      savedFuelStationId?: string;
      vehicleId?: string;
      year?: number;
      month?: number;
      day?: number;
      actualM3?: number | string | null;
    },
  ) {
    const sid = body.savedFuelStationId?.trim();
    const vid = body.vehicleId?.trim();
    const year = Number(body.year);
    const month = Number(body.month);
    const day = Number(body.day);
    const raw = body.actualM3;
    let actualM3: number | null = null;
    if (raw === '' || raw === undefined || raw === null) {
      actualM3 = null;
    } else {
      actualM3 = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(actualM3)) actualM3 = null;
    }
    if (!sid || !vid)
      throw new BadRequestException('savedFuelStationId and vehicleId required');
    return this.reconciliation.upsertMonthActual({
      savedFuelStationId: sid,
      vehicleId: vid,
      year,
      month,
      day,
      actualM3,
    });
  }

  @Post('vedomost-snapshot')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  createVedomostSnapshot(
    @Body()
    body: {
      savedFuelStationId?: string;
      year?: number;
      month?: number;
      all?: string;
    },
  ) {
    const sid = body.savedFuelStationId?.trim();
    const year = Number(body.year);
    const month = Number(body.month);
    if (!sid) throw new BadRequestException('savedFuelStationId required');
    return this.reconciliation.createVedomostSnapshot({
      savedFuelStationId: sid,
      year,
      month,
      includeAllFleet: body.all === '1',
    });
  }

  @Get('vedomost-snapshots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  listVedomostSnapshots(
    @Query('savedFuelStationId') savedFuelStationId?: string,
    @Query('year') yearQ?: string,
    @Query('month') monthQ?: string,
  ) {
    const id = savedFuelStationId?.trim();
    if (!id) throw new BadRequestException('savedFuelStationId required');
    const year = Number(yearQ);
    const month = Number(monthQ);
    return this.reconciliation.listVedomostSnapshots({
      savedFuelStationId: id,
      year,
      month,
    });
  }

  @Get('vedomost-snapshot/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  getVedomostSnapshot(@Param('id') id: string) {
    return this.reconciliation.getVedomostSnapshot(id.trim());
  }

  @Put('vedomost-snapshot/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  updateVedomostSnapshot(
    @Param('id') id: string,
    @Body() body: { all?: string },
  ) {
    return this.reconciliation.updateVedomostSnapshot(id.trim(), {
      includeAllFleet: body.all === '1',
    });
  }

  @Post('vedomost-snapshot/:id/apply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  applyVedomostSnapshot(@Param('id') id: string) {
    return this.reconciliation.applyVedomostSnapshotToMonthActuals(id.trim());
  }

  /** Барча ёзувлар учун GPS → сақланган заправка номи ёки OSM (координата тузатилгандан кейин). */
  @Post('resync-stations-from-gps')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoutePage('FUEL')
  resyncStationsFromGps() {
    return this.fuel.resyncStationsFromGps();
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
    @Body()
    body: {
      amount?: string;
      fuelKind?: string;
      unitPrice?: string;
      latitude?: string;
      longitude?: string;
    },
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.driverId) throw new BadRequestException('No driver');
    const amount = body.amount ? Number(body.amount) : NaN;
    if (!Number.isFinite(amount) || amount <= 0)
      throw new BadRequestException('Invalid amount');

    const kindRaw = (body.fuelKind ?? 'GAS').trim().toUpperCase();
    if (kindRaw !== 'GAS' && kindRaw !== 'PETROL') {
      throw new BadRequestException('fuel.invalid_fuel_kind');
    }
    const fuelKind = kindRaw as FuelKind;

    const unitPriceRaw =
      body.unitPrice != null && body.unitPrice !== ''
        ? Number(body.unitPrice)
        : undefined;
    if (
      unitPriceRaw !== undefined &&
      (!Number.isFinite(unitPriceRaw) || unitPriceRaw <= 0)
    ) {
      throw new BadRequestException('fuel.invalid_unit_price');
    }

    await compressMulterFiles(files);

    const base = '/uploads';
    const vehiclePhotoUrl = files?.vehiclePhoto?.[0]
      ? `${base}/${files.vehiclePhoto[0].filename}`
      : undefined;
    const receiptPhotoUrl = files?.receiptPhoto?.[0]
      ? `${base}/${files.receiptPhoto[0].filename}`
      : undefined;

    return this.fuel.createFromDriver({
      driverId: user.driverId,
      amount,
      fuelKind,
      unitPrice: unitPriceRaw,
      vehiclePhotoUrl,
      receiptPhotoUrl,
      latitude: body.latitude !== undefined ? Number(body.latitude) : undefined,
      longitude:
        body.longitude !== undefined ? Number(body.longitude) : undefined,
      actorUserId: user.userId,
    });
  }
}
