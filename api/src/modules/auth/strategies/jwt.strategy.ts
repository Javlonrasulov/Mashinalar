import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { sessionTouchFromRequest } from '../../../common/session-device';
import { PrismaService } from '../../../prisma/prisma.service';
import { SessionsService } from '../../sessions/sessions.service';

export type JwtPayload = {
  sub: string;
  role: string;
  driverId?: string;
  /// Bumping `User.tokenEpoch` admin tomonidan barcha tokenlarni bekor qilish uchun.
  tokenEpoch?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
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

    const fp = this.sessions.fingerprintForRequest(sessionTouchFromRequest(req));
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
