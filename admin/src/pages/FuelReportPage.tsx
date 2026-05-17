import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Loader2,
  Maximize2,
  Pencil,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { MonthField } from '@/components/MonthField';
import { SelectField } from '@/components/SelectField';
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
  'sticky right-0 z-[25] min-w-[4.75rem] border-l-2 border-amber-400/90 bg-amber-200 p-2 text-center text-xs font-bold uppercase tracking-wide text-amber-950 shadow-[-6px_0_12px_rgba(15,23,42,0.12)] dark:border-amber-600 dark:bg-amber-900/55 dark:text-amber-50';

const stickyRightTdBase =
  'sticky right-0 z-[15] min-w-[4.75rem] border-l-2 border-amber-300/85 bg-amber-100 px-1 py-0.5 text-center align-middle font-semibold tabular-nums text-amber-950 shadow-[-6px_0_12px_rgba(15,23,42,0.1)] dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-50';

function stickyRightTd(extra?: string) {
  return clsx(stickyRightTdBase, extra);
}

/** Жами ustunidagi farq — sariq fon ustida rang */
function diffTotalCellClass(diff: number | null): string {
  const base = stickyRightTdBase;
  if (diff == null || !Number.isFinite(diff)) return base;
  const a = Math.abs(diff);
  if (a <= 0.35)
    return clsx(
      base,
      '!bg-emerald-200/90 !text-emerald-950 dark:!bg-emerald-800/50 dark:!text-emerald-100',
    );
  if (a <= 1.2)
    return clsx(
      base,
      '!bg-lime-200/95 !text-lime-950 dark:!bg-lime-800/45 dark:!text-lime-100',
    );
  if (a <= 3)
    return clsx(
      base,
      '!bg-amber-300 !text-amber-950 dark:!bg-amber-700/70 dark:!text-amber-50',
    );
  return clsx(
    base,
    '!bg-red-400/85 !text-white dark:!bg-red-600/70 dark:!text-red-50',
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

type SnapListItem = { id: string; createdAt: string; year: number; month: number };

function formatMonthLong(y: number, m: number, loc: string): string {
  return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, 1),
  );
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
  const [snapshots, setSnapshots] = useState<SnapListItem[]>([]);
  const [savingSnap, setSavingSnap] = useState(false);
  const [exportingSnaps, setExportingSnaps] = useState(false);
  const [snapMsg, setSnapMsg] = useState<string | null>(null);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [draftVendor, setDraftVendor] = useState<Record<string, string>>({});
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const skipEditClearRef = useRef(false);
  const [tableFullscreen, setTableFullscreen] = useState(false);

  const locale =
    lang === 'ru'
      ? 'ru-RU'
      : lang === 'uzCyrl'
        ? 'ru-RU'
        : 'uz-Latn-UZ';

  useEffect(() => {
    setDraftVendor({});
    if (skipEditClearRef.current) {
      skipEditClearRef.current = false;
      return;
    }
    setEditingSnapshotId(null);
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

  const gridForExcel = useCallback(
    (g: GridResponse): GridResponse => ({
      ...g,
      vehicles: g.vehicles.map((v) => ({
        ...v,
        actualM3ByDay: mergeActualWithDraft(
          v.vehicleId,
          v.actualM3ByDay,
          draftVendor,
        ),
      })),
    }),
    [draftVendor],
  );

  const exportGridToFile = useCallback(
    (g: GridResponse, createdAt?: string, mergeDraft = false) => {
      const payload = mergeDraft ? gridForExcel(g) : g;
      downloadFuelReportXlsx(
        payload as FuelReportExportGrid,
        exportLabels,
        snapshotExcelBaseName(payload, createdAt),
        'Hisobot',
        createdAt,
      );
    },
    [exportLabels, gridForExcel],
  );

  const exportCurrentGrid = useCallback(() => {
    if (grid) exportGridToFile(grid, undefined, true);
  }, [grid, exportGridToFile]);

  const stationOptions = useMemo(
    () =>
      stations.map((s) => ({
        value: s.id,
        label: stationOptionLabel(s, t),
      })),
    [stations, t],
  );

  const saveVedomostSnapshot = useCallback(async () => {
    const parsed = parseMonthInput(monthStr);
    if (!stationId || !parsed) return;
    setSavingSnap(true);
    setSnapMsg(null);
    setErr(null);
    try {
      const body = JSON.stringify({
        ...(allFleet ? { all: '1' } : {}),
      });
      if (editingSnapshotId) {
        await api(`/fuel-reports/vedomost-snapshot/${encodeURIComponent(editingSnapshotId)}`, {
          method: 'PUT',
          body,
        });
        setEditingSnapshotId(null);
        setSnapMsg(t('fuelReportSnapshotUpdated'));
      } else {
        await api('/fuel-reports/vedomost-snapshot', {
          method: 'POST',
          body: JSON.stringify({
            savedFuelStationId: stationId,
            year: parsed.y,
            month: parsed.m,
            ...(allFleet ? { all: '1' } : {}),
          }),
        });
        setSnapMsg(t('fuelReportSnapshotSaved'));
      }
      await loadSnapshots();
      window.setTimeout(() => setSnapMsg(null), 5000);
    } catch {
      setErr(t('genericError'));
    } finally {
      setSavingSnap(false);
    }
  }, [stationId, monthStr, allFleet, editingSnapshotId, t, loadSnapshots]);

  const loadSnapshotForEdit = useCallback(
    async (id: string) => {
      setErr(null);
      setSnapMsg(null);
      try {
        const res = await api<{
          payload: { grid: GridResponse; includeAllFleet: boolean };
        }>(`/fuel-reports/vedomost-snapshot/${encodeURIComponent(id)}`);
        const g = res.payload.grid;
        skipEditClearRef.current = true;
        setStationId(g.savedStation.id);
        setMonthStr(monthInputValue(g.year, g.month));
        setAllFleet(res.payload.includeAllFleet === true);
        setDraftVendor({});
        await api(`/fuel-reports/vedomost-snapshot/${encodeURIComponent(id)}/apply`, {
          method: 'POST',
        });
        const qs = new URLSearchParams({
          savedFuelStationId: g.savedStation.id,
          year: String(g.year),
          month: String(g.month),
        });
        if (res.payload.includeAllFleet) qs.set('all', '1');
        const data = await api<GridResponse>(
          `/fuel-reports/station-month-grid?${qs.toString()}`,
        );
        setGrid(data);
        setEditingSnapshotId(id);
        setSnapMsg(t('fuelReportEditingSnapshot'));
      } catch {
        setErr(t('genericError'));
      }
    },
    [t],
  );

  const cancelSnapshotEdit = useCallback(() => {
    setEditingSnapshotId(null);
    setSnapMsg(null);
    void loadGrid();
  }, [loadGrid]);

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
                  <tbody key={v.vehicleId} className="fuel-report-vehicle-block">
                    <tr className="bg-rose-50/90 dark:bg-rose-950/25">
                      <td
                        rowSpan={2}
                        className="sticky left-0 z-[16] border-b border-slate-200/80 bg-rose-50/95 p-2 font-mono text-xs font-semibold shadow-[2px_0_4px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-rose-950/35"
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
                      <td className={stickyRightTd()} title={String(totalSys ?? '')}>
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
                              className="fuel-report-vendor-input"
                              aria-label={`${v.plateNumber} ${t('fuelReportRowVendor')} ${d}`}
                              placeholder={t('fuelReportVendorPlaceholder')}
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
                        className={
                          actEntered ? diffTotalCellClass(totalDiff) : stickyRightTd()
                        }
                        title={
                          actEntered
                            ? `${t('fuelReportRowDiff')}: ${totalDiff ?? ''}`
                            : undefined
                        }
                      >
                        {actEntered && totalDiff != null ? formatM3(totalDiff) : ''}
                      </td>
                    </tr>
                  </tbody>
                );
              })}
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
            <SelectField
              id="fuel-report-station"
              value={stationId}
              onChange={setStationId}
              options={stationOptions}
              placeholder={t('fuelReportNoStations')}
              disabled={!stations.length}
            />
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-52 sm:max-w-[14rem]">
            <label
              className="text-xs font-medium text-slate-500 dark:text-slate-400"
              htmlFor="fuel-report-month"
            >
              {t('fuelReportPickMonth')}
            </label>
            <MonthField
              id="fuel-report-month"
              value={monthStr}
              onChange={setMonthStr}
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
            title={
              editingSnapshotId
                ? t('fuelReportUpdateVedomost')
                : t('fuelReportSaveVedomost')
            }
            aria-label={
              editingSnapshotId
                ? t('fuelReportUpdateVedomost')
                : t('fuelReportSaveVedomost')
            }
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
          {editingSnapshotId ? (
            <button
              type="button"
              className="app-btn-ghost inline-flex h-10 items-center gap-1.5 px-2 text-sm"
              onClick={cancelSnapshotEdit}
            >
              <X className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('fuelReportCancelEdit')}</span>
            </button>
          ) : null}
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
                <div className="min-w-0 text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-medium text-slate-900 dark:text-slate-50">
                    {t('fuelReportSnapshotForMonth', {
                      month: formatMonthLong(s.year, s.month, locale),
                    })}
                  </span>
                  <span className="mt-0.5 block tabular-nums text-slate-500 dark:text-slate-400">
                    {new Date(s.createdAt).toLocaleString(locale, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className={clsx(
                      'app-btn-ghost inline-flex items-center gap-1.5 py-1.5 text-sm',
                      editingSnapshotId === s.id &&
                        'ring-2 ring-blue-500/60 dark:ring-blue-400/50',
                    )}
                    onClick={() => void loadSnapshotForEdit(s.id)}
                    disabled={editingSnapshotId === s.id}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    {t('fuelReportEditSnapshot')}
                  </button>
                  <button
                    type="button"
                    className="app-btn-ghost inline-flex items-center gap-1.5 py-1.5 text-sm"
                    onClick={() => void exportSnapshotById(s.id)}
                  >
                    <FileDown className="h-4 w-4" aria-hidden />
                    {t('fuelReportDownloadSnapshotExcel')}
                  </button>
                </div>
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
