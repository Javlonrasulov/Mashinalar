import L from 'leaflet';

/** API /map/fuel-stations javobi (xarita markerlari). */
export type FuelStationMapItem = {
  id: string;
  lat: number;
  lon: number;
  name: string | null;
  brand: string | null;
  fuels: string[];
  label: string;
};

/** Zapravka markeri: oq kvadrat + qora nasos silueti. */
export const fuelPumpLeafletIcon = L.divIcon({
  className: 'leaflet-fuel-divicon',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -32],
  html: `<div class="map-fuel-marker-pin" aria-hidden="true"><svg class="map-fuel-pump-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24" width="18" height="22" aria-hidden="true"><rect x="1" y="20" width="11" height="2.6" rx="0.35" fill="#0f172a"/><rect x="3" y="3.5" width="7" height="16.5" rx="0.85" fill="#0f172a"/><rect x="4.15" y="5.2" width="4.7" height="3.1" rx="0.25" fill="#ffffff"/><path d="M10.5 10.5C12.8 10.5 14.2 12 14.6 14.2v3.2" stroke="#0f172a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M14.2 17.2l2.6 1.6v2.8l-3.1-1.1v-2.5z" fill="#0f172a"/></svg></div>`,
});

/** Nuqta atrofida Overpass bbox (gradus). */
export function fuelStationsBboxQuery(lat: number, lon: number, padDeg = 0.08): string {
  const south = lat - padDeg;
  const north = lat + padDeg;
  const west = lon - padDeg;
  const east = lon + padDeg;
  return new URLSearchParams({
    south: String(south),
    west: String(west),
    north: String(north),
    east: String(east),
  }).toString();
}
