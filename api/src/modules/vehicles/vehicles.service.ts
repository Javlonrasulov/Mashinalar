import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        drivers: { include: { user: { select: { login: true } } } },
      },
    });
  }

  async findOne(id: string) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { drivers: true },
    });
    if (!v) throw new NotFoundException('Vehicle not found');
    return v;
  }

  async findMineForDriver(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { vehicle: true },
    });
    if (!driver?.vehicleId || !driver.vehicle) {
      return { vehicle: null, oil: null, insurance: null };
    }

    const v = driver.vehicle;
    const lastOilKm = v.lastOilChangeKm ? Number(v.lastOilChangeKm) : null;
    const interval = v.oilChangeIntervalKm ?? null;
    const nextOilKm =
      lastOilKm !== null && interval !== null && interval > 0 ? lastOilKm + interval : null;

    const insuranceEnd = v.insuranceEndDate;
    const daysToInsuranceEnd = insuranceEnd
      ? Math.ceil((insuranceEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      vehicle: {
        id: v.id,
        name: v.name,
        model: v.model,
        plateNumber: v.plateNumber,
        initialKm: Number(v.initialKm),
      },
      oil: {
        lastOilChangeKm: lastOilKm,
        lastOilChangeAt: v.lastOilChangeAt ? v.lastOilChangeAt.toISOString() : null,
        oilChangeIntervalKm: interval,
        nextOilChangeKm: nextOilKm,
      },
      insurance: {
        insuranceStartDate: v.insuranceStartDate ? v.insuranceStartDate.toISOString() : null,
        insuranceEndDate: insuranceEnd ? insuranceEnd.toISOString() : null,
        daysToEnd: daysToInsuranceEnd,
        warnWithinDays: 3,
        isWarn: daysToInsuranceEnd !== null && daysToInsuranceEnd <= 3,
      },
    };
  }

  async create(dto: CreateVehicleDto, actorUserId: string) {
    const data: Prisma.VehicleCreateInput = {
      name: dto.name,
      model: dto.model,
      plateNumber: dto.plateNumber,
      initialKm: dto.initialKm,
      lastOilChangeKm: dto.lastOilChangeKm,
      lastOilChangeAt: dto.lastOilChangeAt ? new Date(dto.lastOilChangeAt) : undefined,
      oilChangeIntervalKm: dto.oilChangeIntervalKm,
      insuranceStartDate: dto.insuranceStartDate ? new Date(dto.insuranceStartDate) : undefined,
      insuranceEndDate: dto.insuranceEndDate ? new Date(dto.insuranceEndDate) : undefined,
    };
    const created = await this.prisma.vehicle.create({ data });
    await this.audit.log({
      actorUserId,
      action: 'vehicle.create',
      entity: 'Vehicle',
      entityId: created.id,
      meta: { plateNumber: created.plateNumber },
    });
    return created;
  }

  async update(id: string, dto: UpdateVehicleDto, actorUserId: string) {
    await this.findOne(id);
    const data: Prisma.VehicleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.plateNumber !== undefined) data.plateNumber = dto.plateNumber;
    if (dto.initialKm !== undefined) data.initialKm = dto.initialKm;
    if (dto.lastOilChangeKm !== undefined) data.lastOilChangeKm = dto.lastOilChangeKm;
    if (dto.lastOilChangeAt !== undefined) data.lastOilChangeAt = new Date(dto.lastOilChangeAt);
    if (dto.oilChangeIntervalKm !== undefined) data.oilChangeIntervalKm = dto.oilChangeIntervalKm;
    if (dto.insuranceStartDate !== undefined)
      data.insuranceStartDate = dto.insuranceStartDate ? new Date(dto.insuranceStartDate) : null;
    if (dto.insuranceEndDate !== undefined)
      data.insuranceEndDate = dto.insuranceEndDate ? new Date(dto.insuranceEndDate) : null;

    const updated = await this.prisma.vehicle.update({ where: { id }, data });
    await this.audit.log({
      actorUserId,
      action: 'vehicle.update',
      entity: 'Vehicle',
      entityId: id,
    });
    return updated;
  }

  async remove(id: string, actorUserId: string) {
    await this.findOne(id);
    await this.prisma.vehicle.delete({ where: { id } });
    await this.audit.log({
      actorUserId,
      action: 'vehicle.delete',
      entity: 'Vehicle',
      entityId: id,
    });
    return { ok: true };
  }
}
