import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ADMIN_ROUTE_PAGE_KEY } from '../decorators/admin-route-page.decorator';
import type { AdminPageKey } from '../admin-page-keys';
import { JwtUser } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser | undefined;
    if (!user) return false;

    const driverOnly =
      required.includes(UserRole.DRIVER) && !required.includes(UserRole.ADMIN);
    if (driverOnly) {
      return user.role === UserRole.DRIVER;
    }

    const adminOnly =
      required.includes(UserRole.ADMIN) && !required.includes(UserRole.DRIVER);
    if (adminOnly) {
      if (user.role === UserRole.ADMIN) return true;
      if (user.role === UserRole.OPERATOR) {
        const page = this.reflector.getAllAndOverride<AdminPageKey>(ADMIN_ROUTE_PAGE_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);
        if (!page) return false;
        const row = await this.prisma.user.findUnique({
          where: { id: user.userId },
          select: { allowedPages: true },
        });
        return row?.allowedPages?.includes(page) ?? false;
      }
      return false;
    }

    return required.some((r) => r === user.role);
  }
}
