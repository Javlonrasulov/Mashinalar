import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { api, apiUrl } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DateTimeField } from '@/components/DateTimeField';
import { DatetimeLocalRangeField } from '@/components/DatetimeLocalRangeField';
import { SelectField } from '@/components/SelectField';
import { toDatetimeLocalValue } from '@/lib/datetimeLocal';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

type DailyKmRow = {
  id: string;
  reportDate: string;
  startKm: string;
  /** API: null until driver submits end; avoid treating "" as submitted */
  endKm: string | null | undefined;
  gapKm?: string | null;
  gapFromReportDate?: string | null;
  gapFromEndKm?: string | null;
  startOdometerUrl: string | null;
  endOdometerUrl: string | null;
  startRecordedAt: string | null;
  endRecordedAt: string | null;
  startLatitude: string | null;
  startLongitude: string | null;
  endLatitude: string | null;
  endLongitude: string | null;
  vehicle: { plateNumber: string };
  driver: { fullName: string };
};

function toDateInputValueLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTimeNoSeconds(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

function isDailyKmEndMissing(r: DailyKmRow): boolean {
  const k = r.endKm;
  if (k == null) return true;
  if (typeof k === 'string' && k.trim() === '') return true;
  return false;
}

type GapAuditRow = {
  reportId: string;
  reportDate: string;
  vehicleId: string;
  plateNumber: string;
  driverName: string;
  startKm: string;
  endKm: string | null;
  prevReportId: string | null;
  prevReportDate: string | null;
  prevEndKm: string | null;
  gapKm: string | null;
};

type GapTier = 'unknown' | 'ok' | 'low' | 'mid' | 'high';

function formatDateOnly(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function gapTier(gap: number | null): GapTier {
  if (gap == null || !Number.isFinite(gap)) return 'unknown';
  if (gap <= 0) return 'ok';
  if (gap <= 20) return 'low';
  if (gap <= 100) return 'mid';
  return 'high';
}

function gapRowTone(tier: GapTier): string {
  switch (tier) {
    case 'unknown':
      return 'bg-slate-50/70 dark:bg-slate-900/40';
    case 'ok':
      return 'bg-emerald-50/80 dark:bg-emerald-950/25';
    case 'low':
      return 'bg-emerald-100/85 dark:bg-emerald-950/35';
    case 'mid':
      return 'bg-amber-50/95 dark:bg-amber-950/30';
    case 'high':
      return 'bg-red-50/95 dark:bg-red-950/35';
    default:
      return '';
  }
}

function gapBadgeClass(tier: GapTier): string {
  switch (tier) {
    case 'ok':
      return 'bg-emerald-600/15 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100';
    case 'low':
      return 'bg-emerald-700/12 text-emerald-950 dark:bg-emerald-400/12 dark:text-emerald-50';
    case 'mid':
      return 'bg-amber-500/20 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100';
    case 'high':
      return 'bg-red-600/15 text-red-950 dark:bg-red-500/20 dark:text-red-100';
    default:
      return 'bg-slate-200/60 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200';
  }
}

function LocBtn({
  lat,
  lng,
  title,
  onOpen,
}: {
  lat: string | null;
  lng: string | null;
  title: string;
  onOpen: (lat: number, lon: number, title: string) => void;
}) {
  const { t } = useI18n();
  if (!lat || !lng) return <span className="text-slate-400">—</span>;
  const la = Number(lat);
  const lo = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return <span className="text-slate-400">—</span>;
  return (
    <button type="button" className="text-blue-600 hover:underline dark:text-blue-400" onClick={() => onOpen(la, lo, title)}>
      {t('linkMap')}
    </button>
  );
}

export function DailyKmPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [view, setView] = useState<'table' | 'gaps'>('table');
  const [rows, setRows] = useState<DailyKmRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'gapsOnly' | 'gapDesc'>('all');
  const initToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDatetimeLocalValue(d);
  };
  const [tableFromValue, setTableFromValue] = useState(initToday);
  const [tableToValue, setTableToValue] = useState(initToday);
  const [gapRows, setGapRows] = useState<GapAuditRow[]>([]);
  const [gapFromValue, setGapFromValue] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 30);
    return toDatetimeLocalValue(d);
  });
  const [gapToValue, setGapToValue] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDatetimeLocalValue(d);
  });
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const gapsRangeSeededRef = useRef(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPoint, setMapPoint] = useState<{ lat: number; lon: number; title: string } | null>(null);

  useEffect(() => {
    if (!isAdmin && view === 'gaps') setView('table');
  }, [isAdmin, view]);

  useEffect(() => {
    if (view === 'table') gapsRangeSeededRef.current = false;
  }, [view]);

  useEffect(() => {
    if (view !== 'gaps' || !isAdmin || gapsRangeSeededRef.current) return;
    gapsRangeSeededRef.current = true;
    const end = new Date(tableToValue);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    setGapFromValue(toDatetimeLocalValue(start));
    setGapToValue(toDatetimeLocalValue(end));
  }, [view, tableToValue, isAdmin]);

  useEffect(() => {
    const a = toDateInputValueLocal(new Date(tableFromValue));
    const b = toDateInputValueLocal(new Date(tableToValue));
    const fromStr = a <= b ? a : b;
    const toStr = a <= b ? b : a;
    const q = `from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`;
    api<DailyKmRow[]>(`/daily-km-reports?${q}`).then(setRows).catch(() => {});
  }, [tableFromValue, tableToValue]);

  useEffect(() => {
    if (view !== 'gaps' || !isAdmin) return;
    const a = toDateInputValueLocal(new Date(gapFromValue));
    const b = toDateInputValueLocal(new Date(gapToValue));
    const fromStr = a <= b ? a : b;
    const toStr = a <= b ? b : a;
    const q = `from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`;
    api<GapAuditRow[]>(`/daily-km-reports/gap-audit?${q}`).then(setGapRows).catch(() => setGapRows([]));
  }, [view, gapFromValue, gapToValue, isAdmin]);

  useEffect(() => {
    if (!mapOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMapOpen(false);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [mapOpen]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (!mapPoint) return [41.31, 69.24];
    return [mapPoint.lat, mapPoint.lon];
  }, [mapPoint]);

  const visibleRows = useMemo(() => {
    const withGapNum = (r: DailyKmRow) => {
      const n = r.gapKm == null ? NaN : Number(r.gapKm);
      return Number.isFinite(n) ? n : 0;
    };
    let list = rows;
    if (filter === 'gapsOnly') list = rows.filter((r) => Math.abs(withGapNum(r)) > 0);
    if (filter === 'gapDesc') list = [...list].sort((a, b) => Math.abs(withGapNum(b)) - Math.abs(withGapNum(a)));
    return list;
  }, [rows, filter]);

  const dailyKmFilterOptions = useMemo(
    () =>
      [
        { value: 'all' as const, label: t('dailyKmFilterAll') },
        { value: 'gapsOnly' as const, label: t('dailyKmFilterGapsOnly') },
        { value: 'gapDesc' as const, label: t('dailyKmFilterGapDesc') },
      ],
    [t],
  );

  const gapDriverSummaries = useMemo(() => {
    const m = new Map<string, GapAuditRow[]>();
    for (const r of gapRows) {
      if (!m.has(r.vehicleId)) m.set(r.vehicleId, []);
      m.get(r.vehicleId)!.push(r);
    }
    const list = Array.from(m.entries()).map(([vehicleId, rs]) => {
      const sorted = [...rs].sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());
      let sumPos = 0;
      let maxG = 0;
      let countPos = 0;
      for (const x of sorted) {
        const g = x.gapKm == null ? NaN : Number(x.gapKm);
        if (Number.isFinite(g) && g > 0) {
          sumPos += g;
          maxG = Math.max(maxG, g);
          countPos += 1;
        }
      }
      return {
        vehicleId,
        plate: sorted[0]?.plateNumber ?? '',
        driver: sorted[0]?.driverName ?? '',
        rows: sorted,
        sumPos,
        maxG,
        countPos,
      };
    });
    list.sort((a, b) => b.maxG - a.maxG || b.sumPos - a.sumPos);
    return list;
  }, [gapRows]);

  return (
    <div className="app-page">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="app-page-title shrink-0">{t('navDailyKm')}</h1>
        <div className="flex min-w-0 flex-col items-stretch gap-3 sm:items-end">
          {view === 'table' && (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end sm:justify-end">
              <div className="flex min-w-0 w-full flex-col gap-1 sm:w-[220px]">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dailyKmFilterLabel')}</span>
                <SelectField value={filter} onChange={setFilter} options={dailyKmFilterOptions} />
              </div>
              <div className="flex min-w-0 w-full flex-col gap-1 sm:min-w-[280px] sm:max-w-[min(100vw-2rem,22rem)]">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dailyKmTableDateRange')}</span>
                <DatetimeLocalRangeField
                  fromValue={tableFromValue}
                  toValue={tableToValue}
                  onFromChange={setTableFromValue}
                  onToChange={setTableToValue}
                  disabled={{ after: new Date() }}
                  align="right"
                />
              </div>
            </div>
          )}
          {view === 'gaps' && isAdmin && (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-end">
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('dailyKmGapsFrom')}
                <div className="w-full min-w-[160px] sm:w-[170px]">
                  <DateTimeField value={gapFromValue} onChange={setGapFromValue} mode="date" disabled={{ after: new Date() }} />
                </div>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('dailyKmGapsTo')}
                <div className="w-full min-w-[160px] sm:w-[170px]">
                  <DateTimeField value={gapToValue} onChange={setGapToValue} mode="date" disabled={{ after: new Date() }} />
                </div>
              </label>
            </div>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="inline-flex rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={() => {
              setView('table');
              setExpandedVehicleId(null);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              view === 'table'
                ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t('dailyKmTabByDay')}
          </button>
          <button
            type="button"
            onClick={() => setView('gaps')}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              view === 'gaps'
                ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t('navDailyKmGaps')}
          </button>
        </div>
      )}

      {view === 'table' && (
        <p className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 sm:text-sm">
          {t('dailyKmLayoutExplain')}
        </p>
      )}

      {view === 'gaps' && isAdmin && (
        <p className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 sm:text-sm">
          {t('dailyKmGapsHint')}
          <span className="mt-1 block text-slate-500 dark:text-slate-400">{t('dailyKmGapsClickRow')}</span>
        </p>
      )}

      {view === 'table' && (
      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap overflow-x-auto">
          <table className="app-table-inner min-w-[1040px] text-sm">
            <thead className="app-table-head">
              <tr>
                <th rowSpan={2} className="p-3 align-bottom">
                  {t('plate')}
                </th>
                <th rowSpan={2} className="p-3 align-bottom">
                  {t('fullName')}
                </th>
                <th rowSpan={2} className="whitespace-nowrap p-3 align-bottom">
                  {t('dailyKmGapsColReportDay')}
                </th>
                <th colSpan={4} className="border-s border-slate-200 p-3 text-center dark:border-slate-700">
                  {t('dailyKmGroupStart')}
                </th>
                <th colSpan={4} className="border-s border-slate-200 p-3 text-center dark:border-slate-700">
                  {t('dailyKmGroupEnd')}
                </th>
              </tr>
              <tr>
                <th className="border-s border-slate-200 p-3 dark:border-slate-700">{t('dailyKmColStartKm')}</th>
                <th className="p-3">{t('dailyKmColStartTime')}</th>
                <th className="p-3">{t('dailyKmColStartLoc')}</th>
                <th className="p-3">{t('dailyKmColStartPhoto')}</th>
                <th className="border-s border-slate-200 p-3 dark:border-slate-700">{t('dailyKmColEndKm')}</th>
                <th className="p-3">{t('dailyKmColEndTime')}</th>
                <th className="p-3">{t('dailyKmColEndLoc')}</th>
                <th className="p-3">{t('dailyKmColEndPhoto')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const endPending = isDailyKmEndMissing(r);
                /** Jadval: 2 + сана + 4 бошланиш + 4 тугаш. Иккинчи `tr`да `colSpan` 4 — бошланиш блоки ости. */
                const pendingEndCell =
                  'border-t border-red-100 bg-red-50 dark:border-red-900/55 dark:bg-red-950/50';
                const row2FillerWhenPending =
                  'border-t border-red-100 bg-red-50/80 dark:border-red-900/55 dark:bg-red-950/45';
                const gapNum = r.gapKm == null ? NaN : Number(r.gapKm);
                const hasGap = Number.isFinite(gapNum) && gapNum !== 0;
                const gapSigned =
                  Number.isFinite(gapNum) ? (gapNum > 0 ? `+${gapNum}` : `${gapNum}`) : '';
                return (
                  <Fragment key={r.id}>
                    <tr className="app-table-row">
                      <td rowSpan={2} className="p-3 align-top font-mono">
                        {r.vehicle.plateNumber}
                      </td>
                      <td rowSpan={2} className="p-3 align-top">
                        {r.driver.fullName}
                      </td>
                      <td rowSpan={2} className="whitespace-nowrap p-3 align-top text-slate-700 dark:text-slate-200">
                        {formatDateOnly(r.reportDate)}
                      </td>
                      <td className="border-s border-slate-100 p-3 dark:border-slate-800">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">{r.startKm}</span>
                          {hasGap && (
                            <span
                              className={
                                gapNum > 0
                                  ? 'inline-flex max-w-[260px] flex-wrap items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold leading-snug text-amber-900 dark:bg-amber-950/35 dark:text-amber-200'
                                  : 'inline-flex max-w-[260px] flex-wrap items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold leading-snug text-rose-900 dark:bg-rose-950/35 dark:text-rose-200'
                              }
                              title={`${t('dailyKmGapLabel')}: ${gapSigned} км · ${t('dailyKmGapFromLabel')}: ${r.gapFromReportDate ? formatDateTimeNoSeconds(r.gapFromReportDate) : '—'} · ${r.gapFromEndKm ?? '—'} → ${r.startKm}`}
                            >
                              {t('dailyKmGapLabel')}: {gapSigned} км
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">{formatDateTimeNoSeconds(r.startRecordedAt)}</td>
                      <td className="p-3">
                        <LocBtn
                          lat={r.startLatitude}
                          lng={r.startLongitude}
                          title={`${r.vehicle.plateNumber} — ${t('dailyKmStartShort')}`}
                          onOpen={(lat, lon, title) => {
                            setMapPoint({ lat, lon, title });
                            setMapOpen(true);
                          }}
                        />
                      </td>
                      <td className="p-3">
                        {r.startOdometerUrl ? (
                          <a
                            className="text-blue-600 hover:underline dark:text-blue-400"
                            href={apiUrl(r.startOdometerUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('dailyKmViewPhoto')}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        colSpan={4}
                        className="border-s border-slate-100 p-2 align-middle text-center text-xs dark:border-slate-800"
                      >
                        {endPending ? (
                          <span className="font-medium leading-snug text-red-800 dark:text-red-200">{t('dailyKmEndPendingShort')}</span>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 py-0.5">
                            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                              {String(r.endKm)} · {formatDateTimeNoSeconds(r.endRecordedAt)}
                            </span>
                            <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t('dailyKmFullEndBelow')}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                    <tr className={endPending ? '' : 'app-table-row'} title={endPending ? t('dailyKmEndPending') : undefined}>
                      <td
                        colSpan={4}
                        className={
                          endPending
                            ? `border-s border-slate-100 p-2 text-center align-middle text-xs leading-snug dark:border-slate-800 ${row2FillerWhenPending}`
                            : 'border-s border-slate-100 border-t border-slate-100 p-2 text-center align-middle text-xs leading-snug text-slate-500 dark:border-slate-800 dark:text-slate-400'
                        }
                      >
                        <span className={endPending ? 'text-red-900/80 dark:text-red-100/90' : ''}>{t('dailyKmRow2Bridge')}</span>
                      </td>
                      <td
                        className={
                          endPending
                            ? `border-s border-red-200 p-3 pl-2 ${pendingEndCell} shadow-[inset_4px_0_0_0_rgb(220_38_38)] dark:border-red-800/60`
                            : 'border-s border-slate-100 border-t border-slate-100 p-3 dark:border-slate-800'
                        }
                      >
                        {endPending ? (
                          <span className="text-xs font-medium leading-snug text-red-800 dark:text-red-100">{t('dailyKmEndPending')}</span>
                        ) : (
                          String(r.endKm)
                        )}
                      </td>
                      <td
                        className={`p-3 whitespace-nowrap ${endPending ? `${pendingEndCell} text-red-700 dark:text-red-200` : 'border-t border-slate-100 dark:border-slate-800'}`}
                      >
                        {endPending ? '—' : formatDateTimeNoSeconds(r.endRecordedAt)}
                      </td>
                      <td className={`p-3 ${endPending ? pendingEndCell : 'border-t border-slate-100 dark:border-slate-800'}`}>
                        {endPending ? (
                          <span className="text-red-600 dark:text-red-300">—</span>
                        ) : (
                          <LocBtn
                            lat={r.endLatitude}
                            lng={r.endLongitude}
                            title={`${r.vehicle.plateNumber} — ${t('dailyKmEndShort')}`}
                            onOpen={(lat, lon, title) => {
                              setMapPoint({ lat, lon, title });
                              setMapOpen(true);
                            }}
                          />
                        )}
                      </td>
                      <td className={`p-3 ${endPending ? pendingEndCell : 'border-t border-slate-100 dark:border-slate-800'}`}>
                        {endPending ? (
                          <span className="text-red-600 dark:text-red-300">—</span>
                        ) : r.endOdometerUrl ? (
                          <a
                            className="text-blue-600 hover:underline dark:text-blue-400"
                            href={apiUrl(r.endOdometerUrl)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t('dailyKmViewPhoto')}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {view === 'gaps' && isAdmin && (
        <div className="app-card min-w-0 overflow-hidden">
          <div className="app-table-wrap overflow-x-auto">
            <table className="app-table-inner min-w-[720px] text-sm">
              <thead className="app-table-head">
                <tr>
                  <th className="p-3">{t('plate')}</th>
                  <th className="p-3">{t('fullName')}</th>
                  <th className="p-3">{t('dailyKmGapsTotalPlusKm')}</th>
                  <th className="p-3">{t('dailyKmGapsMaxInPeriod')}</th>
                  <th className="p-3">{t('dailyKmGapsCountDays')}</th>
                </tr>
              </thead>
              <tbody>
                {gapDriverSummaries.length === 0 ? (
                  <tr className="app-table-row">
                    <td colSpan={5} className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t('dailyKmGapsNoData')}
                    </td>
                  </tr>
                ) : (
                  gapDriverSummaries.map((s) => {
                    const tier = gapTier(s.maxG);
                    const open = expandedVehicleId === s.vehicleId;
                    return (
                      <Fragment key={s.vehicleId}>
                        <tr
                          className={`app-table-row cursor-pointer ${gapRowTone(tier)}`}
                          onClick={() => setExpandedVehicleId((id) => (id === s.vehicleId ? null : s.vehicleId))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedVehicleId((id) => (id === s.vehicleId ? null : s.vehicleId));
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-expanded={open}
                        >
                          <td className="p-3 font-mono">{s.plate}</td>
                          <td className="p-3">{s.driver}</td>
                          <td className="p-3 font-semibold tabular-nums">+{s.sumPos}</td>
                          <td className="p-3 tabular-nums">{s.maxG}</td>
                          <td className="p-3 tabular-nums">{s.countPos}</td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50/50 dark:bg-slate-900/60">
                            <td colSpan={5} className="p-0">
                              <div className="border-t border-slate-200 px-3 py-3 dark:border-slate-700">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                  {t('dailyKmGapsDetailTitle')}
                                </p>
                                <div className="app-table-wrap overflow-x-auto">
                                  <table className="app-table-inner min-w-[840px] text-sm">
                                    <thead className="app-table-head">
                                      <tr>
                                        <th className="p-2">{t('dailyKmGapsColReportDay')}</th>
                                        <th className="p-2">{t('dailyKmGapsColPrevDay')}</th>
                                        <th className="p-2">{t('dailyKmGapsColPrevEnd')}</th>
                                        <th className="p-2">{t('dailyKmGapsColStart')}</th>
                                        <th className="p-2">{t('dailyKmGapsColEnd')}</th>
                                        <th className="p-2">{t('dailyKmGapsColGap')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {s.rows.map((r) => {
                                        const g = r.gapKm == null ? NaN : Number(r.gapKm);
                                        const trTier = gapTier(Number.isFinite(g) ? g : null);
                                        return (
                                          <tr
                                            key={r.reportId}
                                            className={`${gapRowTone(trTier)} border-t border-slate-100 dark:border-slate-800`}
                                          >
                                            <td className="p-2 whitespace-nowrap">{formatDateOnly(r.reportDate)}</td>
                                            <td className="p-2 whitespace-nowrap">{formatDateOnly(r.prevReportDate)}</td>
                                            <td className="p-2 tabular-nums">{r.prevEndKm ?? '—'}</td>
                                            <td className="p-2 tabular-nums">{r.startKm}</td>
                                            <td className="p-2 tabular-nums">{r.endKm ?? '—'}</td>
                                            <td className="p-2">
                                              {r.gapKm == null ? (
                                                '—'
                                              ) : (
                                                <span className="inline-flex flex-wrap items-center gap-2">
                                                  <span className="font-semibold tabular-nums">+{r.gapKm}</span>
                                                  <span
                                                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${gapBadgeClass(trTier)}`}
                                                  >
                                                    {trTier === 'ok' && t('dailyKmGapsOk')}
                                                    {trTier === 'low' && t('dailyKmGapsSeverityLow')}
                                                    {trTier === 'mid' && t('dailyKmGapsSeverityMid')}
                                                    {trTier === 'high' && t('dailyKmGapsSeverityHigh')}
                                                    {trTier === 'unknown' && '—'}
                                                  </span>
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mapOpen && mapPoint && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
          <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Close" onClick={() => setMapOpen(false)} />
          <div className="relative z-[81] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">{mapPoint.title}</p>
              <button type="button" className="app-btn-ghost px-3 py-1 text-sm" onClick={() => setMapOpen(false)}>
                {t('cancel')}
              </button>
            </div>
            <div className="h-[360px] w-full">
              <MapContainer center={mapCenter} zoom={14} className="h-full w-full" scrollWheelZoom>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[mapPoint.lat, mapPoint.lon]} />
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
