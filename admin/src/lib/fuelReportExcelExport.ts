import * as XLSX from 'xlsx';

export type FuelReportExportGrid = {
  savedStation: { id: string; name: string };
  year: number;
  month: number;
  daysInMonth: number;
  vehicles: {
    plateNumber: string;
    systemM3ByDay: (number | null)[];
    actualM3ByDay: (number | null)[];
    diffM3ByDay: (number | null)[];
  }[];
};

export type FuelReportExportLabels = {
  plate: string;
  source: string;
  rowEmployees: string;
  rowVendor: string;
  rowDiff: string;
  total: string;
  stationTitle: string;
  metaRow: string;
};

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

/** Excel fayl nomidan хавфли белгиларни олиб ташлайди */
export function safeExcelFileBase(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'hisobot';
}

export function downloadFuelReportXlsx(
  grid: FuelReportExportGrid,
  labels: FuelReportExportLabels,
  fileBaseName: string,
  sheetName = 'Hisobot',
) {
  const days = Array.from({ length: grid.daysInMonth }, (_, i) => i + 1);
  const head: (string | number)[] = [
    labels.plate,
    labels.source,
    ...days.map((d) => d),
    labels.total,
  ];

  const rows: (string | number)[][] = [
    [labels.stationTitle, grid.savedStation.name || '—'],
    [labels.metaRow, `${grid.year}-${String(grid.month).padStart(2, '0')}`],
    [],
    head,
  ];

  for (const v of grid.vehicles) {
    const tSys = sumNums(v.systemM3ByDay);
    const tAct = sumNums(v.actualM3ByDay);
    const tDiff =
      tSys != null || tAct != null
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
      fmtCell(tAct),
    ]);
    rows.push([
      v.plateNumber,
      labels.rowDiff,
      ...days.map((d) => fmtCell(v.diffM3ByDay[d - 1])),
      fmtCell(tDiff),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const sn = sheetName.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sn);
  const fname = `${safeExcelFileBase(fileBaseName)}.xlsx`;
  XLSX.writeFile(wb, fname);
}
