import ExcelJS from 'exceljs';
import { apiUrl, getToken } from '@/lib/api';
import { excelColorsForStationPalette } from '@/lib/fuelStationRowStyle';

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
  station: string;
  /** API relative path, masalan `/uploads/...jpg` */
  vehiclePhotoPath: string;
  receiptPhotoPath: string;
  stationPaletteIndex?: number | null;
};

export type FuelJournalExportLabels = {
  period: string;
  rowCount: string;
};

type ImagePayload = { base64: string; extension: 'jpeg' | 'png' | 'gif' };

const FILL_HEADER = 'FFF1F5F9';
const FILL_META = 'FFF8FAFC';
const FILL_DEFAULT = 'FFFFFFFF';
const FILL_GAS = 'FFF0F9FF';
const FILL_PETROL = 'FFFFF7ED';
const BORDER = 'FFCBD5E1';

const COL_COUNT = 10;
const COL_STATION = 8;
const COL_FUEL_KIND = 4;
const COL_VEHICLE_PHOTO = 9;
const COL_RECEIPT_PHOTO = 10;

const HEADER_ROW = 4;
const DATA_START_ROW = 5;

const IMAGE_COL_WIDTH = 16;
const IMAGE_ROW_HEIGHT = 62;
const IMAGE_W_PX = 108;
const IMAGE_H_PX = 78;

function argbFill(hex: string): ExcelJS.Fill {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hex.startsWith('FF') ? hex : `FF${hex}` },
  };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = { style: 'thin', color: { argb: BORDER } };
  return { top: side, bottom: side, left: side, right: side };
}

function extensionFrom(path: string, contentType: string): 'jpeg' | 'png' | 'gif' {
  const ct = contentType.toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('gif')) return 'gif';
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.gif')) return 'gif';
  return 'jpeg';
}

async function fetchImageBase64(relativePath: string): Promise<ImagePayload | null> {
  const trimmed = relativePath.trim();
  if (!trimmed) return null;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    const res = await fetch(apiUrl(path), { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    if (!buffer.byteLength) return null;
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return {
      base64: btoa(binary),
      extension: extensionFrom(path, blob.type || res.headers.get('content-type') || ''),
    };
  } catch {
    return null;
  }
}

function styleMetaRow(row: ExcelJS.Row) {
  row.height = 18;
  row.getCell(1).fill = argbFill(FILL_META);
  row.getCell(2).fill = argbFill(FILL_META);
  row.getCell(1).font = { size: 11 };
  row.getCell(2).font = { size: 11 };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 22;
  for (let c = 1; c <= COL_COUNT; c += 1) {
    const cell = row.getCell(c);
    cell.fill = argbFill(FILL_HEADER);
    cell.font = { bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: c <= 2 ? 'left' : 'center' };
    cell.border = thinBorder();
  }
}

function styleDataRow(row: ExcelJS.Row, data: FuelExportRow) {
  row.height = IMAGE_ROW_HEIGHT;
  const palette = excelColorsForStationPalette(data.stationPaletteIndex ?? null);
  const rowFillArgb = palette?.fill ? `FF${palette.fill}` : FILL_DEFAULT;
  const stationFont = palette?.font ?? '334155';
  const kindUpper = data.fuelKind.toUpperCase();
  const kindFill =
    kindUpper.includes('GAS') || kindUpper.includes('ГАЗ')
      ? FILL_GAS
      : kindUpper.includes('PETROL') ||
          kindUpper.includes('БЕНЗ') ||
          kindUpper.includes('BENZ')
        ? FILL_PETROL
        : rowFillArgb;

  for (let c = 1; c <= COL_COUNT; c += 1) {
    const cell = row.getCell(c);
    const isStation = c === COL_STATION;
    const isKind = c === COL_FUEL_KIND;
    const isPhoto = c === COL_VEHICLE_PHOTO || c === COL_RECEIPT_PHOTO;
    cell.fill = argbFill(isKind ? kindFill : rowFillArgb);
    cell.font = {
      bold: isStation,
      size: 11,
      color: { argb: isStation ? `FF${stationFont}` : 'FF0F172A' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: isPhoto || c > 2 ? 'center' : 'left',
      wrapText: c === COL_STATION,
    };
    cell.border = thinBorder();
  }
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadFuelReportsExcel(
  headers: string[],
  data: FuelExportRow[],
  fromYmd: string,
  toYmd: string,
  sheetLabels?: FuelJournalExportLabels,
): Promise<number> {
  if (!data.length) return 0;

  const lo = fromYmd <= toYmd ? fromYmd : toYmd;
  const hi = fromYmd <= toYmd ? toYmd : fromYmd;
  const periodLabel = sheetLabels?.period ?? 'Давр';
  const countLabel = sheetLabels?.rowCount ?? 'Ёзувлар';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Mashinalar';
  const ws = wb.addWorksheet('Zapravkalar', {
    views: [{ state: 'frozen', ySplit: DATA_START_ROW - 1 }],
  });

  ws.getColumn(1).width = 11;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 8;
  ws.getColumn(7).width = 18;
  ws.getColumn(8).width = 28;
  ws.getColumn(COL_VEHICLE_PHOTO).width = IMAGE_COL_WIDTH;
  ws.getColumn(COL_RECEIPT_PHOTO).width = IMAGE_COL_WIDTH;

  const r1 = ws.getRow(1);
  r1.getCell(1).value = periodLabel;
  r1.getCell(2).value = `${lo} — ${hi}`;
  styleMetaRow(r1);

  const r2 = ws.getRow(2);
  r2.getCell(1).value = countLabel;
  r2.getCell(2).value = data.length;
  styleMetaRow(r2);

  const headerRow = ws.getRow(HEADER_ROW);
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h;
  });
  styleHeaderRow(headerRow);

  const imageCache = new Map<string, ImagePayload | null>();

  const loadImage = async (path: string) => {
    const key = path.trim();
    if (!key) return null;
    if (imageCache.has(key)) return imageCache.get(key) ?? null;
    const img = await fetchImageBase64(key);
    imageCache.set(key, img);
    return img;
  };

  for (let i = 0; i < data.length; i += 1) {
    const item = data[i]!;
    const rowNum = DATA_START_ROW + i;
    const row = ws.getRow(rowNum);
    row.values = [
      item.plate,
      item.driver,
      item.amount,
      item.fuelKind,
      item.unitPrice,
      item.volume,
      item.createdAt,
      item.station,
      '',
      '',
    ];
    styleDataRow(row, item);

    const rowIndex0 = rowNum - 1;
    const embed = async (path: string, col: number) => {
      const img = await loadImage(path);
      if (!img) return;
      const imageId = wb.addImage({
        base64: img.base64,
        extension: img.extension,
      });
      ws.addImage(imageId, {
        tl: { col: col - 1 + 0.08, row: rowIndex0 + 0.12 },
        ext: { width: IMAGE_W_PX, height: IMAGE_H_PX },
      });
    };

    await embed(item.vehiclePhotoPath, COL_VEHICLE_PHOTO);
    await embed(item.receiptPhotoPath, COL_RECEIPT_PHOTO);
  }

  const buffer = await wb.xlsx.writeBuffer();
  triggerDownload(buffer, `zapravkalar_${lo}_${hi}.xlsx`);
  return data.length;
}
