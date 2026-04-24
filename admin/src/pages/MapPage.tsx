import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io, Socket } from 'socket.io-client';
import { api, API_BASE, getToken } from '@/lib/api';
import { useI18n } from '@/i18n/I18nContext';
import { DateTimeField } from '@/components/DateTimeField';
import { fuelPumpLeafletIcon, type FuelStationMapItem } from '@/lib/fuelStationsMap';
import { toDatetimeLocalValue } from '@/lib/datetimeLocal';
import clsx from 'clsx';
import { Check, ChevronsUpDown, Fuel, Loader2, RefreshCw, Search, X } from 'lucide-react';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

/** Oxirgi server qabul vaqti shu oralig‘da bo‘lsa «onlayn» (driver ilovadan kelgan batch kechikishi mumkin). */
const ONLINE_MS = 60 * 1000;

/** Backend analytics bilan mos: juda yomon aniqlikdagi nuqtalar tashlanadi. */
const MAX_ACCURACY_M = 100;

/** Navoiy shahri (default xarita markazi). */
const DEFAULT_MAP_CENTER: [number, number] = [40.0844, 65.3792];
const DEFAULT_MAP_ZOOM = 11;

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function pin(color: string) {
  return L.divIcon({
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid rgba(255,255,255,0.95);box-shadow:0 6px 16px rgba(0,0,0,0.22)"></span>`,
  });
}

const OnlineIcon = pin('#22c55e');
const OfflineIcon = pin('#94a3b8');
const SelectedIcon = pin('#3b82f6');
const StartRouteIcon = pin('#10b981');
const EndRouteIcon = pin('#f43f5e');

