import { Injectable } from '@nestjs/common';
import {
  sessionDisplayLabel,
  sessionFingerprint,
  type SessionTouchCtx,
} from '../../common/session-device';
import { PrismaService } from '../../prisma/prisma.service';
import {
  groupSegmentsByDay,
  mergeActivitySegments,
  type ActivityDayDto,
} from './session-activity.util';

/** «Hozir faol qurilma» chegarasi — millisekundlarda. */
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;
const EVENT_LOG_MIN_INTERVAL_MS = 5 * 60 * 1000;

export type SessionInfo = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
};

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async upsert(
    userId: string,
    ctx: SessionTouchCtx,
    clearRevoked: boolean,
  ) {
    const fp = sessionFingerprint(ctx);
    const label = sessionDisplayLabel(ctx);
    const safeIp = (ctx.ip ?? '').toString().slice(0, 64) || null;

    await this.prisma.userSession.upsert({
      where: { userId_fingerprint: { userId, fingerprint: fp } },
      create: {
        userId,
        fingerprint: fp,
        ip: safeIp,
        userAgent: label,
      },
      update: {
        lastSeenAt: new Date(),
        ip: safeIp,
        userAgent: label,
        ...(clearRevoked ? { revokedAt: null } : {}),
      },
    });

    return { fingerprint: fp, label: label ?? null };
  }

  private async logActivityEvent(
    userId: string,
    fingerprint: string,
    deviceLabel: string | null,
    force: boolean,
  ) {
    if (!force) {
      const since = new Date(Date.now() - EVENT_LOG_MIN_INTERVAL_MS);
      const recent = await this.prisma.userSessionEvent.findFirst({
        where: { userId, fingerprint, recordedAt: { gte: since } },
        select: { id: true },
      });
      if (recent) return;
    }
    await this.prisma.userSessionEvent.create({
      data: {
        userId,
        fingerprint,
        deviceLabel: deviceLabel?.slice(0, 256) ?? null,
      },
    });
  }

  /** Loginda — revoke holatini tozalaydi. */
  async touchOnLogin(userId: string, ctx: SessionTouchCtx) {
    const { fingerprint, label } = await this.upsert(userId, ctx, true);
    await this.logActivityEvent(userId, fingerprint, label, true);
  }

  /** GPS / boshqa so‘rovlar — revoke holatini o‘zgartirmaydi. */
  async touch(userId: string, ctx: SessionTouchCtx) {
    const { fingerprint, label } = await this.upsert(userId, ctx, false);
    await this.logActivityEvent(userId, fingerprint, label, false);
  }

  /** JWT tekshiruvi uchun fingerprint. */
  fingerprintForRequest(ctx: SessionTouchCtx): string {
    return sessionFingerprint(ctx);
  }

  async countActiveByUserIds(userIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (userIds.length === 0) return result;
    const since = new Date(Date.now() - ACTIVE_WINDOW_MS);
    const rows = await this.prisma.userSession.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        lastSeenAt: { gte: since },
        revokedAt: null,
      },
      _count: { _all: true },
    });
    for (const r of rows) result.set(r.userId, r._count._all);
    return result;
  }

  async listForUser(userId: string): Promise<SessionInfo[]> {
    const rows = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      ip: r.ip,
      userAgent: r.userAgent,
      firstSeenAt: r.firstSeenAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    }));
  }

  async revokeOne(userId: string, sessionId: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenEpoch: { increment: 1 } },
      }),
      this.prisma.userSession.deleteMany({ where: { userId } }),
    ]);
  }

  /**
   * Tanlangan sanalar oralig‘ida ilova faol vaqti (GPS nuqtalari + sessiya pinglari).
   */
  async appActivityForDriver(
    driverId: string,
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{ days: ActivityDayDto[]; totalMinutes: number }> {
    const [events, points] = await Promise.all([
      this.prisma.userSessionEvent.findMany({
        where: { userId, recordedAt: { gte: from, lte: to } },
        select: { recordedAt: true },
      }),
      this.prisma.locationPoint.findMany({
        where: { driverId, recordedAt: { gte: from, lte: to } },
        select: { recordedAt: true },
      }),
    ]);

    const times = [
      ...events.map((e) => e.recordedAt),
      ...points.map((p) => p.recordedAt),
    ];
    const segments = mergeActivitySegments(times);
    const days = groupSegmentsByDay(segments);
    const totalMinutes = days.reduce((s, d) => s + d.totalMinutes, 0);
    return { days, totalMinutes };
  }
}
