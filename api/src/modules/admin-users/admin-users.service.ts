import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    const login = dto.login.trim();
    const exists = await this.prisma.user.findUnique({ where: { login } });
    if (exists) throw new BadRequestException('Login already exists');
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
      const login = dto.login.trim();
      if (login !== row.login) {
        const exists = await this.prisma.user.findUnique({ where: { login } });
        if (exists) throw new BadRequestException('Login already exists');
        data.login = login;
      }
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

    if (!Object.keys(data).length) throw new BadRequestException('Nothing to update');

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
