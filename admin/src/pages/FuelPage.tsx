import { useEffect, useMemo, useRef, useState } from 'react';
import { Car, Fuel, Maximize2, Receipt, X } from 'lucide-react';
import clsx from 'clsx';
import { api, apiUrl } from '@/lib/api';
import { fuelPumpLeafletIcon, fuelStationsApiPathForPoint, type FuelStationMapItem } from '@/lib/fuelStationsMap';
import { useI18n } from '@/i18n/I18nContext';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
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

type Row = {
  id: string;
  amount: string;
  createdAt: string;
  vehicle: { plateNumber: string };
  driver: { fullName: string };
  latitude: string | null;
  longitude: string | null;
  vehiclePhotoUrl: string | null;
  receiptPhotoUrl: string | null;
};

function toDateInputValueLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTimeNoSeconds(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

export function FuelPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [dateValue, setDateValue] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDatetimeLocalValue(d);
  });
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPoint, setMapPoint] = useState<{ lat: number; lon: number; title: string } | null>(null);
  const [fuelLayerVisible, setFuelLayerVisible] = useState(false);
  const [fuelStations, setFuelStations] = useState<FuelStationMapItem[]>([]);
  const [photo, setPhoto] = useState<{ src: string; title: string } | null>(null);
  const [photoFs, setPhotoFs] = useState(false);
  const photoStageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = new Date(dateValue);
    const date = toDateInputValueLocal(selected);
    api<Row[]>(`/fuel-reports?date=${encodeURIComponent(date)}`).then(setRows).catch(() => {});
  }, [dateValue]);

  useEffect(() => {
    if (!mapOpen) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setMapOpen(false);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [mapOpen]);

  useEffect(() => {
    if (mapOpen && mapPoint) {
      setFuelLayerVisible(false);
      setFuelStations([]);
    }
  }, [mapOpen, mapPoint?.lat, mapPoint?.lon, mapPoint?.title]);

  useEffect(() => {
    if (!photo) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setPhoto(null);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [photo]);

  useEffect(() => {
    if (!photo) {
      setPhotoFs(false);
      return;
    }
    const sync = () => {
      const el = photoStageRef.current;
      setPhotoFs(Boolean(el && document.fullscreenElement === el));
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [photo]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (!mapPoint) return [41.31, 69.24];
    return [mapPoint.lat, mapPoint.lon];
  }, [mapPoint]);

  return (
    <div className="app-page">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="app-page-title">{t('navFuel')}</h1>
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
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('fullName')}</th>
              <th className="p-3">{t('amount')}</th>
              <th className="p-3">{t('colTime')}</th>
              <th className="p-3">{t('colLocation')}</th>
              <th className="p-3">{t('colVehiclePhoto')}</th>
              <th className="p-3">{t('colReceipt')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="app-table-row">
                <td className="p-3 font-mono">{r.vehicle.plateNumber}</td>
                <td className="p-3">{r.driver.fullName}</td>
                <td className="p-3">{r.amount}</td>
                <td className="p-3 whitespace-nowrap">{formatDateTimeNoSeconds(r.createdAt)}</td>
                <td className="p-3">
                  {r.latitude && r.longitude ? (
                    <button
                      type="button"
                      className="font-medium text-blue-600 underline decoration-blue-600/30 hover:text-blue-700 dark:text-blue-400"
                      onClick={() => {
                        const lat = Number(r.latitude);
                        const lon = Number(r.longitude);
                        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
                        setMapPoint({
                          lat,
                          lon,
                          title: `${r.vehicle.plateNumber} — ${r.driver.fullName}`,
                        });
                        setMapOpen(true);
                      }}
                    >
                      {t('linkMap')}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3">
                  {r.vehiclePhotoUrl ? (
                    <button
                      type="button"
                      className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                      onClick={() =>
                        setPhoto({ src: apiUrl(r.vehiclePhotoUrl as string), title: t('colVehiclePhoto') })
                      }
                      aria-label={t('colVehiclePhoto')}
                      title={t('colVehiclePhoto')}
                    >
                      <Car size={16} className="text-blue-600 dark:text-blue-400" aria-hidden />
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="p-3">
                  {r.receiptPhotoUrl ? (
                    <button
                      type="button"
                      className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                      onClick={() =>
                        setPhoto({ src: apiUrl(r.receiptPhotoUrl as string), title: t('colReceipt') })
                      }
                      aria-label={t('colReceipt')}
                      title={t('colReceipt')}
                    >
                      <Receipt size={16} className="text-blue-600 dark:text-blue-400" aria-hidden />
                    </button>
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
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px]"
            aria-label="Close map"
            onClick={() => setMapOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,980px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{t('colLocation')}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{mapPoint.title}</div>
              </div>
              <button type="button" className="app-btn-ghost" onClick={() => setMapOpen(false)}>
                {t('cancel')}
              </button>
            </div>
            <div className="relative h-[min(62vh,520px)] w-full">
              <button
                type="button"
                className={clsx(
                  'absolute right-2 top-2 z-[410] flex h-10 w-10 items-center justify-center rounded-[10px] border-2 border-slate-900 bg-white shadow-md transition hover:bg-slate-50 dark:border-slate-200 dark:bg-white dark:hover:bg-slate-100',
                  fuelLayerVisible &&
                    'border-amber-600 bg-amber-50 ring-2 ring-amber-400/90 ring-offset-2 ring-offset-white dark:ring-offset-slate-900',
                )}
                aria-pressed={fuelLayerVisible}
                aria-label={t('mapFuelLayer')}
                title={t('mapFuelLayer')}
                onClick={() => {
                  setFuelLayerVisible((v) => {
                    const next = !v;
                    if (next) {
                      void api<FuelStationMapItem[]>(fuelStationsApiPathForPoint(mapPoint.lat, mapPoint.lon))
                        .then(setFuelStations)
                        .catch(() => setFuelStations([]));
                    }
                    return next;
                  });
                }}
              >
                <Fuel className="h-5 w-5 text-slate-900" strokeWidth={2.25} aria-hidden />
              </button>
              <MapContainer center={mapCenter} zoom={15} className="h-full w-full" scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[mapPoint.lat, mapPoint.lon]} />
                {fuelLayerVisible &&
                  fuelStations.map((s) => (
                    <Marker key={s.id} position={[s.lat, s.lon]} icon={fuelPumpLeafletIcon}>
                      <Popup className="map-fuel-popup">
                        <div className="map-fuel-popup-body">{s.label}</div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>
          </div>
        </>
      )}

      {photo && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[6000] bg-slate-900/60 backdrop-blur-[1px]"
            aria-label={t('cancel')}
            onClick={() => setPhoto(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[6100] w-[min(96vw,980px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{photo.title}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="app-btn-ghost inline-flex items-center gap-2 px-3 py-2"
                  onClick={async () => {
                    const el = photoStageRef.current;
                    if (!el) return;
                    try {
                      if (document.fullscreenElement === el) await document.exitFullscreen();
                      else await el.requestFullscreen();
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <Maximize2 size={16} aria-hidden />
                  <span className="hidden sm:inline">{photoFs ? t('exitFullScreen') : t('fullScreen')}</span>
                </button>
                <button
                  type="button"
                  className="app-btn-ghost inline-flex h-9 w-9 items-center justify-center p-0"
                  aria-label={t('cancel')}
                  onClick={async () => {
                    try {
                      if (document.fullscreenElement) await document.exitFullscreen();
                    } catch {
                      /* ignore */
                    }
                    setPhoto(null);
                  }}
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
            </div>
            <div
              ref={photoStageRef}
              className="flex min-h-[min(78vh,820px)] items-center justify-center bg-slate-950 [:fullscreen]:min-h-screen [:fullscreen]:w-screen"
            >
              <img
                src={photo.src}
                alt=""
                className="max-h-[min(78vh,820px)] max-w-full object-contain [:fullscreen]:max-h-full [:fullscreen]:max-w-full [:fullscreen]:object-cover"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
