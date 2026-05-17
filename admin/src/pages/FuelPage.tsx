import { useEffect, useMemo, useRef, useState } from 'react';
import { Car, Download, Fuel, Maximize2, Receipt, X } from 'lucide-react';
import clsx from 'clsx';
import { api, apiUrl } from '@/lib/api';
import { fuelPumpLeafletIcon, fuelStationsApiPathForPoint, type FuelStationMapItem } from '@/lib/fuelStationsMap';
import { useI18n } from '@/i18n/I18nContext';
import { MapContainer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DatetimeLocalRangeField } from '@/components/DatetimeLocalRangeField';
import { LEAFLET_MAP_MAX_ZOOM, MapBaseLayers } from '@/components/MapBaseLayers';
import { toDatetimeLocalValue } from '@/lib/datetimeLocal';
import {
  downloadFuelReportsExcel,
  loadFuelExportMeta,
  saveFuelExportMeta,
  type FuelExportMeta,
  ymdFromDatetimeLocal,
} from '@/lib/fuelReportExport';
import {
  buildStationPaletteLookup,
  fuelStationNameClass,
  fuelStationRowClass,
  normalizeStationLabelKey,
  resolveStationPaletteIndex,
} from '@/lib/fuelStationRowStyle';
import type { SavedFuelStationMapItem } from '@/lib/savedFuelStationsMap';

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

const FLEET_GAS_PRICE_LS_KEY = 'mashinalar.fleetGasPricePerM3';
const FLEET_PETROL_PRICE_LS_KEY = 'mashinalar.fleetPetrolPricePerLiter';

/** Legend: «номи олинмади» uchun filtri (id bilan aralashmasin). */
const STATION_LEGEND_UNKNOWN = '__fuel_unknown_station__';

type FuelKindFilter = 'ALL' | 'GAS' | 'PETROL';

type Row = {
  id: string;
  amount: string;
  fuelKind?: string;
  unitPrice?: string | null;
  volume?: string | null;
  createdAt: string;
  vehicle: {
    id: string;
    plateNumber: string;
    gasPricePerM3?: string | null;
    petrolPricePerLiter?: string | null;
  };
  driver: { fullName: string };
  latitude: string | null;
  longitude: string | null;
  stationLabel?: string | null;
  savedFuelStationId?: string | null;
  vehiclePhotoUrl: string | null;
  receiptPhotoUrl: string | null;
};

type VehicleRow = {
  id: string;
  plateNumber: string;
  gasPricePerM3?: string | null;
  petrolPricePerLiter?: string | null;
};

