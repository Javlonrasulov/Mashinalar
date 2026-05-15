import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { SavedFuelStationMapItem } from '@/lib/savedFuelStationsMap';

type GridVehicle = {
  vehicleId: string;
  plateNumber: string;
  systemM3ByDay: (number | null)[];
  actualM3ByDay: (number | null)[];
  diffM3ByDay: (number | null)[];
};

type GridResponse = {
  savedStation: { id: string; name: string };
  year: number;
  month: number;
  daysInMonth: number;
  vehicles: GridVehicle[];
};

function monthInputValue(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, '0')}`;
}

function parseMonthInput(s: string): { y: number; m: number } | null {
  const mx = /^(\d{4})-(\d{2})$/.exec(s.trim());
  if (!mx) return null;
  const y = Number(mx[1]);
  const mo = Number(mx[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  return { y, m: mo };
}

function formatM3(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  return String(r).replace(/\.00$/, '');
}

function weekdayShort(y: number, month: number, day: number, loc: string): string {
  const d = new Date(Date.UTC(y, month - 1, day));
  return new Intl.DateTimeFormat(loc, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(d);
}

/** Farq: abs qiymат четраформ — яшил ↔ сариқ ↔ қизил */
function diffCellClass(diff: number | null): string {
  if (diff == null || !Number.isFinite(diff)) {
    return 'bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400';
  }
  const a = Math.abs(diff);
  if (a <= 0.35)
    return 'bg-emerald-500/35 text-emerald-950 dark:bg-emerald-400/35 dark:text-emerald-50';
  if (a <= 1.2) return 'bg-lime-400/35 text-lime-950 dark:bg-lime-300/30 dark:text-lime-50';
  if (a <= 3)
    return 'bg-amber-400/45 text-amber-950 dark:bg-amber-300/35 dark:text-amber-950';
  return 'bg-red-500/45 text-white dark:bg-red-500/40 dark:text-red-50';
}

function sumNums(arr: (number | null)[]): number | null {
  let s = 0;
  let any = false;
  for (const x of arr) {
    if (x != null && Number.isFinite(x)) {
      any = true;
      s += x;
    }
  }
  return any ? Math.round(s * 100) / 100 : null;
}

export function FuelReportPage() {
  const { t, lang } = useI18n();
  const now = useMemo(() => new Date(), []);
  const initialMonth = useMemo(() => {
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    return monthInputValue(y, m);
  }, [now]);

  const [stations, setStations] = useState<SavedFuelStationMapItem[]>([]);
  const [stationId, setStationId] = useState('');
  const [monthStr, setMonthStr] = useState(initialMonth);
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [allFleet, setAllFleet] = useState(true);
  /** vendor katakcha draft — фақат бир вақт ўзгариши */
  const [draftVendor, setDraftVendor] = useState<Record<string, string>>({});

  const locale =
    lang === 'ru'
      ? 'ru-RU'
      : lang === 'uzCyrl'
        ? 'ru-RU'
        : 'uz-Latn-UZ';

  useEffect(() => {
    setDraftVendor({});
  }, [stationId, monthStr]);

  useEffect(() => {
    api<SavedFuelStationMapItem[]>('/map/saved-fuel-stations')
      .then((list) => {
        setStations(list);
        if (!stationId && list.length) setStationId(list[0].id);
      })
      .catch(() => setStations([]));
  }, []);

  const loadGrid = useCallback(async () => {
    const parsed = parseMonthInput(monthStr);
    if (!stationId || !parsed) return;
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        savedFuelStationId: stationId,
        year: String(parsed.y),
        month: String(parsed.m),
      });
      if (allFleet) qs.set('all', '1');
      const data = await api<GridResponse>(
        `/fuel-reports/station-month-grid?${qs.toString()}`,
      );
      setGrid(data);
    } catch (e: unknown) {
      setGrid(null);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [stationId, monthStr, allFleet]);

  useEffect(() => {
    if (stationId) void loadGrid();
  }, [stationId, monthStr, loadGrid]);

  const saveActual = useCallback(
    async (vehicleId: string, day: number, raw: string) => {
      const parsed = parseMonthInput(monthStr);
      if (!stationId || !parsed) return;
      const trimmed = raw.trim();
      let actualM3: number | null = null;
      if (trimmed !== '') {
        const n = Number(trimmed.replace(',', '.'));
        if (Number.isFinite(n) && n >= 0) actualM3 = n;
      }
      try {
        await api('/fuel-reports/station-month-actual', {
          method: 'PUT',
          body: JSON.stringify({
            savedFuelStationId: stationId,
            vehicleId,
            year: parsed.y,
            month: parsed.m,
            day,
            actualM3,
          }),
        });
        await loadGrid();
        const dk = `${vehicleId}_${day}`;
        setDraftVendor((p) => {
          const next = { ...p };
          delete next[dk];
          return next;
        });
      } catch {
        setErr(t('genericError'));
      }
    },
    [stationId, monthStr, loadGrid, t],
  );

  const days =
    grid != null ? Array.from({ length: grid.daysInMonth }, (_, i) => i + 1) : [];

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="app-page-title">{t('fuelSubNavReport')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          {t('fuelReportIntro')}
        </p>
      </div>

      <div className="app-card-pad flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:min-w-[220px]">
          <label
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
            htmlFor="fuel-report-station"
          >
            {t('fuelReportPickStation')}
          </label>
          <select
            id="fuel-report-station"
            className="app-input w-full text-sm"
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
          >
            {!stations.length && (
              <option value="">{t('fuelReportNoStations')}</option>
            )}
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-col gap-1 sm:w-44">
          <label
            className="text-xs font-medium text-slate-500 dark:text-slate-400"
            htmlFor="fuel-report-month"
          >
            {t('fuelReportPickMonth')}
          </label>
          <input
            id="fuel-report-month"
            type="month"
            className="app-input w-full text-sm tabular-nums"
            value={monthStr}
            onChange={(e) => setMonthStr(e.target.value)}
          />
        </div>
        <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={allFleet}
            onChange={(e) => setAllFleet(e.target.checked)}
            className="h-4 w-4 rounded border-slate-400"
          />
          {t('fuelReportAllFleet')}
        </label>
        <button
          type="button"
          className="app-btn-ghost shrink-0"
          onClick={() => void loadGrid()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          ) : null}
          {t('mapRefresh')}
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      {loading && !grid ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" />…
        </div>
      ) : null}

      {grid &&
      grid.vehicles.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('fuelReportEmptyMonth')}
        </p>
      ) : null}

      {grid && grid.vehicles.length > 0 ? (
        <div className="app-card min-w-0 overflow-hidden">
          <div className="app-table-wrap overflow-x-auto">
            <table className="app-table-inner min-w-max text-[11px] sm:text-xs">
              <thead className="app-table-head sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 min-w-[7rem] bg-slate-50 p-2 text-left shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:bg-slate-950/80">
                    {t('fuelReportColPlate')}
                  </th>
                  <th className="sticky left-[7rem] z-20 min-w-[7.5rem] bg-slate-50 p-2 text-left shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:bg-slate-950/80">
                    {t('fuelReportColSource')}
                  </th>
                  {days.map((d) => (
                    <th
                      key={d}
                      className="min-w-[2.65rem] p-2 text-center font-normal tabular-nums"
                    >
                      <div className="font-semibold tabular-nums">{d}</div>
                      <div className="text-[9px] font-normal uppercase text-slate-500 dark:text-slate-400">
                        {weekdayShort(grid.year, grid.month, d, locale)}
                      </div>
                    </th>
                  ))}
                  <th className="min-w-[4rem] p-2 text-center font-semibold">
                    {t('fuelReportColTotal')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {grid.vehicles.map((v) => {
                  const totalSys = sumNums(v.systemM3ByDay);
                  const totalAct = sumNums(v.actualM3ByDay);
                  const totalDiff =
                    totalSys != null || totalAct != null
                      ? Math.round(((totalSys ?? 0) - (totalAct ?? 0)) * 100) / 100
                      : null;

                  const rowPad = clsx(
                    'border-t border-slate-200 px-1 py-0.5 text-center align-middle tabular-nums dark:border-slate-800',
                  );
                  const cellInput = clsx(rowPad, 'min-w-[2.5rem] px-0.5 py-px');

                  return (
                    <Fragment key={v.vehicleId}>
                      <tr className="bg-rose-50/90 dark:bg-rose-950/25">
                        <td
                          rowSpan={3}
                          className="sticky left-0 bg-rose-50/95 p-2 font-mono text-xs font-semibold shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:bg-rose-950/35"
                        >
                          {v.plateNumber}
                        </td>
                        <td className="sticky left-[7rem] bg-rose-50/95 p-2 text-left text-[10px] font-medium leading-snug shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:bg-rose-950/35 sm:text-[11px]">
                          {t('fuelReportRowSystem')}
                        </td>
                        {days.map((d) => {
                          const ix = d - 1;
                          const val = v.systemM3ByDay[ix];
                          return (
                            <td
                              key={d}
                              className={clsx(
                                rowPad,
                                'text-slate-800 tabular-nums dark:text-slate-100',
                              )}
                            >
                              {val != null ? formatM3(val) : ''}
                            </td>
                          );
                        })}
                        <td className={clsx(rowPad, 'font-semibold')} title={String(totalSys)}>
                          {totalSys != null ? formatM3(totalSys) : ''}
                        </td>
                      </tr>
                      <tr className="bg-sky-50/95 dark:bg-sky-950/30">
                        <td className="sticky left-[7rem] bg-sky-50/95 p-2 text-left text-[10px] font-medium shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:bg-sky-950/40 sm:text-[11px]">
                          {t('fuelReportRowVendor')}
                        </td>
                        {days.map((d) => {
                          const ix = d - 1;
                          const persisted = v.actualM3ByDay[ix];
                          const dk = `${v.vehicleId}_${d}`;
                          const localVal =
                            draftVendor[dk] !== undefined
                              ? draftVendor[dk]
                              : persisted != null
                                ? formatM3(persisted)
                                : '';
                          return (
                            <td key={d} className={cellInput}>
                              <input
                                type="text"
                                inputMode="decimal"
                                className={clsx(
                                  'app-input w-full tabular-nums',
                                  '!min-h-[28px] !px-0.5 !py-px !text-center text-[11px]',
                                )}
                                aria-label={`${v.plateNumber} ${t('fuelReportRowVendor')} ${d}`}
                                placeholder="—"
                                value={localVal}
                                onChange={(e) => {
                                  setDraftVendor((prev) => ({
                                    ...prev,
                                    [dk]: e.target.value,
                                  }));
                                }}
                                onBlur={(e) => {
                                  void saveActual(v.vehicleId, d, e.target.value.trim());
                                }}
                              />
                            </td>
                          );
                        })}
                        <td
                          className={clsx(
                            rowPad,
                            'bg-amber-100/80 font-semibold dark:bg-amber-900/35',
                          )}
                        >
                          {totalAct != null ? formatM3(totalAct) : ''}
                        </td>
                      </tr>
                      <tr>
                        <td className="sticky left-[7rem] z-10 border-t border-slate-200 bg-slate-50 p-2 text-left text-[10px] font-medium shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/55 sm:text-[11px]">
                          {t('fuelReportRowDiff')}
                        </td>
                        {days.map((d) => {
                          const ix = d - 1;
                          const df = v.diffM3ByDay[ix];
                          return (
                            <td key={d} className={clsx(rowPad, diffCellClass(df))}>
                              {df != null && Number.isFinite(df) ? formatM3(df) : ''}
                            </td>
                          );
                        })}
                        <td className={clsx(rowPad, diffCellClass(totalDiff))}>
                          {totalDiff != null ? formatM3(totalDiff) : ''}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
