import L from 'leaflet';

export type SavedFuelStationMapItem = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: string;
  updatedAt: string;
};

/** Admin saqlagan zapravka — oq kvadrat + binafsha nasos (OSM nasos bilan bir xil uslub, rang bilan farq). */
export const savedFuelLeafletIcon = L.divIcon({
  className: 'leaflet-saved-fuel-divicon',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -32],
  html: `<div class="map-saved-fuel-marker-pin" aria-hidden="true"><svg class="map-saved-fuel-pump-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 24" width="18" height="22"><rect x="1" y="20" width="11" height="2.6" rx="0.35" fill="#5b21b6"/><rect x="3" y="3.5" width="7" height="16.5" rx="0.85" fill="#5b21b6"/><rect x="4.15" y="5.2" width="4.7" height="3.1" rx="0.25" fill="#ffffff"/><path d="M10.5 10.5C12.8 10.5 14.2 12 14.6 14.2v3.2" stroke="#5b21b6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M14.2 17.2l2.6 1.6v2.8l-3.1-1.1v-2.5z" fill="#5b21b6"/></svg></div>`,
});
