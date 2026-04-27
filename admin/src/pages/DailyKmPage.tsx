import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api, apiUrl } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DateTimeField } from '@/components/DateTimeField';
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
  const [rows, setRows] = useState<DailyKmRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'gapsOnly' | 'gapDesc'>('all');
  const [dateValue, setDateValue] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDatetimeLocalValue(d);
  });
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPoint, setMapPoint] = useState<{ lat: number; lon: number; title: string } | null>(null);

  useEffect(() => {
    const selected = new Date(dateValue);
    const date = toDateInputValueLocal(selected);
    api<DailyKmRow[]>(`/daily-km-reports?date=${encodeURIComponent(date)}`).then(setRows).catch(() => {});
  }, [dateValue]);

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

  return (
    <div className="app-page">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="app-page-title">{t('navDailyKm')}</h1>
          <Link to="/daily-km/gaps" className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {t('navDailyKmGaps')}
          </Link>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dailyKmFilterLabel')}</span>
            <select className="app-select w-[240px]" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">{t('dailyKmFilterAll')}</option>
              <option value="gapsOnly">{t('dailyKmFilterGapsOnly')}</option>
              <option value="gapDesc">{t('dailyKmFilterGapDesc')}</option>
            </select>
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
          <label className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{t('date')}</label>
          <div className="w-[190px]">
            <DateTimeField
              value={dateValue}
              onChange={setDateValue}
              mode="date"
              disabled={{ after: new Date() }}
              align="right"
            />
          </div>
        </div>
      </div>

      <p className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 sm:text-sm">
        {t('dailyKmLayoutExplain')}
      </p>

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap overflow-x-auto">
          <table className="app-table-inner min-w-[960px] text-sm">
            <thead className="app-table-head">
              <tr>
                <th rowSpan={2} className="p-3 align-bottom">
                  {t('plate')}
                </th>
                <th rowSpan={2} className="p-3 align-bottom">
                  {t('fullName')}
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
                /** Jadval 10 ustun: 2+4 бошланиш + 4 тугаш. Иккинчи `tr`да фақат 4 та `td` булса, улар 3–6-устунларга тушади — тугаш сарлавҳалари остига эмас. */
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
                            {t('linkOpen')}
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
                            {t('linkOpen')}
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
