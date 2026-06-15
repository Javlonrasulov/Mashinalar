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

export function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive list of `YYYY-MM-DD` from `from` through `to` (local calendar). */
export function enumerateYmdRange(from: string, to: string): string[] {
  const start = startOfLocalDay(parseYmd(from));
  const end = startOfLocalDay(parseYmd(to));
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return [];
  if (end.getTime() < start.getTime()) return [];
  const out: string[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(formatYmd(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Default: current calendar month, day 1 through today (local). */
export function defaultExpenseDateRange(): SpentDateRangeYmd {
  const to = startOfLocalDay(new Date());
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: formatYmd(from), to: formatYmd(to) };
}

/** Adds `spentFrom` / `spentTo` (ISO) to query params for API filtering. */
export function appendSpentRangeParams(p: URLSearchParams, range: SpentDateRangeYmd | null | undefined) {
  if (!range?.from || !range?.to) return;
  const fromD = parseYmd(range.from);
  const toD = parseYmd(range.to);
  if (!Number.isFinite(fromD.getTime()) || !Number.isFinite(toD.getTime())) return;
  p.set('spentFrom', startOfLocalDay(fromD).toISOString());
  p.set('spentTo', endOfLocalDay(toD).toISOString());
  p.set('rangeFrom', range.from);
  p.set('rangeTo', range.to);
  p.set('tzOffset', String(new Date().getTimezoneOffset()));
}
