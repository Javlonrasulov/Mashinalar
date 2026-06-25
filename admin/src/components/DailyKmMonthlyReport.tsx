import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { DatetimeLocalRangeField } from '@/components/DatetimeLocalRangeField';
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
    <div
      className="flex w-5 flex-col gap-px"
      title={`${day.date}: ${day.hasStart ? 'start' : ''} ${day.hasEnd ? 'end' : ''}`}
    >
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
  const { t } = useI18n();
  const [fromValue, setFromValue] = useState(initMonthStart);
  const [toValue, setToValue] = useState(initToday);
  const [grid, setGrid] = useState<MonthlyGridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { from, to } = useMemo(() => toYmdRange(fromValue, toValue), [fromValue, toValue]);

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
  const visibleVehicles = useMemo(() => {
    if (!grid) return [];
    if (!searchTrim) return grid.vehicles;
    return grid.vehicles.filter((v) => {
      const parts = [
        v.plateNumber,
        v.vehicleLabel,
        v.driverName,
        v.driverPhone,
      ];
      return parts.some((p) => (p ?? '').toLowerCase().includes(searchTrim));
    });
  }, [grid, searchTrim]);

  const days = grid?.days ?? [];

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

      <div className="app-card min-w-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            …
          </div>
        ) : !grid || grid.fleetTotal === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('dailyKmMonthlyEmpty')}
          </p>
        ) : (
          <div className="app-table-wrap overflow-x-auto overscroll-x-contain">
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
                  <th className="sticky left-11 z-20 bg-slate-50 dark:bg-slate-950/90 shadow-[2px_0_4px_rgba(15,23,42,0.06)]" aria-hidden />
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
                {visibleVehicles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + days.length}
                      className="p-8 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      {t('oilSearchNoResults')}
                    </td>
                  </tr>
                ) : (
                  visibleVehicles.map((v, index) => (
                    <tr key={v.vehicleId} className="app-table-row border-t border-slate-100 dark:border-slate-800">
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
                              className={clsx('h-full rounded-full transition-all', completionBarClass(v.completionPct))}
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
        )}
      </div>
    </div>
  );
}
