import { Injectable, Logger } from '@nestjs/common';

export type FuelStationBbox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type FuelStationDto = {
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  brand: string | null;
  fuels: string[];
  label: string;
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/**
 * Default: butun Navoiy viloyati (OSM relation 196246 «Navoiy Viloyati» chegarasi, `out bb`).
 * Override: `FUEL_STATIONS_DEFAULT_BBOX=south,west,north,east` (comma-separated decimals).
 */
const DEFAULT_BBOX_NAVOIY_VILOYAT: FuelStationBbox = {
  south: 39.4634,
  west: 61.6802,
  north: 43.7354,
  east: 66.7778,
};

function defaultBboxFromEnv(): FuelStationBbox | null {
  const raw = process.env.FUEL_STATIONS_DEFAULT_BBOX?.trim();
  if (!raw) return null;
  const parts = raw.split(/[\s,]+/).map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts;
  if (south >= north || west >= east) return null;
  return { south, west, north, east };
}

const DEFAULT_BBOX: FuelStationBbox = defaultBboxFromEnv() ?? DEFAULT_BBOX_NAVOIY_VILOYAT;

const FUEL_LABEL: Record<string, string> = {
  diesel: 'Diesel',
  cng: 'Metan (CNG)',
  lpg: 'Propan (LPG)',
  octane_80: 'AI-80',
  octane_91: 'AI-91',
  octane_92: 'AI-92',
  octane_95: 'AI-95',
  octane_98: 'AI-98',
  octane_100: 'AI-100',
  e5: 'E5',
  e10: 'E10',
  e85: 'E85',
  '1_25': 'AI-80',
  '1_30': 'AI-91',
  electricity: 'Elektr',
};

function fuelLabelFromTag(key: string, value: string): string | null {
  if (!key.startsWith('fuel:')) return null;
  if (value === 'no') return null;
  const kind = key.slice('fuel:'.length);
  const mapped = FUEL_LABEL[kind];
  if (value === 'yes') return mapped ?? kind.replace(/_/g, ' ').toUpperCase();
  return mapped ? `${mapped} (${value})` : `${kind}: ${value}`;
}

function collectFuels(tags: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(tags)) {
    const lbl = fuelLabelFromTag(k, v);
    if (lbl) out.push(lbl);
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b));
}

@Injectable()
export class OsmFuelService {
  private readonly logger = new Logger(OsmFuelService.name);
  private cache: { key: string; at: number; data: FuelStationDto[] } | null = null;
  private readonly ttlMs = 60 * 60 * 1000;

  async listFuelStations(bbox: FuelStationBbox): Promise<FuelStationDto[]> {
    const { south, west, north, east } = bbox;
    const key = `${south},${west},${north},${east}`;
    if (this.cache && this.cache.key === key && Date.now() - this.cache.at < this.ttlMs) {
      return this.cache.data;
    }

    const timeoutSec = Math.min(
      180,
      Math.max(55, Number(process.env.OVERPASS_TIMEOUT_SEC ?? '120') || 120),
    );
    const query = `[out:json][timeout:${timeoutSec}];
(
  node["amenity"="fuel"](${south},${west},${north},${east});
  way["amenity"="fuel"](${south},${west},${north},${east});
  relation["amenity"="fuel"](${south},${west},${north},${east});
);
out center tags;`;

    const url = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
    // Overpass returns 406 if no User-Agent (Node fetch omits it by default).
    const ua = process.env.OVERPASS_USER_AGENT ?? 'MashinalarFleet/1.0 (+https://github.com)';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: 'application/json',
        'User-Agent': ua,
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) {
      this.logger.warn(`Overpass HTTP ${res.status}`);
      return [];
    }
    const json = (await res.json()) as { elements?: OverpassElement[] };
    const elements = json.elements ?? [];
    const stations: FuelStationDto[] = [];

    for (const el of elements) {
      const tags = el.tags ?? {};
      let lat: number | undefined;
      let lon: number | undefined;
      if (el.type === 'node') {
        lat = el.lat;
        lon = el.lon;
      } else if (el.center) {
        lat = el.center.lat;
        lon = el.center.lon;
      }
      if (lat == null || lon == null) continue;

      const name = tags.name?.trim() || null;
      const brand = tags.brand?.trim() || null;
      const fuels = collectFuels(tags);
      const title = name ?? brand ?? 'Заправка';
      const fuelPart = fuels.length ? fuels.join(', ') : '';
      const label = fuelPart ? `${title} — ${fuelPart}` : title;

      stations.push({
        id: `osm-${el.type}-${el.id}`,
        lat,
        lon,
        name,
        brand,
        fuels,
        label,
      });
    }

    this.cache = { key, at: Date.now(), data: stations };
    return stations;
  }

  defaultBbox(): FuelStationBbox {
    return { ...DEFAULT_BBOX };
  }
}
