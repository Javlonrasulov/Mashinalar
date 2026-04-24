import { Injectable, Logger } from '@nestjs/common';

/** Yaqin nuqtalar uchun bir xil manzil so‘rovi (~11 m). */
const GEO_LABEL_KEY_PRECISION = 4;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const GEO_CACHE_TTL_MS = 48 * 60 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function geoLabelKey(lat: number, lon: number): string {
  return `${Number(lat).toFixed(GEO_LABEL_KEY_PRECISION)}_${Number(lon).toFixed(GEO_LABEL_KEY_PRECISION)}`;
}

type NominatimReverseJson = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

function formatShortAddress(data: NominatimReverseJson): string {
  const a = data.address;
  if (a) {
    const road =
      a.road ??
      a.pedestrian ??
      a.path ??
      a.footway ??
      a.residential ??
      a.neighbourhood ??
      a.quarter;
    const parts: string[] = [];
    if (a.house_number && road) parts.push(`${road}, ${a.house_number}`);
    else if (road) parts.push(road);
    else if (a.house_number) parts.push(String(a.house_number));
    const place = a.suburb ?? a.district ?? a.city_district;
    if (place && parts.length && !parts[0].includes(place)) parts.push(place);
    const city = a.city ?? a.town ?? a.village ?? a.municipality;
    if (city) parts.push(city);
    if (parts.length) return [...new Set(parts)].join(', ');
  }
  if (data.display_name) {
    return data.display_name
      .split(',')
      .slice(0, 4)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

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

  private readonly geoLabelCache = new Map<string, { at: number; label: string }>();
  private lastNominatimRequestAt = 0;

  private async nominatimThrottle(): Promise<void> {
    const now = Date.now();
    const wait = this.lastNominatimRequestAt + NOMINATIM_MIN_INTERVAL_MS - now;
    if (wait > 0) await sleep(wait);
    this.lastNominatimRequestAt = Date.now();
  }

  /**
   * OSM Nominatim reverse (1 so‘rov/s siyosatiga rioya).
   * Kalit: `geoLabelKey` — yaqin nuqtalar bitta manzil bilan keshlanadi.
   */
  async reverseGeocodeBatch(points: { latitude: number; longitude: number }[]): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    const byKey = new Map<string, { lat: number; lon: number }>();
    for (const p of points) {
      const k = geoLabelKey(p.latitude, p.longitude);
      if (!byKey.has(k)) byKey.set(k, { lat: p.latitude, lon: p.longitude });
    }

    const ua = process.env.NOMINATIM_USER_AGENT ?? 'MashinalarFleet/1.0 (+https://github.com)';
    const base = (process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');

    for (const [key, { lat, lon }] of byKey) {
      const hit = this.geoLabelCache.get(key);
      if (hit && Date.now() - hit.at < GEO_CACHE_TTL_MS) {
        out[key] = hit.label;
        continue;
      }
      await this.nominatimThrottle();
      const url = `${base}/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&zoom=18&addressdetails=1`;
      let label = '';
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': ua, Accept: 'application/json' },
        });
        if (!res.ok) {
          this.logger.warn(`Nominatim reverse HTTP ${res.status}`);
        } else {
          const json = (await res.json()) as NominatimReverseJson;
          label = formatShortAddress(json).trim();
        }
      } catch (e) {
        this.logger.warn(`Nominatim reverse failed: ${(e as Error).message}`);
      }
      if (label) {
        this.geoLabelCache.set(key, { at: Date.now(), label });
        out[key] = label;
      }
    }
    return out;
  }

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
