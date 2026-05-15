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

/** Admin saqlagan zapravka — binafsha marker. */
export const savedFuelLeafletIcon = L.divIcon({
  className: 'leaflet-saved-fuel-divicon',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
  html: `<span class="map-saved-fuel-marker-pin" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="12" r="10" fill="#7c3aed" stroke="#fff" stroke-width="2"/><path d="M12 6.5v5.2l3.2 1.9" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg></span>`,
});
