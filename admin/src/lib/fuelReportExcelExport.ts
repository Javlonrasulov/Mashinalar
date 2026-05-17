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
    diffM3ByDay?: (number | null)[];
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
  savedAt?: string;
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

function hasAnyActual(values: (number | null)[]): boolean {
  return values.some((x) => x != null && Number.isFinite(x));
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

  return rows;
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
  const ws = XLSX.utils.aoa_to_sheet(buildSheetRows(grid, labels, savedAtIso));
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
    const ws = XLSX.utils.aoa_to_sheet(
      buildSheetRows(item.grid, labels, item.createdAt),
    );
    XLSX.utils.book_append_sheet(wb, ws, sn);
  });
  XLSX.writeFile(wb, `${safeExcelFileBase(fileBaseName)}.xlsx`);
}
