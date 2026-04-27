import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateVehicleCategoryDto } from './dto/create-vehicle-category.dto';
import { UpdateVehicleCategoryDto } from './dto/update-vehicle-category.dto';

@Injectable()
export class VehicleCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.vehicleCategory.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateVehicleCategoryDto, actorUserId: string) {
    const created = await this.prisma.vehicleCategory.create({ data: { name: dto.name } });
    await this.audit.log({
      actorUserId,
      action: 'vehicleCategory.create',
      entity: 'VehicleCategory',
      entityId: created.id,
    });
    return created;
  }

  async update(id: string, dto: UpdateVehicleCategoryDto, actorUserId: string) {
    const exists = await this.prisma.vehicleCategory.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('VehicleCategory not found');
    const updated = await this.prisma.vehicleCategory.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
    });
    await this.audit.log({
      actorUserId,
      action: 'vehicleCategory.update',
      entity: 'VehicleCategory',
      entityId: id,
    });
    return updated;
  }

  async remove(id: string, actorUserId: string) {
    const exists = await this.prisma.vehicleCategory.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('VehicleCategory not found');
    await this.prisma.vehicleCategory.delete({ where: { id } });
    await this.audit.log({
      actorUserId,
      action: 'vehicleCategory.delete',
      entity: 'VehicleCategory',
      entityId: id,
    });
    return { ok: true };
  }
}