function formatDurationHms(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function km2(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

type Live = {
  id: string;
  name: string;
  plateNumber: string;
  lastLatitude: string | null;
  lastLongitude: string | null;
  lastLocationAt: string | null;
  drivers: { fullName: string }[];
};

type Vehicle = {
  id: string;
  name: string;
  model: string | null;
  plateNumber: string;
};

type HistoryRow = { latitude: string; longitude: string; accuracyM: number | null };

type MapAnalytics = {
  gpsKm: number;
  odometerKm: number;
  odometerDays: number;
  pointsCount: number;
  pointsCountRaw: number;
  movingDurationSec: number;
  stoppedDurationSec: number;
  stopSegments: {
    startAt: string;
    endAt: string;
    durationSec: number;
    latitude: number;
    longitude: number;
    pointCount: number;
  }[];
  visitedClusters: {
    latitude: number;
    longitude: number;
    totalStopSec: number;
    visitCount: number;
  }[];
  startPoint: { latitude: number; longitude: number; recordedAt: string } | null;
  endPoint: { latitude: number; longitude: number; recordedAt: string } | null;
};

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

/**
 * Tanlangan mashina uchun xarita bir marta yaqinlashtiriladi;
 * keyingi live yangilanishlarda qayta flyTo qilinmaydi (pozitsiya kelguncha kutadi).
 */
function FlyToSelectedOnVehicleChange({
  pos,
  vehicleId,
}: {
  pos: [number, number] | null;
  vehicleId: string;
}) {
  const map = useMap();
  const trackedVehicleId = useRef<string | null>(null);
  const didFlyForTracked = useRef(false);
  useEffect(() => {
    if (!vehicleId) {
      trackedVehicleId.current = null;
      didFlyForTracked.current = false;
      return;
    }
    if (trackedVehicleId.current !== vehicleId) {
      trackedVehicleId.current = vehicleId;
      didFlyForTracked.current = false;
    }
    if (!pos) return;
    if (didFlyForTracked.current) return;
    didFlyForTracked.current = true;
    map.flyTo(pos, Math.max(14, map.getZoom()), { duration: 0.55 });
  }, [map, vehicleId, pos]);
  return null;
}

function livePayloadEqual(a: Live[], b: Live[]): boolean {
  if (a.length !== b.length) return false;
  const sig = (x: Live) =>
    `${x.id}|${x.lastLatitude ?? ''}|${x.lastLongitude ?? ''}|${x.lastLocationAt ?? ''}|${x.drivers?.[0]?.fullName ?? ''}`;
  const ma = new Map(a.map((x) => [x.id, sig(x)]));
  for (const x of b) {
    if (ma.get(x.id) !== sig(x)) return false;
  }
  return true;
}

type RefreshUi = 'idle' | 'loading' | 'success';

export function MapPage() {
  const { t } = useI18n();
  const [live, setLive] = useState<Live[]>([]);
  const [history, setHistory] = useState<[number, number][]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelStations, setFuelStations] = useState<FuelStationMapItem[]>([]);
  const [fuelLayerVisible, setFuelLayerVisible] = useState(false);
  const [vehicleQuery, setVehicleQuery] = useState('');
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const vehicleRef = useRef<HTMLDivElement>(null);
  const [refreshUi, setRefreshUi] = useState<RefreshUi>('idle');
  const refreshTimersRef = useRef<number[]>([]);
  const [nowTick, setNowTick] = useState(0);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDatetimeLocalValue(d);
  });
  const [to, setTo] = useState(() => toDatetimeLocalValue(new Date()));

  const [analytics, setAnalytics] = useState<MapAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const loadLive = useCallback(() => {
    api<Live[]>('/tracking/live')
      .then((next) => {
        setLive((prev) => (livePayloadEqual(prev, next) ? prev : next));
      })
      .catch(() => {});
  }, []);

  const loadVehicles = () => api<Vehicle[]>('/vehicles').then(setVehicles).catch(() => {});

  const loadFuelStations = () =>
    api<FuelStationMapItem[]>('/map/fuel-stations').then(setFuelStations).catch(() => setFuelStations([]));

  const loadRouteAnalytics = useCallback(async () => {
    if (!vehicleId) {
      setHistory([]);
      setAnalytics(null);
      setAnalyticsError(null);
      setAnalyticsLoading(false);
      return;
    }
    const startD = new Date(from);
    const endD = new Date(to);
    if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime()) || startD > endD) {
      setAnalyticsError(t('mapRangeInvalid'));
      setHistory([]);
      setAnalytics(null);
      return;
    }
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    const qFrom = encodeURIComponent(startD.toISOString());
    const qTo = encodeURIComponent(endD.toISOString());
    const qV = encodeURIComponent(vehicleId);
    try {
      const [hist, ana] = await Promise.all([
        api<HistoryRow[]>(`/tracking/history?vehicleId=${qV}&from=${qFrom}&to=${qTo}`),
        api<MapAnalytics>(`/tracking/analytics?vehicleId=${qV}&from=${qFrom}&to=${qTo}`),
      ]);
      const histFiltered = hist.filter((p) => p.accuracyM == null || p.accuracyM <= MAX_ACCURACY_M);
      setHistory(histFiltered.map((p) => [Number(p.latitude), Number(p.longitude)]));
      setAnalytics(ana);
    } catch {
      setHistory([]);
      setAnalytics(null);
      setAnalyticsError(t('mapAnalyticsError'));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [vehicleId, from, to, t]);

  useEffect(() => {
    void loadRouteAnalytics();
  }, [loadRouteAnalytics]);

  useEffect(() => {
    void loadLive();
    void loadVehicles();
    const intervalMs = vehicleId ? 10_000 : 5_000;
    const id = window.setInterval(() => void loadLive(), intervalMs);
    return () => window.clearInterval(id);
  }, [loadLive, vehicleId]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((x) => x + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  const clearRefreshTimers = () => {
    for (const tid of refreshTimersRef.current) window.clearTimeout(tid);
    refreshTimersRef.current = [];
  };

  useEffect(() => () => clearRefreshTimers(), []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const socket: Socket = io(`${API_BASE}/tracking`, {
      auth: { token },
      transports: ['websocket'],
    });
    const reload = () => void loadLive();
    socket.on('connect', reload);
    socket.on('location', reload);
    return () => {
      socket.disconnect();
    };
  }, [loadLive]);

  const markers = useMemo(() => {
    return live
      .filter((v) => v.lastLatitude && v.lastLongitude)
      .map((v) => ({
        id: v.id,
        pos: [Number(v.lastLatitude), Number(v.lastLongitude)] as [number, number],
        title: `${v.plateNumber} — ${v.drivers[0]?.fullName ?? ''}`,
        lastLocationAt: v.lastLocationAt,
      }));
  }, [live]);

  const selectedPos = useMemo(() => {
    if (!vehicleId) return null;
    return markers.find((m) => m.id === vehicleId)?.pos ?? null;
  }, [markers, vehicleId]);

  const onlineIds = useMemo(() => {
    const nowMs = Date.now();
    const s = new Set<string>();
    for (const v of live) {
      const ts = v.lastLocationAt ? new Date(v.lastLocationAt).getTime() : 0;
      if (Number.isFinite(ts) && nowMs - ts <= ONLINE_MS) s.add(v.id);
    }
    return s;
  }, [live, nowTick]);

  const onlineCount = useMemo(() => vehicles.filter((v) => onlineIds.has(v.id)).length, [vehicles, onlineIds]);
  const offlineCount = Math.max(0, vehicles.length - onlineCount);

  const driverNameByVehicleId = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of live) {
      const n = v.drivers?.[0]?.fullName;
      if (n) m.set(v.id, n);
    }
    return m;
  }, [live]);

  const filteredVehicles = useMemo(() => {
    const q = vehicleQuery.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) => {
      const driver = driverNameByVehicleId.get(v.id) ?? '';
      const haystack = `${v.plateNumber} ${v.name} ${v.model ?? ''} ${driver}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [vehicles, vehicleQuery, driverNameByVehicleId]);

  const selectedVehicleLabel = useMemo(() => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return '';
    const driver = driverNameByVehicleId.get(v.id);
    return `${v.plateNumber} — ${v.name}${v.model ? ` (${v.model})` : ''}${driver ? ` — ${driver}` : ''}`;
  }, [vehicles, vehicleId, driverNameByVehicleId]);

  useEffect(() => {
    if (!vehicleOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = vehicleRef.current;
      if (!el?.contains(e.target as Node)) setVehicleOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVehicleOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [vehicleOpen]);

  /** Marshrut/analytics: live markerlar bu ro‘yxatga kirmaydi — har poll da fitBounds qayta ishlamaydi. */
  const routeFitBoundsPoints = useMemo(() => {
    const pts: [number, number][] = [];
    if (history.length) for (const p of history) pts.push(p);
    if (analytics?.stopSegments?.length) {
      for (const s of analytics.stopSegments) pts.push([s.latitude, s.longitude]);
    }
    if (analytics?.startPoint) pts.push([analytics.startPoint.latitude, analytics.startPoint.longitude]);
    if (analytics?.endPoint) pts.push([analytics.endPoint.latitude, analytics.endPoint.longitude]);
    return pts;
  }, [history, analytics]);

  const fleetFitBoundsPoints = useMemo(() => markers.map((m) => m.pos), [markers]);

  const fitBoundsPoints = routeFitBoundsPoints.length > 0 ? routeFitBoundsPoints : fleetFitBoundsPoints;

  const onRefreshAll = async () => {
    clearRefreshTimers();
    setRefreshUi('loading');
    try {
      await Promise.all([
        loadLive(),
        loadVehicles(),
        ...(fuelLayerVisible ? [loadFuelStations()] : []),
        loadRouteAnalytics(),
      ]);
      const t1 = window.setTimeout(() => {
        setRefreshUi('success');
        const t2 = window.setTimeout(() => setRefreshUi('idle'), 2000);
        refreshTimersRef.current.push(t2);
      }, 600);
      refreshTimersRef.current.push(t1);
    } catch {
      setRefreshUi('idle');
    }
  };

  const showRoute = history.length > 1;
  const dupStartEnd = Boolean(
    analytics?.startPoint &&
      analytics?.endPoint &&
      analytics.startPoint.latitude === analytics.endPoint.latitude &&
      analytics.startPoint.longitude === analytics.endPoint.longitude,
  );

  return (
    <div className="app-page">
      <div className="flex items-start justify-between gap-3">
        <h1 className="app-page-title">{t('navMap')}</h1>
        <button
          type="button"
          className="app-btn-ghost shrink-0 p-2"
          aria-label={t('mapRefresh')}
          disabled={refreshUi === 'loading'}
          onClick={() => void onRefreshAll()}
        >
          {refreshUi === 'loading' ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : refreshUi === 'success' ? (
            <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          ) : (
            <RefreshCw className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

      <div className="app-card-pad relative z-20 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div ref={vehicleRef} className="relative min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('mapVehicle')}</label>
          <div className="flex min-w-0 gap-1">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={vehicleOpen}
              onClick={() =>
                setVehicleOpen((o) => {
                  const next = !o;
                  if (next) setVehicleQuery('');
                  return next;
                })
              }
              className={clsx(
                'app-input flex min-w-0 flex-1 items-center justify-between gap-2 text-left',
                !vehicleId && 'text-slate-500 dark:text-slate-400',
              )}
            >
              <span className="truncate">{selectedVehicleLabel || t('mapVehicleSelectPlaceholder')}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </button>
            {vehicleId ? (
              <button
                type="button"
                className="app-btn-ghost shrink-0 rounded-lg border border-slate-200/90 px-2 py-2 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800/80"
                aria-label={t('mapClearVehicle')}
                title={t('mapClearVehicle')}
                onClick={() => {
                  setVehicleId('');
                  setVehicleQuery('');
                  setVehicleOpen(false);
                }}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>

          {vehicleOpen && (
            <div
              role="listbox"
              className="absolute left-0 top-full z-[5000] mt-2 w-[min(100vw-1.5rem,30rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg dark:border-slate-700/90 dark:bg-slate-900"
            >
              <div className="flex items-center gap-2 border-b border-slate-200/90 px-3 py-2 dark:border-slate-700/90">
                <Search className="h-4 w-4 text-slate-400" aria-hidden />
                <input
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  value={vehicleQuery}
                  onChange={(e) => setVehicleQuery(e.target.value)}
                  placeholder={t('mapVehicleSearchPlaceholder')}
                  autoFocus
                />
              </div>
              <div className="max-h-[min(55vh,360px)] overflow-auto p-1">
                {filteredVehicles.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">{t('mapVehicleNoResults')}</div>
                ) : (
                  filteredVehicles.map((v) => {
                    const driver = driverNameByVehicleId.get(v.id);
                    const label = `${v.plateNumber} — ${v.name}${v.model ? ` (${v.model})` : ''}${driver ? ` — ${driver}` : ''}`;
                    const active = v.id === vehicleId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setVehicleId(v.id);
                          setVehicleOpen(false);
                        }}
                        className={clsx(
                          'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition',
                          active
                            ? 'bg-blue-50 text-slate-900 dark:bg-blue-950/30 dark:text-slate-50'
                            : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/50',
                        )}
                      >
                        <span className="truncate">{label}</span>
                        {active && <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-end justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-slate-700/90 dark:bg-slate-900/85">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('mapOnline')}</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{onlineCount}</span>
          </div>
          <div className="flex items-end justify-between gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-slate-700/90 dark:bg-slate-900/85">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('mapOffline')}</span>
            </div>
            <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{offlineCount}</span>
          </div>
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('mapFrom')}</label>
          <DateTimeField
            value={from}
            onChange={setFrom}
            onClear={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setFrom(toDatetimeLocalValue(d));
            }}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('mapTo')}</label>
          <DateTimeField
            value={to}
            onChange={setTo}
            onClear={() => setTo(toDatetimeLocalValue(new Date()))}
          />
        </div>
      </div>

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[1fr_min(22rem,100%)] lg:items-stretch">
        <div className="app-card relative z-0 h-[min(52vh,520px)] min-h-[260px] w-full min-w-0 overflow-hidden p-0 sm:min-h-[320px] lg:h-[min(70vh,640px)] lg:min-h-[400px]">
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
                if (next) void loadFuelStations();
                return next;
              });
            }}
          >
            <Fuel className="h-5 w-5 text-slate-900" strokeWidth={2.25} aria-hidden />
          </button>
          <MapContainer center={DEFAULT_MAP_CENTER} zoom={DEFAULT_MAP_ZOOM} className="h-full w-full" scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={fitBoundsPoints} />
            <FlyToSelectedOnVehicleChange pos={selectedPos} vehicleId={vehicleId} />
            {showRoute && <Polyline positions={history} pathOptions={{ color: '#0f172a', weight: 4 }} />}
            {analytics?.stopSegments.map((s, idx) => (
              <Circle
                key={`stop-${idx}-${s.startAt}`}
                center={[s.latitude, s.longitude]}
                radius={95}
                pathOptions={{
                  color: '#6d28d9',
                  fillColor: '#a78bfa',
                  fillOpacity: 0.28,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold">{t('mapStopPopup')}</div>
                    <div>
                      {formatDurationHms(s.durationSec)} · {s.pointCount} {t('mapPoints')}
                    </div>
                    <div className="mt-1 text-slate-600">
                      {new Date(s.startAt).toLocaleString()} → {new Date(s.endAt).toLocaleString()}
                    </div>
                  </div>
                </Popup>
              </Circle>
            ))}
            {fuelLayerVisible &&
              fuelStations.map((s) => (
                <Marker key={s.id} position={[s.lat, s.lon]} icon={fuelPumpLeafletIcon}>
                  <Popup className="map-fuel-popup">
                    <div className="map-fuel-popup-body">{s.label}</div>
                  </Popup>
                </Marker>
              ))}
            {analytics?.startPoint && !dupStartEnd && (
              <Marker position={[analytics.startPoint.latitude, analytics.startPoint.longitude]} icon={StartRouteIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} className="map-marker-tooltip">
                  {t('mapRouteStart')}
                </Tooltip>
              </Marker>
            )}
            {analytics?.endPoint && (
              <Marker position={[analytics.endPoint.latitude, analytics.endPoint.longitude]} icon={EndRouteIcon}>
                <Tooltip direction="top" offset={[0, -10]} opacity={1} className="map-marker-tooltip">
                  {dupStartEnd ? t('mapRouteSinglePoint') : t('mapRouteEnd')}
                </Tooltip>
              </Marker>
            )}
            {markers.map((m) => (
              <Marker
                key={m.id}
                position={m.pos}
                icon={m.id === vehicleId ? SelectedIcon : onlineIds.has(m.id) ? OnlineIcon : OfflineIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -10]}
                  opacity={1}
                  interactive={false}
                  className="map-marker-tooltip"
                >
                  {m.title}
                </Tooltip>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <aside className="app-card app-card-pad flex max-h-[min(70vh,640px)] min-h-[200px] flex-col gap-3 overflow-y-auto lg:max-h-none">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{t('mapPanelTitle')}</h2>
          {!vehicleId && <p className="text-sm text-slate-500 dark:text-slate-400">{t('mapPanelSelectVehicle')}</p>}
          {vehicleId && analyticsLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              {t('mapAnalyticsLoading')}
            </div>
          )}
          {vehicleId && analyticsError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {analyticsError}
            </p>
          )}
          {vehicleId && !analyticsLoading && !analyticsError && analytics && (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 dark:border-slate-700/90 dark:bg-slate-800/50">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('mapGpsKm')}
                  </div>
                  <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{km2(analytics.gpsKm)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('mapGpsKmHint')}</div>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 dark:border-slate-700/90 dark:bg-slate-800/50">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('mapOdometerKm')}
                  </div>
                  <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{km2(analytics.odometerKm)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('mapOdometerDays', { n: String(analytics.odometerDays) })}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('mapOdometerKmHint')}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200/80 px-2 py-1.5 dark:border-slate-700/80">
                  <span className="text-slate-500 dark:text-slate-400">{t('mapMovingTime')}</span>
                  <div className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatDurationHms(analytics.movingDurationSec)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200/80 px-2 py-1.5 dark:border-slate-700/80">
                  <span className="text-slate-500 dark:text-slate-400">{t('mapStoppedTime')}</span>
                  <div className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatDurationHms(analytics.stoppedDurationSec)}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('mapPointsFiltered', {
                  filtered: String(analytics.pointsCount),
                  raw: String(analytics.pointsCountRaw),
                })}
              </p>
              {history.length === 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-300/90">{t('mapNoHistoryInRange')}</p>
              )}
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  {t('mapVisitedPlaces')}
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {analytics.visitedClusters.slice(0, 10).map((c, i) => (
                    <li
                      key={`vc-${i}-${c.latitude}`}
                      className="flex justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800/60"
                    >
                      <span className="truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-800 dark:text-slate-100">
                        {formatDurationHms(c.totalStopSec)} · {c.visitCount}×
                      </span>
                    </li>
                  ))}
                </ul>
                {analytics.visitedClusters.length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('mapNoStopsInRange')}</p>
                )}
              </div>
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  {t('mapLongStops')}
                </h3>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {analytics.stopSegments.slice(0, 15).map((s, i) => (
                    <li key={`ss-${i}-${s.startAt}`} className="rounded-lg border border-slate-200/70 px-2 py-1 dark:border-slate-700/70">
                      <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                      </div>
                      <div className="text-slate-700 dark:text-slate-200">
                        {formatDurationHms(s.durationSec)} · {new Date(s.startAt).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
