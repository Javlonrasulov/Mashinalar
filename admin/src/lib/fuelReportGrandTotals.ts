export type FuelReportVehicleM3 = {
  systemM3ByDay: (number | null)[];
  actualM3ByDay: (number | null)[];
};

export type FuelReportGrandTotals = {
  systemByDay: (number | null)[];
  vendorByDay: (number | null)[];
  totalSystem: number | null;
  totalVendor: number | null;
  totalDiff: number | null;
  anyVendorEntered: boolean;
};

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

function addToDay(bucket: (number | null)[], dayIndex: number, value: number | null) {
  if (value == null || !Number.isFinite(value)) return;
  bucket[dayIndex] = Math.round(((bucket[dayIndex] ?? 0) + value) * 100) / 100;
}

/** Барча машиналар бўйича кунлик ва умумий жами (m³). */
export function computeFuelReportGrandTotals(
  daysInMonth: number,
  vehicles: FuelReportVehicleM3[],
): FuelReportGrandTotals {
  const systemByDay: (number | null)[] = Array.from({ length: daysInMonth }, () => null);
  const vendorByDay: (number | null)[] = Array.from({ length: daysInMonth }, () => null);
  let anyVendorEntered = false;

  for (const v of vehicles) {
    if (hasAnyActual(v.actualM3ByDay)) anyVendorEntered = true;
    for (let i = 0; i < daysInMonth; i += 1) {
      addToDay(systemByDay, i, v.systemM3ByDay[i] ?? null);
      addToDay(vendorByDay, i, v.actualM3ByDay[i] ?? null);
    }
  }

  const totalSystem = sumNums(systemByDay);
  const totalVendor = anyVendorEntered ? sumNums(vendorByDay) : null;
  const totalDiff =
    anyVendorEntered && (totalSystem != null || totalVendor != null)
      ? Math.round(((totalSystem ?? 0) - (totalVendor ?? 0)) * 100) / 100
      : null;

  return {
    systemByDay,
    vendorByDay,
    totalSystem,
    totalVendor,
    totalDiff,
    anyVendorEntered,
  };
}
