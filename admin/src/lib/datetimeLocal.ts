/** Value for `datetime-local`-style fields: local time as `YYYY-MM-DDTHH:mm`. */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Parse local datetime from `YYYY-MM-DDTHH:mm` (optionally with seconds / timezone tail).
 * Avoid naive `split(':')` on ISO strings — it can mis-read hour/minute for some formats.
 */
export function parseDatetimeLocalValue(s: string): Date {
  const raw = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{1,2})/.exec(raw);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return new Date();
    return new Date(
      y,
      mo - 1,
      d,
      Number.isFinite(h) ? h : 0,
      Number.isFinite(mi) ? mi : 0,
      0,
      0,
    );
  }

  const [datePart] = raw.split(/[T\s]/);
  const [y, mo, day] = datePart.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return new Date();
  return new Date(y, mo - 1, day, 0, 0, 0, 0);
}
