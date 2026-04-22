import { useEffect, useMemo, useState } from 'react';
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
  endKm: string | null;
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

  return (
    <div className="app-page">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="app-page-title">{t('navDailyKm')}</h1>
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

      <div className="app-card min-w-0 overflow-hidden">
        <div className="app-table-wrap overflow-x-auto">
          <table className="app-table-inner min-w-[960px] text-sm">
            <thead className="app-table-head">
              <tr>
                <th className="p-3">{t('plate')}</th>
                <th className="p-3">{t('fullName')}</th>
                <th className="p-3">{t('dailyKmColStartKm')}</th>
                <th className="p-3">{t('dailyKmColStartTime')}</th>
                <th className="p-3">{t('dailyKmColStartLoc')}</th>
                <th className="p-3">{t('dailyKmColStartPhoto')}</th>
                <th className="p-3">{t('dailyKmColEndKm')}</th>
                <th className="p-3">{t('dailyKmColEndTime')}</th>
                <th className="p-3">{t('dailyKmColEndLoc')}</th>
                <th className="p-3">{t('dailyKmColEndPhoto')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="app-table-row">
                  <td className="p-3 font-mono">{r.vehicle.plateNumber}</td>
                  <td className="p-3">{r.driver.fullName}</td>
                  <td className="p-3">{r.startKm}</td>
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
                      <a className="text-blue-600 hover:underline dark:text-blue-400" href={apiUrl(r.startOdometerUrl)} target="_blank" rel="noreferrer">
                        {t('linkOpen')}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">{r.endKm ?? '—'}</td>
                  <td className="p-3 whitespace-nowrap">{formatDateTimeNoSeconds(r.endRecordedAt)}</td>
                  <td className="p-3">
                    <LocBtn
                      lat={r.endLatitude}
                      lng={r.endLongitude}
                      title={`${r.vehicle.plateNumber} — ${t('dailyKmEndShort')}`}
                      onOpen={(lat, lon, title) => {
                        setMapPoint({ lat, lon, title });
                        setMapOpen(true);
                      }}
                    />
                  </td>
                  <td className="p-3">
                    {r.endOdometerUrl ? (
                      <a className="text-blue-600 hover:underline dark:text-blue-400" href={apiUrl(r.endOdometerUrl)} target="_blank" rel="noreferrer">
                        {t('linkOpen')}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
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
