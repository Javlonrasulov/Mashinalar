/** Parse `YYYY-MM-DD` as local calendar date. */
export function parseYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export type SpentDateRangeYmd = { from: string; to: string };

/** Adds `spentFrom` / `spentTo` (ISO) to query params for API filtering. */
export function appendSpentRangeParams(p: URLSearchParams, range: SpentDateRangeYmd | null | undefined) {
  if (!range?.from || !range?.to) return;
  const fromD = parseYmd(range.from);
  const toD = parseYmd(range.to);
  if (!Number.isFinite(fromD.getTime()) || !Number.isFinite(toD.getTime())) return;
  p.set('spentFrom', startOfLocalDay(fromD).toISOString());
  p.set('spentTo', endOfLocalDay(toD).toISOString());
}
