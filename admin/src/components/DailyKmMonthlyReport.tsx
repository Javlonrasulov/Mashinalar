import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Loader2, Maximize2, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useI18n, type Lang } from '@/i18n/I18nContext';
import { DatetimeLocalRangeField } from '@/components/DatetimeLocalRangeField';
import { SelectField } from '@/components/SelectField';
import { toDatetimeLocalValue } from '@/lib/datetimeLocal';

export type MonthlyGridDay = {
  date: string;
  hasStart: boolean;
  hasEnd: boolean;
};

export type MonthlyGridVehicle = {
  vehicleId: string;
  plateNumber: string;
  vehicleLabel: string;
  driverName: string;
  driverPhone: string;
  days: MonthlyGridDay[];
  completionPct: number;
  submittedCount: number;
  expectedCount: number;
};

export type MonthlyGridResponse = {
  from: string;
  to: string;
  fleetTotal: number;
  dayCount: number;
  days: string[];
  vehicles: MonthlyGridVehicle[];
};

type SortOrder = 'asc' | 'desc';

const H_SCROLL_STEP = 280;

function initMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

function initToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDatetimeLocalValue(d);
}

function toYmdRange(fromValue: string, toValue: string): { from: string; to: string } {
  const a = fromValue.slice(0, 10);
  const b = toValue.slice(0, 10);
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

function dayOfMonth(ymd: string): number {
  const p = ymd.slice(8, 10);
  const n = Number(p);
  return Number.isFinite(n) ? n : 0;
}

function formatYmdFull(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function formatYmdRangeLabel(from: string, to: string, lang: Lang): string {
  const loc = lang === 'ru' ? 'ru-RU' : lang === 'uzCyrl' ? 'ru-RU' : 'uz-Latn-UZ';
  const fmt = (ymd: string) => {
    const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!p) return ymd;
    const d = new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]));
    return new Intl.DateTimeFormat(loc, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  };
  return `${fmt(from)} — ${fmt(to)}`;
}

function formatDayList(
  dates: string[],
  tr: (key: string, vars?: Record<string, string>) => string,
  max = 14,
): string {
  if (dates.length === 0) return '—';
  const short = dates.map(formatYmdFull);
  if (short.length <= max) return short.join(', ');
  return `${short.slice(0, max).join(', ')} ${tr('dailyKmMonthlyCopyMoreDays', { n: String(short.length - max) })}`;
}

function formatMonthlyReportForCopy(
  vehicles: MonthlyGridVehicle[],
  from: string,
  to: string,
  dayCount: number,
  rangeLabel: string,
  tr: (key: string, vars?: Record<string, string>) => string,
): string {
  const lines: string[] = [
    `📊 ${tr('dailyKmTabMonthly')}`,
    `📅 ${rangeLabel}`,
    tr('dailyKmMonthlyCopyPeriod', {
      from: formatYmdFull(from),
      to: formatYmdFull(to),
      days: String(dayCount),
    }),
    tr('dailyKmMonthlyCopyFleet', { n: String(vehicles.length) }),
    '',
    `${tr('dailyKmMonthlyLegendTitle')}:`,
    `  🔵 ${tr('dailyKmMonthlyLegendStart')}`,
    `  🟢 ${tr('dailyKmMonthlyLegendEnd')}`,
    `  ⬜ ${tr('dailyKmMonthlyLegendMissing')}`,
    '',
    '————————————',
  ];

  vehicles.forEach((v, i) => {
    const startMissing = v.days.filter((d) => !d.hasStart).map((d) => d.date);
    const endMissing = v.days.filter((d) => d.hasStart && !d.hasEnd).map((d) => d.date);
    lines.push('');
    lines.push(`${i + 1}. ${v.plateNumber} · ${v.vehicleLabel}`);
    lines.push(`${tr('fullName')}: ${v.driverName}`);
    if (v.driverPhone.trim()) {
      lines.push(`${tr('phone')}: ${v.driverPhone.trim()}`);
    }
    lines.push(
      tr('dailyKmMonthlyCopyPct', {
        pct: String(v.completionPct),
        submitted: String(v.submittedCount),
        expected: String(v.expectedCount),
      }),
    );
    if (startMissing.length > 0) {
      lines.push(
        `${tr('dailyKmMonthlyCopyStartMissing')} (${startMissing.length}): ${formatDayList(startMissing, tr)}`,
      );
    }
    if (endMissing.length > 0) {
      lines.push(
        `${tr('dailyKmMonthlyCopyEndMissing')} (${endMissing.length}): ${formatDayList(endMissing, tr)}`,
      );
    }
  });

  return lines.join('\n');
}

