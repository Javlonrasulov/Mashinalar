import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OilChangeService } from '../oil-change/oil-change.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly oilChange: OilChangeService,
  ) {}

  findAll() {
    return this.prisma.vehicle.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        drivers: { include: { user: { select: { login: true } } } },
        category: true,
      },
    });
  }

  async findOne(id: string) {
    const v = await this.prisma.vehicle.findUnique({
      where: { id },
      include: { drivers: true, category: true },
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

    const estimatedCurrentKm = await this.oilChange.estimateOdometerKm(v.id);
    const kmRemainingToNext = nextOilKm != null ? nextOilKm - estimatedCurrentKm : null;
    const oilUrgency = OilChangeService.urgency(kmRemainingToNext, interval);

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
        estimatedCurrentKm,
        kmRemainingToNext,
        oilUrgency,
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
      category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
      name: dto.name,
      model: dto.model,
      plateNumber: dto.plateNumber,
      initialKm: dto.initialKm,
      lastOilChangeKm: dto.lastOilChangeKm,
      lastOilChangeAt: dto.lastOilChangeAt ? new Date(dto.lastOilChangeAt) : undefined,
      oilChangeIntervalKm: dto.oilChangeIntervalKm,
      insuranceStartDate: dto.insuranceStartDate ? new Date(dto.insuranceStartDate) : undefined,
      insuranceEndDate: dto.insuranceEndDate ? new Date(dto.insuranceEndDate) : undefined,
      inspectionStartDate: dto.inspectionStartDate ? new Date(dto.inspectionStartDate) : undefined,
      inspectionEndDate: dto.inspectionEndDate ? new Date(dto.inspectionEndDate) : undefined,
      gasStartDate: dto.gasStartDate ? new Date(dto.gasStartDate) : undefined,
      gasEndDate: dto.gasEndDate ? new Date(dto.gasEndDate) : undefined,
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
    if (dto.categoryId !== undefined) {
      data.category = dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true };
    }
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
    if (dto.inspectionStartDate !== undefined)
      data.inspectionStartDate = dto.inspectionStartDate ? new Date(dto.inspectionStartDate) : null;
    if (dto.inspectionEndDate !== undefined)
      data.inspectionEndDate = dto.inspectionEndDate ? new Date(dto.inspectionEndDate) : null;
    if (dto.gasStartDate !== undefined) data.gasStartDate = dto.gasStartDate ? new Date(dto.gasStartDate) : null;
    if (dto.gasEndDate !== undefined) data.gasEndDate = dto.gasEndDate ? new Date(dto.gasEndDate) : null;

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

  async driverHistory(vehicleId: string) {
    await this.findOne(vehicleId);
    return this.prisma.driverVehicleAssignment.findMany({
      where: { vehicleId },
      orderBy: { startAt: 'desc' },
      include: {
        driver: { select: { id: true, fullName: true, phone: true, user: { select: { login: true } } } },
      },
    });
  }

  /**
   * Assign (or unassign) driver to a vehicle, keeping history.
   */
  async assignDriver(
    vehicleId: string,
    dto: { driverId?: string | null; startAt?: string },
    actorUserId: string,
  ) {
    await this.findOne(vehicleId);
    const startAt = dto.startAt ? new Date(dto.startAt) : new Date();
    if (!Number.isFinite(startAt.getTime())) throw new BadRequestException('Invalid startAt');

    return this.prisma.$transaction(async (tx) => {
      // End any current assignment for this vehicle
      await tx.driverVehicleAssignment.updateMany({
        where: { vehicleId, endAt: null },
        data: { endAt: startAt },
      });

      // Unassign current driver from this vehicle (if any)
      await tx.driver.updateMany({
        where: { vehicleId },
        data: { vehicleId: null },
      });

      if (!dto.driverId) {
        await this.audit.log({
          actorUserId,
          action: 'vehicle.assignDriver',
          entity: 'Vehicle',
          entityId: vehicleId,
          meta: { driverId: null, startAt: startAt.toISOString() },
        });
        return { ok: true };
      }

      const driver = await tx.driver.findUnique({ where: { id: dto.driverId } });
      if (!driver) throw new NotFoundException('Driver not found');

      // End any current assignment for this driver
      await tx.driverVehicleAssignment.updateMany({
        where: { driverId: dto.driverId, endAt: null },
        data: { endAt: startAt },
      });

      // Assign driver to this vehicle
      await tx.driver.update({
        where: { id: dto.driverId },
        data: { vehicleId },
      });

      const row = await tx.driverVehicleAssignment.create({
        data: { driverId: dto.driverId, vehicleId, startAt },
      });

      await this.audit.log({
        actorUserId,
        action: 'vehicle.assignDriver',
        entity: 'Vehicle',
        entityId: vehicleId,
        meta: { driverId: dto.driverId, startAt: startAt.toISOString(), assignmentId: row.id },
      });

      return { ok: true, assignmentId: row.id };
    });
  }
}
