import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Maximize2,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import type { SavedFuelStationMapItem } from '@/lib/savedFuelStationsMap';
import {
  downloadFuelReportSnapshotsWorkbook,
  downloadFuelReportXlsx,
  snapshotExcelBaseName,
  type FuelReportExportGrid,
} from '@/lib/fuelReportExcelExport';

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

/** Farq: abs qiymР°С‚ С‡РµС‚СЂР°С„РѕСЂРј вЂ” СЏС€РёР» в†” СЃР°СЂРёТ› в†” Т›РёР·РёР» */
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

const H_SCROLL_STEP = 280;

function parseDraftM3(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function mergeActualWithDraft(
  vehicleId: string,
  actualM3ByDay: (number | null)[],
  draftVendor: Record<string, string>,
): (number | null)[] {
  return actualM3ByDay.map((persisted, i) => {
    const day = i + 1;
    const dk = `${vehicleId}_${day}`;
    if (draftVendor[dk] !== undefined) {
      return parseDraftM3(draftVendor[dk]);
    }
    return persisted;
  });
}

function hasAnyActual(values: (number | null)[]): boolean {
  return values.some((x) => x != null && Number.isFinite(x));
}

const stickyRightTh =
  'sticky right-0 z-[25] min-w-[4.5rem] border-l border-slate-200/90 bg-slate-50 p-2 text-center font-semibold shadow-[-6px_0_12px_rgba(15,23,42,0.1)] dark:border-slate-700 dark:bg-slate-950/95';

function stickyRightTd(extra?: string) {
  return clsx(
    'sticky right-0 z-[15] min-w-[4.5rem] border-l border-slate-200/80 px-1 py-0.5 text-center align-middle shadow-[-6px_0_12px_rgba(15,23,42,0.08)] dark:border-slate-800',
    extra,
  );
}

function stationOptionLabel(
  s: SavedFuelStationMapItem,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  const n = (s.name ?? '').trim();
  if (n) return n;
  return t('fuelReportUnnamedStation', {
    lat: s.latitude.toFixed(3),
    lon: s.longitude.toFixed(3),
  });
}

type SnapListItem = { id: string; createdAt: string };

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
  const [snapshots, setSnapshots] = useState<SnapListItem[]>([]);
  const [savingSnap, setSavingSnap] = useState(false);
  const [exportingSnaps, setExportingSnaps] = useState(false);
  const [snapMsg, setSnapMsg] = useState<string | null>(null);
  /** vendor katakcha draft вЂ” С„Р°Т›Р°С‚ Р±РёСЂ РІР°Т›С‚ СћР·РіР°СЂРёС€Рё */
  const [draftVendor, setDraftVendor] = useState<Record<string, string>>({});
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableFullscreen, setTableFullscreen] = useState(false);

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

  const loadSnapshots = useCallback(async () => {
    const parsed = parseMonthInput(monthStr);
    if (!stationId || !parsed) {
      setSnapshots([]);
      return;
    }
    try {
      const qs = new URLSearchParams({
        savedFuelStationId: stationId,
        year: String(parsed.y),
        month: String(parsed.m),
      });
      const list = await api<SnapListItem[]>(
        `/fuel-reports/vedomost-snapshots?${qs.toString()}`,
      );
      setSnapshots(list);
    } catch {
      setSnapshots([]);
    }
  }, [stationId, monthStr]);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const exportLabels = useMemo(
    () => ({
      plate: t('fuelReportColPlate'),
      source: t('fuelReportColSource'),
      rowEmployees: t('fuelReportRowSystem'),
      rowVendor: t('fuelReportRowVendor'),
      rowDiff: t('fuelReportRowDiff'),
      total: t('fuelReportColTotal'),
      stationTitle: t('fuelReportExportStation'),
      metaRow: t('fuelReportExportPeriod'),
      savedAt: t('fuelReportExportSavedAt'),
    }),
    [t],
  );

  const exportGridToFile = useCallback(
    (g: GridResponse, createdAt?: string) => {
      downloadFuelReportXlsx(
        g as FuelReportExportGrid,
        exportLabels,
        snapshotExcelBaseName(g, createdAt),
        'Hisobot',
        createdAt,
      );
    },
    [exportLabels],
  );

  const exportCurrentGrid = useCallback(() => {
    if (grid) exportGridToFile(grid);
  }, [grid, exportGridToFile]);

  const saveVedomostSnapshot = useCallback(async () => {
    const parsed = parseMonthInput(monthStr);
    if (!stationId || !parsed) return;
    setSavingSnap(true);
    setSnapMsg(null);
    setErr(null);
    try {
      const created = await api<{
        id: string;
        createdAt: string;
        payload: { grid: GridResponse };
      }>('/fuel-reports/vedomost-snapshot', {
        method: 'POST',
        body: JSON.stringify({
          savedFuelStationId: stationId,
          year: parsed.y,
          month: parsed.m,
          ...(allFleet ? { all: '1' } : {}),
        }),
      });
      exportGridToFile(created.payload.grid, created.createdAt);
      setSnapMsg(t('fuelReportSnapshotSavedExcel'));
      await loadSnapshots();
      window.setTimeout(() => setSnapMsg(null), 5000);
    } catch {
      setErr(t('genericError'));
    } finally {
      setSavingSnap(false);
    }
  }, [stationId, monthStr, allFleet, t, loadSnapshots, exportGridToFile]);

  const exportSnapshotById = useCallback(
    async (id: string) => {
      setErr(null);
      try {
        const res = await api<{
          createdAt: string;
          payload: { grid: GridResponse };
        }>(`/fuel-reports/vedomost-snapshot/${encodeURIComponent(id)}`);
        exportGridToFile(res.payload.grid, res.createdAt);
      } catch {
        setErr(t('genericError'));
      }
    },
    [exportGridToFile, t],
  );

  const exportAllSnapshotsExcel = useCallback(async () => {
    if (!snapshots.length || !grid) return;
    setExportingSnaps(true);
    setErr(null);
    try {
      const full = await Promise.all(
        snapshots.map((s) =>
          api<{
            createdAt: string;
            payload: { grid: GridResponse };
          }>(`/fuel-reports/vedomost-snapshot/${encodeURIComponent(s.id)}`),
        ),
      );
      downloadFuelReportSnapshotsWorkbook(
        full.map((r) => ({ createdAt: r.createdAt, grid: r.payload.grid })),
        exportLabels,
        snapshotExcelBaseName(grid, undefined, 'tarix_barchasi'),
      );
    } catch {
      setErr(t('genericError'));
    } finally {
      setExportingSnaps(false);
    }
  }, [snapshots, grid, exportLabels, t]);

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

  const reportTable =
    grid && grid.vehicles.length > 0 ? (
      <>
        <div className="flex items-center justify-end gap-1 border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
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
            title={
              tableFullscreen ? t('fuelReportExitFullscreen') : t('fuelReportFullscreen')
            }
            aria-label={
              tableFullscreen ? t('fuelReportExitFullscreen') : t('fuelReportFullscreen')
            }
          >
            {tableFullscreen ? (
              <X className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
        <div
          ref={tableScrollRef}
          className={clsx(
            'app-table-wrap overflow-auto overscroll-x-contain',
            tableFullscreen ? 'min-h-0 flex-1' : 'max-h-[min(70vh,720px)]',
          )}
        >
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
                    className="min-w-[2.65rem] bg-slate-50 p-2 text-center font-normal tabular-nums dark:bg-slate-950/80"
                  >
                    <div className="font-semibold tabular-nums">{d}</div>
                    <div className="text-[9px] font-normal uppercase text-slate-500 dark:text-slate-400">
                      {weekdayShort(grid.year, grid.month, d, locale)}
                    </div>
                  </th>
                ))}
                <th className={stickyRightTh}>{t('fuelReportColTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {grid.vehicles.map((v) => {
                const totalSys = sumNums(v.systemM3ByDay);
                const mergedAct = mergeActualWithDraft(
                  v.vehicleId,
                  v.actualM3ByDay,
                  draftVendor,
                );
                const totalAct = sumNums(mergedAct);
                const actEntered = hasAnyActual(mergedAct);
                const totalDiff =
                  actEntered && (totalSys != null || totalAct != null)
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
                        rowSpan={2}
                        className="sticky left-0 z-[16] bg-rose-50/95 p-2 font-mono text-xs font-semibold shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:bg-rose-950/35"
                      >
                        {v.plateNumber}
                      </td>
                      <td className="sticky left-[7rem] z-[16] bg-rose-50/95 p-2 text-left text-[10px] font-medium leading-snug shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:bg-rose-950/35 sm:text-[11px]">
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
                      <td
                        className={stickyRightTd(
                          'bg-rose-50/95 font-semibold dark:bg-rose-950/35',
                        )}
                        title={String(totalSys ?? '')}
                      >
                        {totalSys != null ? formatM3(totalSys) : ''}
                      </td>
                    </tr>
                    <tr className="bg-sky-50/95 dark:bg-sky-950/30">
                      <td className="sticky left-[7rem] z-[16] bg-sky-50/95 p-2 text-left text-[10px] font-medium shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:bg-sky-950/40 sm:text-[11px]">
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
                              placeholder="вЂ”"
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
                        className={stickyRightTd(
                          clsx(
                            'font-semibold tabular-nums',
                            actEntered
                              ? diffCellClass(totalDiff)
                              : 'bg-sky-50/95 dark:bg-sky-950/40',
                          ),
                        )}
                        title={
                          actEntered
                            ? `${t('fuelReportRowDiff')}: ${totalDiff ?? ''}`
                            : undefined
                        }
                      >
                        {actEntered && totalDiff != null ? formatM3(totalDiff) : ''}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    ) : null;

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="app-page-title">{t('fuelSubNavReport')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          {t('fuelReportIntro')}
        </p>
      </div>

      <div className="app-card-pad flex min-w-0 flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex w-full min-w-0 max-w-md flex-col gap-1">
            <label
              className="text-xs font-medium text-slate-500 dark:text-slate-400"
              htmlFor="fuel-report-station"
            >
              {t('fuelReportPickStation')}
            </label>
            <div className="relative">
              <select
                id="fuel-report-station"
                className="app-select w-full appearance-none py-2 pl-3 pr-9 text-sm"
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
              >
                {!stations.length && (
                  <option value="">{t('fuelReportNoStations')}</option>
                )}
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {stationOptionLabel(s, t)}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-40 sm:max-w-[11rem]">
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
          <label className="flex min-h-[40px] max-w-xl cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={allFleet}
              onChange={(e) => setAllFleet(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-slate-400"
            />
            <span>{t('fuelReportAllFleet')}</span>
          </label>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            className="app-btn-ghost inline-flex h-10 w-10 items-center justify-center p-0"
            onClick={() => void saveVedomostSnapshot()}
            disabled={savingSnap || !stationId || loading}
            title={t('fuelReportSaveVedomost')}
            aria-label={t('fuelReportSaveVedomost')}
          >
            {savingSnap ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            className="app-btn-ghost inline-flex h-10 w-10 items-center justify-center p-0"
            onClick={() => exportCurrentGrid()}
            disabled={!grid || grid.vehicles.length === 0}
            title={t('fuelReportExportCurrent')}
            aria-label={t('fuelReportExportCurrent')}
          >
            <FileDown className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="app-btn-ghost inline-flex h-10 w-10 items-center justify-center p-0"
            onClick={() => void loadGrid()}
            disabled={loading}
            title={t('fuelReportRefreshAria')}
            aria-label={t('fuelReportRefreshAria')}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RefreshCw className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {snapMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {snapMsg}
        </div>
      )}

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </div>
      )}

      <div className="app-card-pad">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t('fuelReportVedomostHistory')}
          </h2>
          {snapshots.length > 0 ? (
            <button
              type="button"
              className="app-btn-ghost inline-flex shrink-0 items-center gap-1.5 py-1.5 text-sm"
              disabled={exportingSnaps || !grid}
              onClick={() => void exportAllSnapshotsExcel()}
            >
              {exportingSnaps ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FileDown className="h-4 w-4" aria-hidden />
              )}
              {t('fuelReportExportAllSnapshots')}
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('fuelReportVedomostHistoryHint')}
        </p>
        {snapshots.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('fuelReportSnapshotEmpty')}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0"
              >
                <span className="text-sm tabular-nums text-slate-700 dark:text-slate-200">
                  {new Date(s.createdAt).toLocaleString(locale, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
                <button
                  type="button"
                  className="app-btn-ghost inline-flex shrink-0 items-center gap-1.5 py-1.5 text-sm"
                  onClick={() => void exportSnapshotById(s.id)}
                >
                  <FileDown className="h-4 w-4" aria-hidden />
                  {t('fuelReportDownloadSnapshotExcel')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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


      {reportTable && !tableFullscreen ? (
        <div className="app-card min-w-0 overflow-hidden">{reportTable}</div>
      ) : null}

      {reportTable && tableFullscreen ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-[var(--background)] p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('fuelSubNavReport')}
        >
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('fuelSubNavReport')}
              {grid
                ? ` · ${grid.savedStation.name} · ${grid.year}-${String(grid.month).padStart(2, '0')}`
                : ''}
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