function completionBarClass(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

function rowNoClass(pct: number): string {
  if (pct >= 100) return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  if (pct >= 70) return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
  return 'bg-red-100 text-red-800 dark:bg-red-950/45 dark:text-red-100';
}

function DayBars({ day }: { day: MonthlyGridDay }) {
  return (
    <div className="flex w-5 flex-col gap-px">
      <div
        className={clsx(
          'h-1.5 w-full rounded-sm',
          day.hasStart ? 'bg-blue-500 dark:bg-blue-400' : 'bg-slate-200 dark:bg-slate-700',
        )}
      />
      <div
        className={clsx(
          'h-1.5 w-full rounded-sm',
          day.hasEnd ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700',
        )}
      />
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
      <span className={clsx('inline-block h-1.5 w-6 rounded-sm', color)} aria-hidden />
      {label}
    </span>
  );
}

export function DailyKmMonthlyReport() {
  const { t, lang } = useI18n();
  const [fromValue, setFromValue] = useState(initMonthStart);
  const [toValue, setToValue] = useState(initToday);
  const [grid, setGrid] = useState<MonthlyGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [tableFullscreen, setTableFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const { from, to } = useMemo(() => toYmdRange(fromValue, toValue), [fromValue, toValue]);
  const rangeLabel = useMemo(() => formatYmdRangeLabel(from, to, lang), [from, to, lang]);

  const sortOptions = useMemo(
    () => [
      { value: 'asc' as const, label: t('dailyKmMonthlySortAsc') },
      { value: 'desc' as const, label: t('dailyKmMonthlySortDesc') },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    api<MonthlyGridResponse>(`/daily-km-reports/monthly-grid?${q}`)
      .then((data) => {
        if (!cancelled) setGrid(data);
      })
      .catch(() => {
        if (!cancelled) setGrid(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const searchTrim = searchQuery.trim().toLowerCase();
  const sortedVehicles = useMemo(() => {
    if (!grid) return [];
    let list = grid.vehicles;
    if (searchTrim) {
      list = list.filter((v) => {
        const parts = [v.plateNumber, v.vehicleLabel, v.driverName, v.driverPhone];
        return parts.some((p) => (p ?? '').toLowerCase().includes(searchTrim));
      });
    }
    const out = [...list];
    out.sort((a, b) => {
      const d = a.completionPct - b.completionPct;
      if (d !== 0) return sortOrder === 'asc' ? d : -d;
      return a.plateNumber.localeCompare(b.plateNumber, 'uz');
    });
    return out;
  }, [grid, searchTrim, sortOrder]);

  const days = grid?.days ?? [];

  const scrollTable = useCallback((dir: 'left' | 'right') => {
    const el = tableScrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === 'left' ? -H_SCROLL_STEP : H_SCROLL_STEP,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    if (!tableFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTableFullscreen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [tableFullscreen]);

  const copyReport = useCallback(async () => {
    if (!sortedVehicles.length || !grid) return;
    const text = formatMonthlyReportForCopy(
      sortedVehicles,
      grid.from,
      grid.to,
      grid.dayCount,
      rangeLabel,
      t,
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [sortedVehicles, grid, rangeLabel, t]);

  const reportTable =
    grid && grid.fleetTotal > 0 ? (
      <>
        <div className="flex flex-wrap items-center justify-end gap-1 border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
          <button
            type="button"
            className="app-btn-ghost mr-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium sm:text-sm"
            disabled={sortedVehicles.length === 0}
            onClick={() => void copyReport()}
            title={t('dailyKmMonthlyCopy')}
          >
            <Copy className="h-4 w-4 shrink-0" aria-hidden />
            {copied ? t('dailyKmMonthlyCopied') : t('dailyKmMonthlyCopy')}
          </button>
          <button
            type="button"
            className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
            onClick={() => scrollTable('left')}
            title={t('fuelReportScrollLeft')}
            aria-label={t('fuelReportScrollLeft')}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
            onClick={() => scrollTable('right')}
            title={t('fuelReportScrollRight')}
            aria-label={t('fuelReportScrollRight')}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
            onClick={() => setTableFullscreen((v) => !v)}
            title={tableFullscreen ? t('fuelReportExitFullscreen') : t('fuelReportFullscreen')}
            aria-label={tableFullscreen ? t('fuelReportExitFullscreen') : t('fuelReportFullscreen')}
          >
            {tableFullscreen ? <X className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
        <div
          ref={tableScrollRef}
          className={clsx(
            'app-table-wrap overflow-auto overscroll-x-contain',
            tableFullscreen ? 'min-h-0 flex-1' : 'max-h-[min(70vh,720px)]',
          )}
        >
          <table className="app-table-inner min-w-max text-xs">
            <thead className="app-table-head sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 w-11 min-w-11 bg-slate-50 p-2 text-center dark:bg-slate-950/90">
                  {t('dailyKmColNo')}
                </th>
                <th className="sticky left-11 z-20 min-w-[11rem] bg-slate-50 p-2 text-left dark:bg-slate-950/90 shadow-[2px_0_4px_rgba(15,23,42,0.06)]">
                  {t('dailyKmMonthlyColVehicle')}
                </th>
                <th
                  colSpan={days.length}
                  className="border-l border-slate-200 bg-slate-50 p-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-400"
                >
                  {t('dailyKmMonthlyColDays')}
                </th>
              </tr>
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-950/90" aria-hidden />
                <th
                  className="sticky left-11 z-20 bg-slate-50 dark:bg-slate-950/90 shadow-[2px_0_4px_rgba(15,23,42,0.06)]"
                  aria-hidden
                />
                {days.map((ymd) => (
                  <th
                    key={ymd}
                    className="min-w-[1.35rem] border-l border-slate-100 bg-slate-50 p-1 text-center font-normal tabular-nums dark:border-slate-800 dark:bg-slate-950/90"
                  >
                    {dayOfMonth(ymd)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedVehicles.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + days.length}
                    className="p-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    {t('oilSearchNoResults')}
                  </td>
                </tr>
              ) : (
                sortedVehicles.map((v, index) => (
                  <tr
                    key={v.vehicleId}
                    className="app-table-row border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="sticky left-0 z-[12] bg-white p-2 text-center align-top dark:bg-slate-900">
                      <span
                        className={clsx(
                          'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                          rowNoClass(v.completionPct),
                        )}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="sticky left-11 z-[12] min-w-[11rem] bg-white p-2 align-top shadow-[2px_0_4px_rgba(15,23,42,0.04)] dark:bg-slate-900">
                      <div className="font-mono text-sm font-bold text-slate-900 dark:text-slate-50">
                        {v.plateNumber}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {v.vehicleLabel}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                        {v.driverName}
                      </div>
                      {v.driverPhone ? (
                        <div className="mt-0.5 text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                          {v.driverPhone}
                        </div>
                      ) : null}
                      <div className="mt-2 flex max-w-[10rem] items-center gap-2">
                        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div
                            className={clsx(
                              'h-full rounded-full transition-all',
                              completionBarClass(v.completionPct),
                            )}
                            style={{ width: `${Math.min(100, v.completionPct)}%` }}
                          />
                        </div>
                        <span
                          className={clsx(
                            'shrink-0 text-[10px] font-bold tabular-nums',
                            v.completionPct >= 100
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : v.completionPct >= 70
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-red-700 dark:text-red-300',
                          )}
                        >
                          {v.completionPct}%
                        </span>
                      </div>
                    </td>
                    {v.days.map((day) => (
                      <td
                        key={day.date}
                        className="border-l border-slate-100 p-1 text-center align-middle dark:border-slate-800"
                      >
                        <div className="flex justify-center">
                          <DayBars day={day} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1 sm:max-w-[min(100vw-2rem,22rem)]">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('dailyKmMonthlyDateRange')}
          </span>
          <DatetimeLocalRangeField
            fromValue={fromValue}
            toValue={toValue}
            onFromChange={setFromValue}
            onToChange={setToValue}
            disabled={{ after: new Date() }}
            align="left"
          />
        </div>
        <div className="flex min-w-0 w-full flex-col gap-1 sm:w-[200px]">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('dailyKmMonthlySortLabel')}
          </span>
          <SelectField value={sortOrder} onChange={setSortOrder} options={sortOptions} />
        </div>
        <div className="flex min-w-0 w-full flex-col gap-1 sm:w-[240px]">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('dailyKmSearchLabel')}
          </span>
          <div className="relative min-w-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              className="app-input w-full pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('dailyKmMonthlySearchPlaceholder')}
              aria-label={t('dailyKmMonthlySearchPlaceholder')}
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {t('dailyKmMonthlyLegendTitle')}:
        </span>
        <LegendItem color="bg-blue-500" label={t('dailyKmMonthlyLegendStart')} />
        <LegendItem color="bg-emerald-500" label={t('dailyKmMonthlyLegendEnd')} />
        <LegendItem color="bg-slate-200 dark:bg-slate-700" label={t('dailyKmMonthlyLegendMissing')} />
      </div>

      {loading ? (
        <div className="app-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          …
        </div>
      ) : !grid || grid.fleetTotal === 0 ? (
        <p className="app-card p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('dailyKmMonthlyEmpty')}
        </p>
      ) : null}

      {reportTable && !tableFullscreen ? (
        <div className="app-card min-w-0 overflow-hidden">{reportTable}</div>
      ) : null}

      {reportTable && tableFullscreen ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-[var(--background)] p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('dailyKmTabMonthly')}
        >
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('dailyKmTabMonthly')} · {rangeLabel}
            </span>
            <button
              type="button"
              className="app-btn-ghost inline-flex items-center gap-2 py-1.5 text-sm"
              onClick={() => setTableFullscreen(false)}
            >
              <X className="h-4 w-4" aria-hidden />
              {t('fuelReportExitFullscreen')}
            </button>
          </div>
          <div className="app-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {reportTable}
          </div>
        </div>
      ) : null}
    </div>
  );
}