/** Legend chip = saqlangan zapravka nomi bilan qаторni solishtirish (id + текст «Спутник» / «XK» парчалари). */
function rowMatchesSavedStationLegend(
  r: Row,
  station: { id: string; name: string },
  resolvedRowLabel: string,
  unknownLabel: string,
): boolean {
  if (!resolvedRowLabel || resolvedRowLabel === unknownLabel) return false;
  if (r.savedFuelStationId && r.savedFuelStationId === station.id) return true;
  const a = normalizeStationLabelKey(resolvedRowLabel);
  const b = normalizeStationLabelKey(station.name);
  if (!a.length || !b.length) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function formatDateTimeNoSeconds(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

function intlLocaleFor(lang: 'uzCyrl' | 'uzLatn' | 'ru'): string {
  if (lang === 'ru') return 'ru-RU';
  if (lang === 'uzCyrl') return 'ru-RU';
  return 'uz-Latn-UZ';
}

export function FuelPage() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [allVehicles, setAllVehicles] = useState<VehicleRow[]>([]);
  const [vehiclesErr, setVehiclesErr] = useState<string | null>(null);
  const [globalGasPrice, setGlobalGasPrice] = useState(() => {
    try {
      return localStorage.getItem(FLEET_GAS_PRICE_LS_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [globalGasSaving, setGlobalGasSaving] = useState(false);
  const [gasSaveErr, setGasSaveErr] = useState<string | null>(null);
  const [gasSaveOk, setGasSaveOk] = useState(false);
  const gasSaveOkTimerRef = useRef<number | null>(null);
  const [globalPetrolPrice, setGlobalPetrolPrice] = useState(() => {
    try {
      return localStorage.getItem(FLEET_PETROL_PRICE_LS_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [globalPetrolSaving, setGlobalPetrolSaving] = useState(false);
  const [petrolSaveErr, setPetrolSaveErr] = useState<string | null>(null);
  const [petrolSaveOk, setPetrolSaveOk] = useState(false);
  const petrolSaveOkTimerRef = useRef<number | null>(null);
  const [fuelKindFilter, setFuelKindFilter] = useState<FuelKindFilter>('ALL');
  const [search, setSearch] = useState('');
  const initToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDatetimeLocalValue(d);
  };
  const [dateFromValue, setDateFromValue] = useState(initToday);
  const [dateToValue, setDateToValue] = useState(initToday);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapPoint, setMapPoint] = useState<{ lat: number; lon: number; title: string } | null>(null);
  const [fuelLayerVisible, setFuelLayerVisible] = useState(false);
  const [fuelStations, setFuelStations] = useState<FuelStationMapItem[]>([]);
  const [photo, setPhoto] = useState<{ src: string; title: string } | null>(null);
  const [photoFs, setPhotoFs] = useState(false);
  const photoStageRef = useRef<HTMLDivElement>(null);
  const [stationByKey, setStationByKey] = useState<Record<string, string | null>>({});
  const [stationLegendFilter, setStationLegendFilter] = useState<string | typeof STATION_LEGEND_UNKNOWN | null>(
    null,
  );
  const [savedFuelStations, setSavedFuelStations] = useState<SavedFuelStationMapItem[]>([]);
  const [exportMeta, setExportMeta] = useState<FuelExportMeta | null>(() => loadFuelExportMeta());

  useEffect(() => {
    const fromD = new Date(dateFromValue);
    const toD = new Date(dateToValue);
    if (!Number.isFinite(fromD.getTime()) || !Number.isFinite(toD.getTime())) return;

    const start = new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate(), 0, 0, 0, 0);
    const endDay = new Date(toD.getFullYear(), toD.getMonth(), toD.getDate(), 0, 0, 0, 0);
    const lo = start.getTime() <= endDay.getTime() ? start : endDay;
    const hi = start.getTime() <= endDay.getTime() ? endDay : start;
    const end = new Date(hi.getFullYear(), hi.getMonth(), hi.getDate() + 1, 0, 0, 0, 0);

    const qs = new URLSearchParams({
      from: lo.toISOString(),
      to: end.toISOString(),
    });
    if (fuelKindFilter !== 'ALL') qs.set('fuelKind', fuelKindFilter);

    api<Row[]>(`/fuel-reports?${qs.toString()}`).then(setRows).catch(() => {});
  }, [dateFromValue, dateToValue, fuelKindFilter]);

  useEffect(() => {
    setVehiclesErr(null);
    api<VehicleRow[]>('/vehicles')
      .then((vs) => {
        const mapped = vs.map((v) => ({
          id: v.id,
          plateNumber: v.plateNumber,
          gasPricePerM3: v.gasPricePerM3,
          petrolPricePerLiter: v.petrolPricePerLiter,
        }));
        setAllVehicles(mapped);

        const gasPrices = mapped.map((v) => (v.gasPricePerM3 == null ? '' : String(v.gasPricePerM3)));
        const gasUniq = Array.from(new Set(gasPrices.filter((p) => p !== '')));
        if (gasUniq.length === 1) {
          const v = gasUniq[0] ?? '';
          setGlobalGasPrice(v);
          try {
            if (v) localStorage.setItem(FLEET_GAS_PRICE_LS_KEY, v);
            else localStorage.removeItem(FLEET_GAS_PRICE_LS_KEY);
          } catch {
            /* ignore */
          }
        } else if (gasUniq.length === 0) {
          setGlobalGasPrice((prev) => {
            if (prev.trim() !== '') return prev;
            try {
              return localStorage.getItem(FLEET_GAS_PRICE_LS_KEY) ?? '';
            } catch {
              return '';
            }
          });
        }

        const petrolPrices = mapped.map((v) =>
          v.petrolPricePerLiter == null ? '' : String(v.petrolPricePerLiter),
        );
        const petrolUniq = Array.from(new Set(petrolPrices.filter((p) => p !== '')));
        if (petrolUniq.length === 1) {
          const v = petrolUniq[0] ?? '';
          setGlobalPetrolPrice(v);
          try {
            if (v) localStorage.setItem(FLEET_PETROL_PRICE_LS_KEY, v);
            else localStorage.removeItem(FLEET_PETROL_PRICE_LS_KEY);
          } catch {
            /* ignore */
          }
        } else if (petrolUniq.length === 0) {
          setGlobalPetrolPrice((prev) => {
            if (prev.trim() !== '') return prev;
            try {
              return localStorage.getItem(FLEET_PETROL_PRICE_LS_KEY) ?? '';
            } catch {
              return '';
            }
          });
        }
      })
      .catch((e: unknown) => {
        setAllVehicles([]);
        setVehiclesErr(e instanceof Error ? e.message : String(e));
      });
  }, []);

  useEffect(() => {
    api<SavedFuelStationMapItem[]>('/map/saved-fuel-stations')
      .then(setSavedFuelStations)
      .catch(() => setSavedFuelStations([]));
  }, []);

  useEffect(() => {
    return () => {
      if (gasSaveOkTimerRef.current != null) window.clearTimeout(gasSaveOkTimerRef.current);
      if (petrolSaveOkTimerRef.current != null) window.clearTimeout(petrolSaveOkTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const pts = rows
      .map((r) => {
        if (r.stationLabel?.trim()) return null;
        const lat = r.latitude ? Number(r.latitude) : NaN;
        const lon = r.longitude ? Number(r.longitude) : NaN;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const key = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
        return { key, lat, lon };
      })
      .filter(Boolean) as { key: string; lat: number; lon: number }[];
    const unique = Array.from(new Map(pts.map((p) => [p.key, p])).values()).filter((p) => stationByKey[p.key] === undefined);
    if (!unique.length) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        unique.map(async (p) => {
          try {
            const res = await api<{ label: string | null }>(
              `/fuel-reports/nearest-station?lat=${encodeURIComponent(String(p.lat))}&lon=${encodeURIComponent(String(p.lon))}`,
            );
            const lbl = res.label?.trim() ? res.label.trim() : null;
            return [p.key, lbl] as const;
          } catch {
            return [p.key, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setStationByKey((prev) => {
        const next = { ...prev };
        for (const [k, v] of entries) next[k] = v;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, stationByKey]);

  const m3Fmt = useMemo(() => {
    return new Intl.NumberFormat(intlLocaleFor(lang), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [lang]);

  const literFmt = useMemo(() => {
    return new Intl.NumberFormat(intlLocaleFor(lang), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [lang]);

  const moneyFmt = useMemo(() => {
    return new Intl.NumberFormat(intlLocaleFor(lang), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, [lang]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const lat = r.latitude ? Number(r.latitude) : NaN;
      const lon = r.longitude ? Number(r.longitude) : NaN;
      const key =
        Number.isFinite(lat) && Number.isFinite(lon)
          ? `${lat.toFixed(5)}_${lon.toFixed(5)}`
          : '';
      const station = r.stationLabel?.trim() || (key ? stationByKey[key] ?? '' : '');
      const hay = [
        r.vehicle.plateNumber,
        r.driver.fullName,
        r.amount,
        station ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, stationByKey]);

  function isPetrolRow(row: Row): boolean {
    return (row.fuelKind ?? 'GAS').toUpperCase() === 'PETROL';
  }

  function fuelKindLabel(row: Row): string {
    return isPetrolRow(row) ? t('fuelKindPetrol') : t('fuelKindGas');
  }

  function formatUnitPriceUsed(row: Row): string {
    const raw = row.unitPrice?.trim() ?? '';
    const n = raw ? Number(raw) : NaN;
    if (!raw || !Number.isFinite(n) || n <= 0) return '—';
    return moneyFmt.format(n);
  }

  function formatYmdDisplay(ymd: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return ymd;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!Number.isFinite(d.getTime())) return ymd;
    return new Intl.DateTimeFormat(intlLocaleFor(lang), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  }

  function stationLabelForRow(r: Row): string {
    const saved = r.stationLabel?.trim();
    if (saved) return saved;
    const lat = r.latitude ? Number(r.latitude) : NaN;
    const lon = r.longitude ? Number(r.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    const key = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
    const lbl = stationByKey[key];
    if (lbl === undefined || !lbl) return t('fuelStationUnknown');
    return lbl;
  }

  const displayRows = useMemo(() => {
    if (stationLegendFilter === null) return filteredRows;
    const unk = t('fuelStationUnknown');
    if (stationLegendFilter === STATION_LEGEND_UNKNOWN) {
      return filteredRows.filter((r) => stationLabelForRow(r) === unk);
    }
    const station = savedFuelStations.find((s) => s.id === stationLegendFilter);
    if (!station) return filteredRows;
    return filteredRows.filter((r) =>
      rowMatchesSavedStationLegend(r, station, stationLabelForRow(r), unk),
    );
  }, [filteredRows, stationLegendFilter, savedFuelStations, stationByKey, t]);

  /** Faqat xaritada saqlangan zapravkalar — yozuvlardagi eski nomlar legendga qo‘shilmaydi (o‘chirishdan keyin chopqib qolmaydi). */
  const legendStations = useMemo(
    () =>
      savedFuelStations
        .filter((s) => s.name.trim())
        .map((s) => ({ id: s.id, name: s.name.trim() })),
    [savedFuelStations],
  );

  const stationPaletteLookup = useMemo(
    () => buildStationPaletteLookup(savedFuelStations),
    [savedFuelStations],
  );

  function stationPaletteIndexForRow(r: Row): number | null {
    const lbl = stationLabelForRow(r);
    if (!lbl || lbl === t('fuelStationUnknown')) return null;
    return resolveStationPaletteIndex(lbl, stationPaletteLookup);
  }

  function rawVolumeForExport(row: Row): string {
    if (row.volume != null && row.volume !== '') {
      const v = Number(row.volume);
      if (Number.isFinite(v) && v > 0) return String(v);
    }
    const a = Number(String(row.amount).replace(/[^\d.]/g, ''));
    const p = row.unitPrice ? Number(row.unitPrice) : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(p) || p <= 0) return '';
    const v = a / p;
    return Number.isFinite(v) && v > 0 ? String(v) : '';
  }

  function handleExportExcel() {
    if (!rows.length) return;
    const fromYmd = ymdFromDatetimeLocal(dateFromValue);
    const toYmd = ymdFromDatetimeLocal(dateToValue);
    if (!fromYmd || !toYmd) return;

    const headers = [
      t('plate'),
      t('fullName'),
      t('amount'),
      t('colFuelKind'),
      t('colUnitPriceUsed'),
      t('colVolume'),
      t('colTime'),
      t('colLocation'),
      t('colFuelStation'),
      t('colVehiclePhoto'),
      t('colReceipt'),
    ];

    const data = rows.map((r) => {
      const lat = r.latitude ? Number(r.latitude) : NaN;
      const lon = r.longitude ? Number(r.longitude) : NaN;
      const location =
        Number.isFinite(lat) && Number.isFinite(lon) ? `${lat}, ${lon}` : '';
      return {
        plate: r.vehicle.plateNumber,
        driver: r.driver.fullName,
        amount: r.amount,
        fuelKind: fuelKindLabel(r),
        unitPrice: r.unitPrice?.trim() ?? '',
        volume: rawVolumeForExport(r),
        createdAt: formatDateTimeNoSeconds(r.createdAt),
        location,
        station: stationLabelForRow(r),
        stationPaletteIndex: stationPaletteIndexForRow(r),
        vehiclePhotoUrl: r.vehiclePhotoUrl ? apiUrl(r.vehiclePhotoUrl) : '',
        receiptPhotoUrl: r.receiptPhotoUrl ? apiUrl(r.receiptPhotoUrl) : '',
      };
    });

    const lo = fromYmd <= toYmd ? fromYmd : toYmd;
    const hi = fromYmd <= toYmd ? toYmd : fromYmd;
    const count = downloadFuelReportsExcel(headers, data, fromYmd, toYmd, {
      period: t('fuelExportSheetPeriod'),
      rowCount: t('fuelExportSheetRowCount'),
    });
    if (count <= 0) return;

    const meta: FuelExportMeta = {
      exportedAt: new Date().toISOString(),
      fromYmd: lo,
      toYmd: hi,
      rowCount: count,
    };
    saveFuelExportMeta(meta);
    setExportMeta(meta);
  }

  const exportMetaLabel = useMemo(() => {
    if (!exportMeta) return t('fuelExportNever');
    const at = new Intl.DateTimeFormat(intlLocaleFor(lang), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(exportMeta.exportedAt));
    return t('fuelExportLast', {
      at,
      from: formatYmdDisplay(exportMeta.fromYmd),
      to: formatYmdDisplay(exportMeta.toYmd),
      n: String(exportMeta.rowCount),
    });
  }, [exportMeta, lang, t]);

  function formatReportVolume(row: Row): string {
    if (row.volume != null && row.volume !== '') {
      const v = Number(row.volume);
      if (Number.isFinite(v) && v > 0) {
        return isPetrolRow(row) ? `${literFmt.format(v)} L` : `${m3Fmt.format(v)} m³`;
      }
    }
    const a = Number(String(row.amount).replace(/[^\d.]/g, ''));
    const p = row.unitPrice ? Number(row.unitPrice) : NaN;
    if (!Number.isFinite(a) || !Number.isFinite(p) || p <= 0) return '—';
    const v = a / p;
    if (!Number.isFinite(v) || v <= 0) return '—';
    return isPetrolRow(row) ? `${literFmt.format(v)} L` : `${m3Fmt.format(v)} m³`;
  }

  async function saveGlobalGasPriceForAllVehicles() {
    const raw = globalGasPrice.trim();
    const n = raw === '' ? NaN : Number(raw);
    if (raw !== '' && (!Number.isFinite(n) || n < 0)) return;
    if (!allVehicles.length) return;

    setGlobalGasSaving(true);
    setGasSaveErr(null);
    setGasSaveOk(false);
    try {
      const value = raw === '' ? null : n;
      await Promise.all(
        allVehicles.map((v) =>
          api(`/vehicles/${v.id}/gas-price`, {
            method: 'PATCH',
            body: JSON.stringify({ gasPricePerM3: value }),
          }),
        ),
      );

      const s = raw === '' ? '' : String(n);
      setAllVehicles((prev) => prev.map((v) => ({ ...v, gasPricePerM3: raw === '' ? null : s })));
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          vehicle: { ...r.vehicle, gasPricePerM3: raw === '' ? null : s },
        })),
      );
      setGasSaveOk(true);
      try {
        if (raw === '') localStorage.removeItem(FLEET_GAS_PRICE_LS_KEY);
        else localStorage.setItem(FLEET_GAS_PRICE_LS_KEY, String(n));
      } catch {
        /* ignore */
      }
      if (gasSaveOkTimerRef.current != null) window.clearTimeout(gasSaveOkTimerRef.current);
      gasSaveOkTimerRef.current = window.setTimeout(() => setGasSaveOk(false), 2000);
    } catch (e: unknown) {
      setGasSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGlobalGasSaving(false);
    }
  }

  async function saveGlobalPetrolPriceForAllVehicles() {
    const raw = globalPetrolPrice.trim();
    const n = raw === '' ? NaN : Number(raw);
    if (raw !== '' && (!Number.isFinite(n) || n < 0)) return;
    if (!allVehicles.length) return;

    setGlobalPetrolSaving(true);
    setPetrolSaveErr(null);
    setPetrolSaveOk(false);
    try {
      const value = raw === '' ? null : n;
      await Promise.all(
        allVehicles.map((v) =>
          api(`/vehicles/${v.id}/petrol-price`, {
            method: 'PATCH',
            body: JSON.stringify({ petrolPricePerLiter: value }),
          }),
        ),
      );

      const s = raw === '' ? '' : String(n);
      setAllVehicles((prev) => prev.map((v) => ({ ...v, petrolPricePerLiter: raw === '' ? null : s })));
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          vehicle: { ...r.vehicle, petrolPricePerLiter: raw === '' ? null : s },
        })),
      );
      setPetrolSaveOk(true);
      try {
        if (raw === '') localStorage.removeItem(FLEET_PETROL_PRICE_LS_KEY);
        else localStorage.setItem(FLEET_PETROL_PRICE_LS_KEY, String(n));
      } catch {
        /* ignore */
      }
      if (petrolSaveOkTimerRef.current != null) window.clearTimeout(petrolSaveOkTimerRef.current);
      petrolSaveOkTimerRef.current = window.setTimeout(() => setPetrolSaveOk(false), 2000);
    } catch (e: unknown) {
      setPetrolSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setGlobalPetrolSaving(false);
    }
  }

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
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="app-page-title">{t('fuelSubNavTable')}</h1>
        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-stretch sm:justify-end sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:w-[260px] sm:flex-initial">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('oilSearchLabel')}
            </span>
            <input
              type="search"
              className="app-input w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('oilSearchPlaceholder')}
              aria-label={t('oilSearchLabel')}
            />
          </div>
          <div className="flex min-w-0 w-full flex-col gap-1 sm:min-w-[280px] sm:max-w-[min(100vw-2rem,22rem)]">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{t('dailyKmTableDateRange')}</span>
            <div className="w-full min-w-0">
              <DatetimeLocalRangeField
                fromValue={dateFromValue}
                toValue={dateToValue}
                onFromChange={setDateFromValue}
                onToChange={setDateToValue}
                disabled={{ after: new Date() }}
                align="right"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {(['ALL', 'GAS', 'PETROL'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={clsx(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                fuelKindFilter === k
                  ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
              )}
              onClick={() => setFuelKindFilter(k)}
            >
              {k === 'ALL' ? t('fuelKindAll') : k === 'GAS' ? t('fuelKindGas') : t('fuelKindPetrol')}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
          <p className="text-xs text-slate-500 dark:text-slate-400">{exportMetaLabel}</p>
          <button
            type="button"
            className="app-btn-ghost shrink-0"
            disabled={!rows.length}
            title={!rows.length ? t('fuelExportNoRows') : undefined}
            onClick={handleExportExcel}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            {t('fuelExportExcel')}
          </button>
        </div>
      </div>

      <div className="app-card-pad min-w-0">
        <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
          <div className="flex min-w-0 flex-col gap-2 sm:border-r sm:border-slate-200 sm:pr-8 dark:sm:border-slate-700">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('gasPriceAllTitle')}</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('gasPriceAllHint')}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('gasPricePerM3')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="app-input w-full text-right tabular-nums"
                  value={globalGasPrice}
                  onChange={(e) => setGlobalGasPrice(e.target.value)}
                  placeholder="—"
                />
              </div>
              <button
                type="button"
                className="app-btn-primary w-full shrink-0 sm:w-auto"
                disabled={globalGasSaving || !allVehicles.length}
                onClick={() => void saveGlobalGasPriceForAllVehicles()}
              >
                {globalGasSaving ? '…' : t('gasPriceAllSave')}
              </button>
            </div>
            {gasSaveErr && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t('genericError')}: {gasSaveErr}
              </p>
            )}
            {gasSaveOk && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{t('credentialsSaved')}</p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('petrolPriceAllTitle')}</div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('petrolPriceAllHint')}</p>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{t('petrolPricePerLiter')}</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="app-input w-full text-right tabular-nums"
                  value={globalPetrolPrice}
                  onChange={(e) => setGlobalPetrolPrice(e.target.value)}
                  placeholder="—"
                />
              </div>
              <button
                type="button"
                className="app-btn-primary w-full shrink-0 sm:w-auto"
                disabled={globalPetrolSaving || !allVehicles.length}
                onClick={() => void saveGlobalPetrolPriceForAllVehicles()}
              >
                {globalPetrolSaving ? '…' : t('petrolPriceAllSave')}
              </button>
            </div>
            {petrolSaveErr && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {t('genericError')}: {petrolSaveErr}
              </p>
            )}
            {petrolSaveOk && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{t('credentialsSaved')}</p>
            )}
          </div>
        </div>
      </div>

      {vehiclesErr && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {t('genericError')}: {vehiclesErr}
        </div>
      )}

      <div className="app-card min-w-0 overflow-hidden">
        {legendStations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
            {legendStations.map((s) => {
              const idx = resolveStationPaletteIndex(s.name, stationPaletteLookup);
              const selected = stationLegendFilter === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  title={t('fuelLegendFilterChipTitle')}
                  aria-pressed={selected}
                  onClick={() =>
                    setStationLegendFilter((prev) => (prev === s.id ? null : s.id))
                  }
                  className={clsx(
                    'rounded-md px-2 py-0.5 text-left text-xs transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                    selected && 'ring-2 ring-blue-700 ring-offset-2 dark:ring-blue-400 dark:ring-offset-slate-950',
                    fuelStationRowClass(idx),
                    fuelStationNameClass(idx),
                  )}
                >
                  {s.name}
                </button>
              );
            })}
            <button
              type="button"
              title={t('fuelLegendFilterChipTitle')}
              aria-pressed={stationLegendFilter === STATION_LEGEND_UNKNOWN}
              onClick={() =>
                setStationLegendFilter((prev) =>
                  prev === STATION_LEGEND_UNKNOWN ? null : STATION_LEGEND_UNKNOWN,
                )
              }
              className={clsx(
                'text-xs transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:text-slate-400 dark:focus-visible:ring-offset-slate-900',
                stationLegendFilter === STATION_LEGEND_UNKNOWN &&
                  'rounded-md px-2 py-0.5 ring-2 ring-slate-600 ring-offset-2 dark:ring-slate-400 dark:ring-offset-slate-950',
              )}
            >
              {t('fuelStationUnknown')}
            </button>
          </div>
        )}
        <div className="app-table-wrap">
          <table className="app-table-inner text-sm">
          <thead className="app-table-head">
            <tr>
              <th className="p-3">{t('plate')}</th>
              <th className="p-3">{t('fullName')}</th>
              <th className="p-3">{t('amount')}</th>
              <th className="p-3">{t('colFuelKind')}</th>
              <th className="p-3">{t('colUnitPriceUsed')}</th>
              <th className="p-3">{t('colVolume')}</th>
              <th className="p-3">{t('colTime')}</th>
              <th className="p-3">{t('colLocation')}</th>
              <th className="p-3">{t('colFuelStation')}</th>
              <th className="p-3">{t('colVehiclePhoto')}</th>
              <th className="p-3">{t('colReceipt')}</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={12}>
                  {search.trim()
                    ? t('oilSearchNoResults')
                    : stationLegendFilter !== null
                      ? t('fuelLegendFilterEmpty')
                      : '—'}
                </td>
              </tr>
            )}
            {displayRows.map((r) => {
              const stationIdx = stationPaletteIndexForRow(r);
              return (
              <tr key={r.id} className={clsx('app-table-row', fuelStationRowClass(stationIdx))}>
                <td className="p-3 font-mono">{r.vehicle.plateNumber}</td>
                <td className="p-3">{r.driver.fullName}</td>
                <td className="p-3">{r.amount}</td>
                <td className="p-3">{fuelKindLabel(r)}</td>
                <td className="p-3 tabular-nums">{formatUnitPriceUsed(r)}</td>
                <td className="p-3 tabular-nums">{formatReportVolume(r)}</td>
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
                  {r.latitude && r.longitude ? (
                    (() => {
                      const lat = Number(r.latitude);
                      const lon = Number(r.longitude);
                      const key = `${lat.toFixed(5)}_${lon.toFixed(5)}`;
                      const savedLbl = r.stationLabel?.trim() || null;
                      const lbl = savedLbl ?? stationByKey[key];
                      if (lbl === undefined) {
                        return <span className="text-slate-500 dark:text-slate-400">…</span>;
                      }
                      if (!lbl) {
                        return <span className="text-slate-500 dark:text-slate-400">{t('fuelStationUnknown')}</span>;
                      }
                      return <span className={fuelStationNameClass(stationIdx)}>{lbl}</span>;
                    })()
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
            );
            })}
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
              <MapContainer center={mapCenter} zoom={15} maxZoom={LEAFLET_MAP_MAX_ZOOM} className="h-full w-full" scrollWheelZoom>
                <MapBaseLayers />
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
