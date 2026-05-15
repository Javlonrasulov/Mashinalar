/** Jadval qatori va zapravka nomi uchun rang palitrasi (indeks bo‘yicha). */
export const FUEL_STATION_PALETTE = [
  {
    row: 'bg-blue-50/90 hover:bg-blue-100/90 dark:bg-blue-950/30 dark:hover:bg-blue-950/45',
    name: 'font-medium text-blue-900 dark:text-blue-100',
  },
  {
    row: 'bg-violet-50/90 hover:bg-violet-100/90 dark:bg-violet-950/28 dark:hover:bg-violet-950/42',
    name: 'font-medium text-violet-900 dark:text-violet-100',
  },
  {
    row: 'bg-emerald-50/90 hover:bg-emerald-100/90 dark:bg-emerald-950/28 dark:hover:bg-emerald-950/42',
    name: 'font-medium text-emerald-900 dark:text-emerald-100',
  },
  {
    row: 'bg-amber-50/90 hover:bg-amber-100/90 dark:bg-amber-950/28 dark:hover:bg-amber-950/42',
    name: 'font-medium text-amber-950 dark:text-amber-100',
  },
  {
    row: 'bg-rose-50/90 hover:bg-rose-100/90 dark:bg-rose-950/28 dark:hover:bg-rose-950/42',
    name: 'font-medium text-rose-900 dark:text-rose-100',
  },
  {
    row: 'bg-teal-50/90 hover:bg-teal-100/90 dark:bg-teal-950/28 dark:hover:bg-teal-950/42',
    name: 'font-medium text-teal-900 dark:text-teal-100',
  },
  {
    row: 'bg-orange-50/90 hover:bg-orange-100/90 dark:bg-orange-950/28 dark:hover:bg-orange-950/42',
    name: 'font-medium text-orange-950 dark:text-orange-100',
  },
  {
    row: 'bg-cyan-50/90 hover:bg-cyan-100/90 dark:bg-cyan-950/28 dark:hover:bg-cyan-950/42',
    name: 'font-medium text-cyan-900 dark:text-cyan-100',
  },
] as const;

export function normalizeStationLabelKey(label: string): string {
  return label
    .replace(/[«»""'']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function pinnedPaletteIndex(key: string): number | null {
  if (key.includes('NAVOIY') && key.includes('LOGISTIK')) return 0;
  if (key.includes('NARGIZ') || key.includes('НАРГИЗ')) return 1;
  return null;
}

function hashPaletteIndex(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  const span = FUEL_STATION_PALETTE.length - 2;
  return 2 + (Math.abs(h) % span);
}

/** Xaritada saqlangan zapravkalar → barqaror rang indeksi. */
export function buildStationPaletteLookup(stations: { name: string }[]): Map<string, number> {
  const map = new Map<string, number>();
  const used = new Set<number>();
  let nextFree = 2;

  const claim = (key: string, idx: number) => {
    if (map.has(key)) return;
    map.set(key, idx);
    used.add(idx);
  };

  for (const s of stations) {
    const key = normalizeStationLabelKey(s.name);
    if (!key) continue;
    const pin = pinnedPaletteIndex(key);
    if (pin != null) {
      claim(key, pin);
      continue;
    }
    while (used.has(nextFree) && nextFree < FUEL_STATION_PALETTE.length) nextFree += 1;
    if (nextFree < FUEL_STATION_PALETTE.length) {
      claim(key, nextFree);
      nextFree += 1;
    } else {
      claim(key, hashPaletteIndex(key));
    }
  }

  return map;
}

/** `null` — nomi yo‘q / noma’lum (oddiy qator). */
export function resolveStationPaletteIndex(
  label: string,
  lookup: Map<string, number>,
): number | null {
  const key = normalizeStationLabelKey(label);
  if (!key) return null;

  const pin = pinnedPaletteIndex(key);
  if (pin != null) return pin;

  const fromLookup = lookup.get(key);
  if (fromLookup != null) return fromLookup;

  return hashPaletteIndex(key);
}

export function fuelStationRowClass(index: number | null): string {
  if (index == null || index < 0 || index >= FUEL_STATION_PALETTE.length) return '';
  return FUEL_STATION_PALETTE[index].row;
}

export function fuelStationNameClass(index: number | null): string {
  if (index == null || index < 0 || index >= FUEL_STATION_PALETTE.length) {
    return 'text-slate-700 dark:text-slate-200';
  }
  return FUEL_STATION_PALETTE[index].name;
}
