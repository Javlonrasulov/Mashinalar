import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from './strategies/jwt.strategy';
import { LoginDto } from './dto/login.dto';
import { UpdateCredentialsDto } from './dto/update-credentials.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { login: dto.login },
      include: { driver: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (user.role === UserRole.OPERATOR && (!user.allowedPages || user.allowedPages.length === 0)) {
      throw new UnauthorizedException('operator_no_pages');
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      driverId: user.driver?.id,
    };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      user: {
        id: user.id,
        role: user.role,
        login: user.login,
        position: user.position,
        allowedPages: user.allowedPages ?? [],
        driver: user.driver
          ? {
              id: user.driver.id,
              fullName: user.driver.fullName,
              phone: user.driver.phone,
              vehicleId: user.driver.vehicleId,
            }
          : null,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });
    if (!user) throw new UnauthorizedException();
    if (user.role === UserRole.OPERATOR && (!user.allowedPages || user.allowedPages.length === 0)) {
      throw new UnauthorizedException('operator_no_pages');
    }
    return {
      id: user.id,
      role: user.role,
      login: user.login,
      position: user.position,
      allowedPages: user.allowedPages ?? [],
      driver: user.driver
        ? {
            id: user.driver.id,
            fullName: user.driver.fullName,
            phone: user.driver.phone,
            vehicleId: user.driver.vehicleId,
          }
        : null,
    };
  }

  async validateUserForWs(userId: string): Promise<JwtPayload | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driver: true },
    });
    if (!user) return null;
    return {
      sub: user.id,
      role: user.role,
      driverId: user.driver?.id,
    };
  }

  async updateCredentials(userId: string, dto: UpdateCredentialsDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    // 401 bu yerda emas: klient interceptor har qanday 401’da tokenni tozalaydi.
    if (!ok) throw new BadRequestException('Invalid credentials');

    const data: { login?: string; passwordHash?: string } = {};

    if (dto.login && dto.login !== user.login) {
      const exists = await this.prisma.user.findUnique({ where: { login: dto.login } });
      if (exists) throw new BadRequestException('Login already exists');
      data.login = dto.login;
    }

    if (dto.newPassword) {
      data.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    if (!data.login && !data.passwordHash) {
      throw new BadRequestException('Nothing to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
      include: { driver: true },
    });

    return {
      id: updated.id,
      role: updated.role,
      login: updated.login,
      driver: updated.driver
        ? {
            id: updated.driver.id,
            fullName: updated.driver.fullName,
            phone: updated.driver.phone,
            vehicleId: updated.driver.vehicleId,
          }
        : null,
    };
  }
}
