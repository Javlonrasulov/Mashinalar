import * as XLSX from 'xlsx-js-style';
import { computeFuelReportGrandTotals } from '@/lib/fuelReportGrandTotals';

export type FuelReportExportGrid = {
  savedStation: { id: string; name: string };
  year: number;
  month: number;
  daysInMonth: number;
  vehicles: {
    plateNumber: string;
    systemM3ByDay: (number | null)[];
    actualM3ByDay: (number | null)[];
    diffM3ByDay?: (number | null)[];
  }[];
};

export type FuelReportExportLabels = {
  plate: string;
  source: string;
  rowEmployees: string;
  rowVendor: string;
  rowDiff: string;
  rowGrandPlate: string;
  rowGrandSystem: string;
  rowGrandVendor: string;
  total: string;
  stationTitle: string;
  metaRow: string;
  savedAt?: string;
};

type CellStyle = {
  fill?: { patternType: 'solid'; fgColor: { rgb: string } };
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number };
  alignment?: { horizontal?: 'center' | 'left' | 'right'; vertical?: 'center' };
  border?: {
    top?: { style: 'thin' | 'medium'; color: { rgb: string } };
    bottom?: { style: 'thin' | 'medium'; color: { rgb: string } };
    left?: { style: 'thin' | 'medium'; color: { rgb: string } };
    right?: { style: 'thin' | 'medium'; color: { rgb: string } };
  };
};

const FILL_HEADER = 'F1F5F9';
const FILL_TOTAL_COL = 'FEF3C7';
const FILL_TOTAL_HEADER = 'FDE68A';
const FILL_VENDOR_ROW = 'F0F9FF';
const FILL_META = 'F8FAFC';
const FILL_GRAND = 'E2E8F0';
const FILL_GRAND_VENDOR = 'DBEAFE';
const BORDER = 'CBD5E1';
const BORDER_BLOCK = '94A3B8';

function fmtCell(n: number | null | undefined): number | string {
  if (n == null || !Number.isFinite(n)) return '';
  const r = Math.round(n * 100) / 100;
  return r;
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

function hasAnyActual(values: (number | null)[]): boolean {
  return values.some((x) => x != null && Number.isFinite(x));
}

function diffCellStyle(diff: number | null): CellStyle | null {
  if (diff == null || !Number.isFinite(diff)) return null;
  const a = Math.abs(diff);
  if (a <= 0.35) {
    return {
      fill: { patternType: 'solid', fgColor: { rgb: 'A7F3D0' } },
      font: { bold: true, color: { rgb: '064E3B' } },
    };
  }
  if (a <= 1.2) {
    return {
      fill: { patternType: 'solid', fgColor: { rgb: 'D9F99D' } },
      font: { bold: true, color: { rgb: '365314' } },
    };
  }
  if (a <= 3) {
    return {
      fill: { patternType: 'solid', fgColor: { rgb: 'FCD34D' } },
      font: { bold: true, color: { rgb: '78350F' } },
    };
  }
  /* > 3 m³ — UI dagi qizil (red-400/600) */
  return {
    fill: { patternType: 'solid', fgColor: { rgb: 'EF4444' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  };
}

function baseDataStyle(extra?: CellStyle): CellStyle {
  return {
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: BORDER } },
      bottom: { style: 'thin', color: { rgb: BORDER } },
      left: { style: 'thin', color: { rgb: BORDER } },
      right: { style: 'thin', color: { rgb: BORDER } },
    },
    ...extra,
  };
}

function totalColStyle(extra?: CellStyle): CellStyle {
  return baseDataStyle({
    fill: { patternType: 'solid', fgColor: { rgb: FILL_TOTAL_COL } },
    font: { bold: true },
    ...extra,
  });
}

function setCell(ws: XLSX.WorkSheet, r: number, c: number, style: CellStyle) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return;
  cell.s = style;
}

function metaRowCount(savedAtIso?: string, labels?: FuelReportExportLabels): number {
  let n = 2;
  if (labels?.savedAt && savedAtIso) n += 1;
  return n + 2;
}

