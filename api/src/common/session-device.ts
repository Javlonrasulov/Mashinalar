import { createHash } from 'crypto';
import type { Request } from 'express';

export type SessionTouchCtx = {
  ip: string | null;
  userAgent: string | null;
  deviceId?: string | null;
  deviceLabel?: string | null;
};

export function extractIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0)
    return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.ip ?? req.socket?.remoteAddress ?? '';
}

function headerOne(req: Request, name: string): string {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v) && v.length > 0) return v[0].trim();
  return '';
}

export function sessionTouchFromRequest(req: Request): SessionTouchCtx {
  return {
    ip: extractIp(req) || null,
    userAgent:
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null,
    deviceId: headerOne(req, 'x-device-id') || null,
    deviceLabel: headerOne(req, 'x-device-label') || null,
  };
}

export function sessionFingerprint(ctx: SessionTouchCtx): string {
  const deviceId = (ctx.deviceId ?? '').trim();
  if (deviceId) {
    return createHash('sha256').update(`device:${deviceId}`).digest('hex');
  }
  const safeIp = (ctx.ip ?? '').toString().slice(0, 64);
  const safeUa = (ctx.userAgent ?? '').toString().slice(0, 256);
  return createHash('sha256').update(`${safeIp}|${safeUa}`).digest('hex');
}

/** Admin panelda ko‘rsatiladigan qisqa qurilma nomi. */
export function sessionDisplayLabel(ctx: SessionTouchCtx): string | null {
  const label = (ctx.deviceLabel ?? '').trim();
  if (label) return label.slice(0, 256);
  const ua = (ctx.userAgent ?? '').trim();
  if (ua && !/^okhttp\//i.test(ua)) return ua.slice(0, 256);
  return ua ? ua.slice(0, 256) : null;
}
