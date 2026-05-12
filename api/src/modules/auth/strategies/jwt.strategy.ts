import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { createHash } from 'crypto';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  role: string;
  driverId?: string;
  /// Bumping `User.tokenEpoch` admin tomonidan barcha tokenlarni bekor qilish uchun.
  tokenEpoch?: number;
};

function extractIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0)
    return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.ip ?? req.socket?.remoteAddress ?? '';
}

function fingerprintFor(ip: string, userAgent: string): string {
  const safeIp = (ip ?? '').toString().slice(0, 64);
  const safeUa = (userAgent ?? '').toString().slice(0, 256);
  return createHash('sha256').update(`${safeIp}|${safeUa}`).digest('hex');
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, tokenEpoch: true },
    });
    if (!user) throw new UnauthorizedException();

    const payloadEpoch = payload.tokenEpoch ?? 0;
    if (payloadEpoch !== user.tokenEpoch) {
      throw new UnauthorizedException('token_revoked');
    }

    const ua =
      typeof req.headers['user-agent'] === 'string'
        ? (req.headers['user-agent'] as string)
        : '';
    const fp = fingerprintFor(extractIp(req), ua);
    const session = await this.prisma.userSession.findUnique({
      where: { userId_fingerprint: { userId: payload.sub, fingerprint: fp } },
      select: { revokedAt: true },
    });
    if (session?.revokedAt) {
      throw new UnauthorizedException('session_revoked');
    }

    return {
      userId: payload.sub,
      role: payload.role,
      driverId: payload.driverId,
    };
  }
}
