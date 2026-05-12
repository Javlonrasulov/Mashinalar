import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/** «Hozir faol qurilma» chegarasi — millisekundlarda. */
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

function fingerprint(ip: string, userAgent: string): string {
  return createHash('sha256').update(`${ip}|${userAgent}`).digest('hex');
}

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

  /** Loginda chaqiriladi — yangi/mavjud sessiyani aktivlashtirib, revokedAt'ni nolga tushiradi. */
  async touchOnLogin(
    userId: string,
    ip: string | null,
    userAgent: string | null,
  ) {
    const safeIp = (ip ?? '').toString().slice(0, 64);
    const safeUa = (userAgent ?? '').toString().slice(0, 256);
    const fp = fingerprint(safeIp, safeUa);
    await this.prisma.userSession.upsert({
      where: { userId_fingerprint: { userId, fingerprint: fp } },
      create: {
        userId,
        fingerprint: fp,
        ip: safeIp || null,
        userAgent: safeUa || null,
      },
      update: {
        lastSeenAt: new Date(),
        ip: safeIp || null,
        userAgent: safeUa || null,
        revokedAt: null,
      },
    });
  }

  /** Login emas — boshqa authenticated request da. Revoke holatini o‘zgartirmaydi. */
  async touch(userId: string, ip: string | null, userAgent: string | null) {
    const safeIp = (ip ?? '').toString().slice(0, 64);
    const safeUa = (userAgent ?? '').toString().slice(0, 256);
    const fp = fingerprint(safeIp, safeUa);
    await this.prisma.userSession.upsert({
      where: { userId_fingerprint: { userId, fingerprint: fp } },
      create: {
        userId,
        fingerprint: fp,
        ip: safeIp || null,
        userAgent: safeUa || null,
      },
      update: {
        lastSeenAt: new Date(),
        ip: safeIp || null,
        userAgent: safeUa || null,
      },
    });
  }

  /** Bir userId uchun oxirgi N daqiqada faol (va revoke qilinmagan) qurilmalar soni. */
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

  /** Foydalanuvchining barcha sessiyalari (eng yangi birinchi). */
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

  /** Bitta sessiyani chiqarib yuborish — qayta loginsiz ilova qaytadan ishlamaydi. */
  async revokeOne(userId: string, sessionId: string) {
    await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() },
    });
  }

  /** Foydalanuvchining barcha sessiyalarini chiqarish: epoch oshiriladi + sessiyalar o‘chiriladi. */
  async revokeAllForUser(userId: string) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenEpoch: { increment: 1 } },
      }),
      this.prisma.userSession.deleteMany({ where: { userId } }),
    ]);
  }
}
