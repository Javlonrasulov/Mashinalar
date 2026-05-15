import * as XLSX from 'xlsx';

export type FuelExportMeta = {
  exportedAt: string;
  fromYmd: string;
  toYmd: string;
  rowCount: number;
};

export const FUEL_EXPORT_META_LS_KEY = 'mashinalar.fuelExportMeta';

export function loadFuelExportMeta(): FuelExportMeta | null {
  try {
    const raw = localStorage.getItem(FUEL_EXPORT_META_LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as FuelExportMeta;
    if (!p?.exportedAt || !p?.fromYmd || !p?.toYmd) return null;
    return p;
  } catch {
    return null;
  }
}

export function saveFuelExportMeta(meta: FuelExportMeta): void {
  try {
    localStorage.setItem(FUEL_EXPORT_META_LS_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export function ymdFromDatetimeLocal(value: string): string {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type FuelExportRow = {
  plate: string;
  driver: string;
  amount: string;
  fuelKind: string;
  unitPrice: string;
  volume: string;
  createdAt: string;
  latitude: string;
  longitude: string;
  station: string;
  vehiclePhotoUrl: string;
  receiptPhotoUrl: string;
};

export function downloadFuelReportsExcel(
  headers: string[],
  data: FuelExportRow[],
  fromYmd: string,
  toYmd: string,
): number {
  if (!data.length) return 0;

  const aoa: (string | number)[][] = [
    headers,
    ...data.map((r) => [
      r.plate,
      r.driver,
      r.amount,
      r.fuelKind,
      r.unitPrice,
      r.volume,
      r.createdAt,
      r.latitude,
      r.longitude,
      r.station,
      r.vehiclePhotoUrl,
      r.receiptPhotoUrl,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Zapravkalar');

  const lo = fromYmd <= toYmd ? fromYmd : toYmd;
  const hi = fromYmd <= toYmd ? toYmd : fromYmd;
  XLSX.writeFile(wb, `zapravkalar_${lo}_${hi}.xlsx`);

  return data.length;
}