function applyFuelReportSheetStyles(
  ws: XLSX.WorkSheet,
  grid: FuelReportExportGrid,
  savedAtIso?: string,
  labels?: FuelReportExportLabels,
) {
  const days = grid.daysInMonth;
  const totalCol = 2 + days;
  const lastCol = totalCol;
  const headerRow = metaRowCount(savedAtIso, labels) - 1;
  const dataStart = headerRow + 1;

  const metaStyle: CellStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: FILL_META } },
    font: { sz: 11 },
    alignment: { vertical: 'center' },
  };
  for (let r = 0; r < headerRow; r += 1) {
    setCell(ws, r, 0, metaStyle);
    setCell(ws, r, 1, metaStyle);
  }

  const headerStyle: CellStyle = {
    fill: { patternType: 'solid', fgColor: { rgb: FILL_HEADER } },
    font: { bold: true, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: BORDER } },
      bottom: { style: 'medium', color: { rgb: BORDER_BLOCK } },
      left: { style: 'thin', color: { rgb: BORDER } },
      right: { style: 'thin', color: { rgb: BORDER } },
    },
  };
  const headerTotalStyle: CellStyle = {
    ...headerStyle,
    fill: { patternType: 'solid', fgColor: { rgb: FILL_TOTAL_HEADER } },
  };
  for (let c = 0; c <= lastCol; c += 1) {
    setCell(ws, headerRow, c, c === totalCol ? headerTotalStyle : headerStyle);
  }
  setCell(ws, headerRow, 0, { ...headerStyle, alignment: { horizontal: 'left', vertical: 'center' } });
  setCell(ws, headerRow, 1, { ...headerStyle, alignment: { horizontal: 'left', vertical: 'center' } });

  grid.vehicles.forEach((v, vi) => {
    const sysRow = dataStart + vi * 2;
    const venRow = sysRow + 1;
    const tSys = sumNums(v.systemM3ByDay);
    const tAct = sumNums(v.actualM3ByDay);
    const actEntered = hasAnyActual(v.actualM3ByDay);
    const tDiff =
      actEntered && (tSys != null || tAct != null)
        ? Math.round(((tSys ?? 0) - (tAct ?? 0)) * 100) / 100
        : null;

    const plateStyle = baseDataStyle({
      font: { bold: true },
      alignment: { horizontal: 'left', vertical: 'center' },
    });
    setCell(ws, sysRow, 0, plateStyle);
    setCell(ws, venRow, 0, plateStyle);

    setCell(ws, sysRow, 1, baseDataStyle({ alignment: { horizontal: 'left', vertical: 'center' } }));
    setCell(
      ws,
      venRow,
      1,
      baseDataStyle({
        fill: { patternType: 'solid', fgColor: { rgb: FILL_VENDOR_ROW } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }),
    );

    for (let d = 0; d < days; d += 1) {
      const c = 2 + d;
      setCell(ws, sysRow, c, baseDataStyle());
      setCell(
        ws,
        venRow,
        c,
        baseDataStyle({
          fill: { patternType: 'solid', fgColor: { rgb: FILL_VENDOR_ROW } },
        }),
      );
    }

    setCell(ws, sysRow, totalCol, totalColStyle());
    const venTotalBorder: CellStyle['border'] = {
      top: { style: 'thin', color: { rgb: BORDER } },
      bottom: { style: 'medium', color: { rgb: BORDER_BLOCK } },
      left: { style: 'thin', color: { rgb: BORDER } },
      right: { style: 'thin', color: { rgb: BORDER } },
    };
    if (actEntered) {
      const diffStyle = diffCellStyle(tDiff);
      setCell(ws, venRow, totalCol, {
        ...(diffStyle ?? totalColStyle()),
        alignment: { horizontal: 'center', vertical: 'center' },
        border: venTotalBorder,
      });
    } else {
      setCell(
        ws,
        venRow,
        totalCol,
        totalColStyle({
          fill: { patternType: 'solid', fgColor: { rgb: FILL_VENDOR_ROW } },
        }),
      );
    }

    for (let c = 0; c <= lastCol; c += 1) {
      const borderBottom: CellStyle['border'] = {
        top: { style: 'thin', color: { rgb: BORDER } },
        bottom: { style: 'medium', color: { rgb: BORDER_BLOCK } },
        left: { style: 'thin', color: { rgb: BORDER } },
        right: { style: 'thin', color: { rgb: BORDER } },
      };
      const cell = ws[XLSX.utils.encode_cell({ r: venRow, c })];
      if (cell?.s && typeof cell.s === 'object') {
        cell.s = { ...(cell.s as CellStyle), border: borderBottom };
      }
    }
  });

  const vehicleRows = grid.vehicles.length * 2;
  const grandSysRow = dataStart + vehicleRows;
  const grandVenRow = grandSysRow + 1;
  const grand = computeFuelReportGrandTotals(grid.daysInMonth, grid.vehicles);

  const grandPlateStyle = baseDataStyle({
    fill: { patternType: 'solid', fgColor: { rgb: FILL_GRAND } },
    font: { bold: true, sz: 11 },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  const grandLabelStyle = baseDataStyle({
    fill: { patternType: 'solid', fgColor: { rgb: FILL_GRAND } },
    font: { bold: true, sz: 11 },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  const grandVenLabelStyle = baseDataStyle({
    fill: { patternType: 'solid', fgColor: { rgb: FILL_GRAND_VENDOR } },
    font: { bold: true, sz: 11 },
    alignment: { horizontal: 'left', vertical: 'center' },
  });
  const grandCellStyle = baseDataStyle({
    fill: { patternType: 'solid', fgColor: { rgb: FILL_GRAND } },
    font: { bold: true, sz: 11 },
  });
  const grandVenCellStyle = baseDataStyle({
    fill: { patternType: 'solid', fgColor: { rgb: FILL_GRAND_VENDOR } },
    font: { bold: true, sz: 11 },
  });

  setCell(ws, grandSysRow, 0, grandPlateStyle);
  setCell(ws, grandVenRow, 0, grandPlateStyle);
  setCell(ws, grandSysRow, 1, grandLabelStyle);
  setCell(ws, grandVenRow, 1, grandVenLabelStyle);

  for (let d = 0; d < days; d += 1) {
    const c = 2 + d;
    setCell(ws, grandSysRow, c, grandCellStyle);
    setCell(ws, grandVenRow, c, grandVenCellStyle);
  }

  setCell(ws, grandSysRow, totalCol, totalColStyle({ font: { bold: true, sz: 11 } }));

  const grandBorder: CellStyle['border'] = {
    top: { style: 'medium', color: { rgb: BORDER_BLOCK } },
    bottom: { style: 'medium', color: { rgb: BORDER_BLOCK } },
    left: { style: 'thin', color: { rgb: BORDER } },
    right: { style: 'thin', color: { rgb: BORDER } },
  };
  if (grand.anyVendorEntered) {
    const diffStyle = diffCellStyle(grand.totalDiff);
    setCell(ws, grandVenRow, totalCol, {
      ...(diffStyle ?? totalColStyle({ font: { bold: true, sz: 11 } })),
      alignment: { horizontal: 'center', vertical: 'center' },
      border: grandBorder,
    });
  } else {
    setCell(
      ws,
      grandVenRow,
      totalCol,
      totalColStyle({
        fill: { patternType: 'solid', fgColor: { rgb: FILL_GRAND_VENDOR } },
        font: { bold: true, sz: 11 },
      }),
    );
  }

  for (let c = 0; c <= lastCol; c += 1) {
    const cell = ws[XLSX.utils.encode_cell({ r: grandVenRow, c })];
    if (cell?.s && typeof cell.s === 'object') {
      cell.s = { ...(cell.s as CellStyle), border: grandBorder };
    }
  }

  ws['!cols'] = [
    { wch: 11 },
    { wch: 16 },
    ...Array.from({ length: days }, () => ({ wch: 5 })),
    { wch: 9 },
  ];

  const lastDataRow = dataStart + grid.vehicles.length * 2 - 1;
  if (lastDataRow >= dataStart) {
    ws['!freeze'] = { xSplit: 2, ySplit: headerRow + 1, topLeftCell: 'C2', activePane: 'bottomRight' };
  }
}

/** Excel fayl nomidan хавфли белгиларни олиб ташлайди */
export function safeExcelFileBase(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'hisobot';
}

function sheetNameFromIso(createdAt: string, index: number): string {
  const d = new Date(createdAt);
  const base = Number.isFinite(d.getTime())
    ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`
    : `v${index + 1}`;
  return base.slice(0, 31);
}

function buildSheetRows(
  grid: FuelReportExportGrid,
  labels: FuelReportExportLabels,
  savedAtIso?: string,
): (string | number)[][] {
  const days = Array.from({ length: grid.daysInMonth }, (_, i) => i + 1);
  const head: (string | number)[] = [
    labels.plate,
    labels.source,
    ...days.map((d) => d),
    labels.total,
  ];

  const meta: (string | number)[][] = [
    [labels.stationTitle, grid.savedStation.name || '—'],
    [labels.metaRow, `${grid.year}-${String(grid.month).padStart(2, '0')}`],
  ];
  if (labels.savedAt && savedAtIso) {
    const d = new Date(savedAtIso);
    const when = Number.isFinite(d.getTime()) ? d.toLocaleString() : savedAtIso;
    meta.push([labels.savedAt, when]);
  }
  meta.push([]);
  meta.push(head);

  const rows: (string | number)[][] = [...meta];

  for (const v of grid.vehicles) {
    const tSys = sumNums(v.systemM3ByDay);
    const tAct = sumNums(v.actualM3ByDay);
    const actEntered = hasAnyActual(v.actualM3ByDay);
    const tDiff =
      actEntered && (tSys != null || tAct != null)
        ? Math.round(((tSys ?? 0) - (tAct ?? 0)) * 100) / 100
        : null;

    rows.push([
      v.plateNumber,
      labels.rowEmployees,
      ...days.map((d) => fmtCell(v.systemM3ByDay[d - 1])),
      fmtCell(tSys),
    ]);
    rows.push([
      v.plateNumber,
      labels.rowVendor,
      ...days.map((d) => fmtCell(v.actualM3ByDay[d - 1])),
      actEntered ? fmtCell(tDiff) : fmtCell(tAct),
    ]);
  }

  const grand = computeFuelReportGrandTotals(grid.daysInMonth, grid.vehicles);
  rows.push([
    labels.rowGrandPlate,
    labels.rowGrandSystem,
    ...days.map((d) => fmtCell(grand.systemByDay[d - 1])),
    fmtCell(grand.totalSystem),
  ]);
  rows.push([
    labels.rowGrandPlate,
    labels.rowGrandVendor,
    ...days.map((d) => fmtCell(grand.vendorByDay[d - 1])),
    grand.anyVendorEntered ? fmtCell(grand.totalDiff) : fmtCell(grand.totalVendor),
  ]);

  return rows;
}

function buildStyledSheet(
  grid: FuelReportExportGrid,
  labels: FuelReportExportLabels,
  savedAtIso?: string,
): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(buildSheetRows(grid, labels, savedAtIso));
  applyFuelReportSheetStyles(ws, grid, savedAtIso, labels);
  return ws;
}

export function snapshotExcelBaseName(
  grid: FuelReportExportGrid,
  createdAt?: string,
  suffix?: string,
): string {
  const stamp = `${grid.year}-${String(grid.month).padStart(2, '0')}`;
  const station = grid.savedStation.name?.trim() || 'zapravka';
  let tail = '';
  if (createdAt) {
    const d = new Date(createdAt);
    if (Number.isFinite(d.getTime())) {
      const p = (n: number) => String(n).padStart(2, '0');
      tail = `_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
    }
  }
  const sfx = suffix ? `_${suffix}` : '';
  return safeExcelFileBase(`vedomost_${station}_${stamp}${tail}${sfx}`);
}

export function downloadFuelReportXlsx(
  grid: FuelReportExportGrid,
  labels: FuelReportExportLabels,
  fileBaseName: string,
  sheetName = 'Hisobot',
  savedAtIso?: string,
) {
  const ws = buildStyledSheet(grid, labels, savedAtIso);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${safeExcelFileBase(fileBaseName)}.xlsx`);
}

/** Бир nechta saqlangan vedomost — har biri alohida varaq */
export function downloadFuelReportSnapshotsWorkbook(
  items: { createdAt: string; grid: FuelReportExportGrid }[],
  labels: FuelReportExportLabels,
  fileBaseName: string,
) {
  if (!items.length) return;
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  items.forEach((item, index) => {
    let sn = sheetNameFromIso(item.createdAt, index);
    let n = 2;
    while (used.has(sn)) {
      sn = `${sheetNameFromIso(item.createdAt, index).slice(0, 28)}_${n}`;
      n += 1;
    }
    used.add(sn);
    const ws = buildStyledSheet(item.grid, labels, item.createdAt);
    XLSX.utils.book_append_sheet(wb, ws, sn);
  });
  XLSX.writeFile(wb, `${safeExcelFileBase(fileBaseName)}.xlsx`);
}
