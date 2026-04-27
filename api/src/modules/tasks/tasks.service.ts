import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllAdmin() {
    return this.prisma.task.findMany({
      orderBy: { deadlineAt: 'asc' },
      include: { vehicle: true, driver: true },
    });
  }

  findMine(driverId: string) {
    return this.prisma.task.findMany({
      where: { driverId },
      orderBy: { deadlineAt: 'asc' },
      include: { vehicle: true },
    });
  }

  findMineActive(driverId: string) {
    return this.prisma.task.findMany({
      where: {
        driverId,
        status: { in: [TaskStatus.PENDING, TaskStatus.REJECTED] },
      },
      orderBy: { deadlineAt: 'asc' },
      include: { vehicle: true },
    });
  }

  async create(dto: CreateTaskDto, actorUserId: string) {
    const task = await this.prisma.task.create({
      data: {
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        title: dto.title,
        deadlineAt: new Date(dto.deadlineAt),
        status: TaskStatus.PENDING,
      },
      include: { vehicle: true, driver: true },
    });
    await this.audit.log({
      actorUserId,
      action: 'task.create',
      entity: 'Task',
      entityId: task.id,
    });
    return task;
  }

  async submit(
    id: string,
    driverId: string,
    body: { proofText?: string; proofPhotoUrl?: string },
    actorUserId: string,
  ) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.driverId !== driverId) throw new ForbiddenException();
    const canSubmit =
      task.status === TaskStatus.PENDING || task.status === TaskStatus.REJECTED;
    if (!canSubmit) throw new BadRequestException('Already submitted or closed');

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.SUBMITTED,
        proofText: body.proofText,
        proofPhotoUrl: body.proofPhotoUrl,
        submittedAt: new Date(),
        ...(task.status === TaskStatus.REJECTED ? { reviewedAt: null } : {}),
      },
      include: { vehicle: true, driver: true },
    });
    await this.audit.log({
      actorUserId,
      action: 'task.submit',
      entity: 'Task',
      entityId: id,
    });
    return updated;
  }

  async review(id: string, status: 'APPROVED' | 'REJECTED', actorUserId: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== TaskStatus.SUBMITTED) throw new BadRequestException('Task not in submitted state');

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: status as TaskStatus, reviewedAt: new Date() },
      include: { vehicle: true, driver: true },
    });
    await this.audit.log({
      actorUserId,
      action: 'task.review',
      entity: 'Task',
      entityId: id,
      meta: { status },
    });
    return updated;
  }

  async remove(id: string, actorUserId: string, role: string) {
    if (role !== UserRole.ADMIN) throw new ForbiddenException();
    await this.prisma.task.delete({ where: { id } });
    await this.audit.log({
      actorUserId,
      action: 'task.delete',
      entity: 'Task',
      entityId: id,
    });
    return { ok: true };
  }
}
