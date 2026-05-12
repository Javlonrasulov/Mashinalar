import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminOperatorDto } from './dto/create-admin-operator.dto';
import { UpdateAdminOperatorDto } from './dto/update-admin-operator.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listOperators() {
    return this.prisma.user.findMany({
      where: { role: UserRole.OPERATOR },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        login: true,
        position: true,
        allowedPages: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(dto: CreateAdminOperatorDto) {
    const login = dto.login.trim().toLowerCase();
    const exists = await this.prisma.user.findFirst({
      where: { login: { equals: login, mode: 'insensitive' } },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('login_taken');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        login,
        passwordHash,
        role: UserRole.OPERATOR,
        position: dto.position.trim(),
        allowedPages: [...new Set(dto.allowedPages)],
      },
      select: {
        id: true,
        login: true,
        position: true,
        allowedPages: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async update(actorUserId: string, id: string, dto: UpdateAdminOperatorDto) {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row || row.role !== UserRole.OPERATOR) throw new NotFoundException();

    const data: {
      login?: string;
      passwordHash?: string;
      position?: string;
      allowedPages?: string[];
    } = {};

    if (dto.login != null) {
      const login = dto.login.trim().toLowerCase();
      if (login !== row.login.toLowerCase()) {
        const exists = await this.prisma.user.findFirst({
          where: {
            login: { equals: login, mode: 'insensitive' },
            id: { not: id },
          },
          select: { id: true },
        });
        if (exists) throw new BadRequestException('login_taken');
      }
      data.login = login;
    }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.position != null) {
      data.position = dto.position.trim();
    }

    if (dto.allowedPages != null) {
      data.allowedPages = [...new Set(dto.allowedPages)];
    }

    if (!Object.keys(data).length)
      throw new BadRequestException('Nothing to update');

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        login: true,
        position: true,
        allowedPages: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(actorUserId: string, id: string) {
    if (id === actorUserId) throw new ForbiddenException('Cannot delete self');
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row || row.role !== UserRole.OPERATOR) throw new NotFoundException();
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
