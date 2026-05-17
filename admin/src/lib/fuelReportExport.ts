import * as XLSX from 'xlsx-js-style';
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
  location: string;
  station: string;
  vehiclePhotoUrl: string;
  receiptPhotoUrl: string;
  /** Jadvaldagi zapravka rang indeksi */
  stationPaletteIndex?: number | null;
};

type CellStyle = {
  fill?: { patternType: 'solid'; fgColor: { rgb: string } };
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number };
  alignment?: { horizontal?: 'center' | 'left' | 'right'; vertical?: 'center' };
  border?: {
    top?: { style: 'thin'; color: { rgb: string } };
    bottom?: { style: 'thin' | 'medium'; color: { rgb: string } };
    left?: { style: 'thin'; color: { rgb: string } };
    right?: { style: 'thin'; color: { rgb: string } };
  };
};

const FILL_HEADER = 'F1F5F9';
const FILL_META = 'F8FAFC';
const FILL_DEFAULT = 'FFFFFF';
const FILL_GAS = 'F0F9FF';
const FILL_PETROL = 'FFF7ED';
const BORDER = 'CBD5E1';

const COL_STATION = 8;
const COL_FUEL_KIND = 3;

function setCell(ws: XLSX.WorkSheet, r: number, c: number, style: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return;
  cell.s = style;
}

function baseCell(extra?: CellStyle): CellStyle {
  return {
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: BORDER } },
      bottom: { style: 'thin', color: { rgb: BORDER } },
      left: { style: 'thin', color: { rgb: BORDER } },
      right: { style: 'thin', color: { rgb: BORDER } },
    },
    ...extra,
  };
}

function applyFuelJournalSheetStyles(
  ws: XLSX.WorkSheet,
  data: FuelExportRow[],
  colCount: number,
) {
  const META_ROWS = 2;
  const HEADER_ROW = META_ROWS + 1;
  const DATA_START = HEADER_ROW + 1;

  const metaStyle: CellStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: FILL_META } },
    font: { sz: 11 },
    alignment: { vertical: 'center' },
  };
  for (let r = 0; r < META_ROWS; r += 1) {
    setCell(ws, r, 0, metaStyle);
    if (colCount > 1) setCell(ws, r, 1, metaStyle);
  }

  const headerStyle: CellStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: FILL_HEADER } },
    font: { bold: true, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: BORDER } },
      bottom: { style: 'medium', color: { rgb: '94A3B8' } },
      left: { style: 'thin', color: { rgb: BORDER } },
      right: { style: 'thin', color: { rgb: BORDER } },
    },
  };
  for (let c = 0; c < colCount; c += 1) {
    setCell(ws, HEADER_ROW, c, {
      ...headerStyle,
      alignment: {
        horizontal: c <= 1 ? 'left' : 'center',
        vertical: 'center',
      },
    });
  }

  data.forEach((row, i) => {
    const r = DATA_START + i;
    const palette = excelColorsForStationPalette(row.stationPaletteIndex ?? null);
    const rowFill = palette?.fill ?? FILL_DEFAULT;
    const stationFont = palette?.font ?? '334155';
    const kindUpper = row.fuelKind.toUpperCase();
    const kindFill =
      kindUpper.includes('GAS') || kindUpper.includes('ГАЗ')
        ? FILL_GAS
        : kindUpper.includes('PETROL') ||
            kindUpper.includes('БЕНЗ') ||
            kindUpper.includes('BENZ')
          ? FILL_PETROL
          : rowFill;

    for (let c = 0; c < colCount; c += 1) {
      const isStation = c === COL_STATION;
      const isKind = c === COL_FUEL_KIND;
      const fill = isKind ? kindFill : rowFill;
      setCell(
        ws,
        r,
        c,
        baseCell({
          fill: { patternType: 'solid', fgColor: { rgb: fill } },
          font: {
            bold: isStation,
            color: { rgb: isStation ? stationFont : '0F172A' },
            sz: 11,
          },
          alignment: {
            horizontal: c <= 1 || c >= colCount - 2 ? 'left' : 'center',
            vertical: 'center',
          },
        }),
      );
    }
  });

  ws['!cols'] = [
    { wch: 11 },
    { wch: 22 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 18 },
    { wch: 22 },
    { wch: 28 },
    { wch: 36 },
    { wch: 36 },
  ];

  if (data.length > 0) {
    ws['!freeze'] = {
      xSplit: 0,
      ySplit: DATA_START,
      topLeftCell: `A${DATA_START + 1}`,
      activePane: 'bottomRight',
    };
  }
}

export type FuelJournalExportLabels = {
  period: string;
  rowCount: string;
};

export function downloadFuelReportsExcel(
  headers: string[],
  data: FuelExportRow[],
  fromYmd: string,
  toYmd: string,
  sheetLabels?: FuelJournalExportLabels,
): number {
  if (!data.length) return 0;

  const lo = fromYmd <= toYmd ? fromYmd : toYmd;
  const hi = fromYmd <= toYmd ? toYmd : fromYmd;
  const periodLabel = sheetLabels?.period ?? 'Давр';
  const countLabel = sheetLabels?.rowCount ?? 'Ёзувлар';

  const aoa: (string | number)[][] = [
    [periodLabel, `${lo} — ${hi}`],
    [countLabel, data.length],
    [],
    headers,
    ...data.map((r) => [
      r.plate,
      r.driver,
      r.amount,
      r.fuelKind,
      r.unitPrice,
      r.volume,
      r.createdAt,
      r.location,
      r.station,
      r.vehiclePhotoUrl,
      r.receiptPhotoUrl,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  applyFuelJournalSheetStyles(ws, data, headers.length);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Zapravkalar');
  XLSX.writeFile(wb, `zapravkalar_${lo}_${hi}.xlsx`);

  return data.length;
}
