import { LayersControl, TileLayer } from 'react-leaflet';
import { useI18n } from '@/i18n/I18nContext';

/** Esri World Imagery — kalitsiz, Leaflet uchun mos. */
const ESRI_IMAGERY =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

/** Esri ko‘p hududlarda z19+ da bo‘sh / «Map data not yet available» plitka qaytaradi — shu darajadan yuqori zoomda plitka kattalashtiriladi. */
const OSM_MAX_NATIVE_ZOOM = 19;
const ESRI_MAX_NATIVE_ZOOM = 18;

/** Xarita konteyneri bilan bir xil qo‘ying — zoom chegarasi bir tekis bo‘lsin. */
export const LEAFLET_MAP_MAX_ZOOM = 19;

type MapBaseLayersProps = {
  /** Leaflet control o‘rni (default: chap yuqori — zapravka tugmasi bilan chalkashmaydi). */
  position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
};

export function MapBaseLayers({ position = 'topleft' }: MapBaseLayersProps) {
  const { t } = useI18n();
  return (
    <LayersControl position={position}>
      <LayersControl.BaseLayer checked name={t('mapLayerSchema')}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={LEAFLET_MAP_MAX_ZOOM}
          maxNativeZoom={OSM_MAX_NATIVE_ZOOM}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name={t('mapLayerSatellite')}>
        <TileLayer
          attribution={ESRI_ATTRIBUTION}
          url={ESRI_IMAGERY}
          maxZoom={LEAFLET_MAP_MAX_ZOOM}
          maxNativeZoom={ESRI_MAX_NATIVE_ZOOM}
        />
      </LayersControl.BaseLayer>
    </LayersControl>
  );
}
