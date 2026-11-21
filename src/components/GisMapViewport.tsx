import React, { useEffect, useState } from 'react';
import { CloudOff, Globe, MapPin } from 'lucide-react';
import {
  AppLocale,
  BaseMapType,
  GeoBounds,
  GeoPoint,
  GisRegistryItem,
  MapDetailLayer,
  MapViewport,
  MarkerCluster,
  RegionEntity,
  TrafficCorridor,
  TransitStopPoint,
} from '../types/gis';
import { L10n } from '../core/localization';
import { getGoogleMapsApiKey } from '../core/mapsConfig';
import { BrandLogo } from './BrandLogo';
import { UzbekistanGisCanvas } from './UzbekistanGisCanvas';
import { UzbekistanGoogleMapView } from './UzbekistanGoogleMapView';
import { UzbekistanRealMapView } from './UzbekistanRealMapView';

interface GisMapViewportProps {
  locale: AppLocale;
  markers: GisRegistryItem[];
  regions: RegionEntity[];
  darkTheme: boolean;
  offlineMode: boolean;
  baseMapType: BaseMapType;
  activeDetails: Set<MapDetailLayer>;
  exclusiveMapTap: boolean;
  viewport: MapViewport;
  onViewportChange: (vp: MapViewport) => void;
  measurePoints: GeoPoint[];
  userLocation: GeoPoint | null;
  emergencyPin: GeoPoint | null;
  emergencyModeActive: boolean;
  activeRoutePoints: GeoPoint[];
  activeRouteWarning: boolean;
  downloadPreviewBounds: GeoBounds | null;
  savedAreaBounds: GeoBounds[];
  hasCachedOfflineAreas: boolean;
  isTrackingLocation: boolean;
  onUserGestureStoppedTracking: () => void;
  selectedMarkerId: string | null;
  onMarkerTap: (marker: GisRegistryItem) => void;
  onClusterTap: (cluster: MarkerCluster) => void;
  onMapTap: ((pt: GeoPoint) => void) | null;
  onMapLongPress: ((pt: GeoPoint) => void) | null;
  onTrafficCorridorTap: (corridor: TrafficCorridor) => void;
  onTransitStopTap: (station: TransitStopPoint) => void;
  onStreetViewTap: (point: GeoPoint) => void;
  onSdkBadgeClick: () => void;
}

export const GisMapViewport: React.FC<GisMapViewportProps> = ({
  locale,
  markers,
  regions,
  darkTheme,
  offlineMode,
  baseMapType,
  activeDetails,
  exclusiveMapTap,
  viewport,
  onViewportChange,
  measurePoints,
  userLocation,
  emergencyPin,
  emergencyModeActive,
  activeRoutePoints,
  activeRouteWarning,
  downloadPreviewBounds,
  savedAreaBounds,
  hasCachedOfflineAreas,
  isTrackingLocation,
  onUserGestureStoppedTracking,
  selectedMarkerId,
  onMarkerTap,
  onClusterTap,
  onMapTap,
  onMapLongPress,
  onTrafficCorridorTap,
  onTransitStopTap,
  onStreetViewTap,
  onSdkBadgeClick,
}) => {
  const [googleMapFailed, setGoogleMapFailed] = useState(false);
  const [mapLoadFailed, setMapLoadFailed] = useState(false);

  const hasGoogleKey = Boolean(getGoogleMapsApiKey());

  useEffect(() => {
    const onQuotaOrError = () => setGoogleMapFailed(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaOrError);
    window.addEventListener('gmp-load-error', onQuotaOrError);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', onQuotaOrError);
      window.removeEventListener('gmp-load-error', onQuotaOrError);
    };
  }, []);

  useEffect(() => {
    if (!offlineMode) {
      setMapLoadFailed(false);
    }
  }, [offlineMode, baseMapType]);

  const useGoogleMap = hasGoogleKey && !offlineMode && !googleMapFailed;
  const useMapLibre = !useGoogleMap && !mapLoadFailed && (!offlineMode || hasCachedOfflineAreas);
  const usingCachedOfflineTiles = !useGoogleMap && offlineMode && hasCachedOfflineAreas && !mapLoadFailed;

  const badgeLabel = useGoogleMap
    ? L10n.text(locale, 'googleMapsBadge')
    : !useMapLibre
    ? L10n.text(locale, 'realMapOfflineBadge')
    : usingCachedOfflineTiles
    ? L10n.text(locale, 'realMapCachedOfflineBadge')
    : L10n.text(locale, 'realMapBadge');

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${
        emergencyModeActive ? 'ring-2 ring-[var(--error)]/70 ring-inset' : ''
      }`}
    >
      {useGoogleMap ? (
        <UzbekistanGoogleMapView
          locale={locale}
          markers={markers}
          darkTheme={darkTheme}
          baseMapType={baseMapType}
          activeDetails={activeDetails}
          exclusiveMapTap={exclusiveMapTap}
          viewport={viewport}
          onViewportChange={onViewportChange}
          measurePoints={measurePoints}
          userLocation={userLocation}
          emergencyPin={emergencyPin}
          activeRoutePoints={activeRoutePoints}
          activeRouteWarning={activeRouteWarning}
          downloadPreviewBounds={downloadPreviewBounds}
          savedAreaBounds={savedAreaBounds}
          isTrackingLocation={isTrackingLocation}
          onUserGestureStoppedTracking={onUserGestureStoppedTracking}
          selectedMarkerId={selectedMarkerId}
          onMarkerTap={onMarkerTap}
          onClusterTap={onClusterTap}
          onMapTap={onMapTap}
          onMapLongPress={onMapLongPress}
          onStreetViewTap={onStreetViewTap}
          onMapLoadFailed={() => setGoogleMapFailed(true)}
        />
      ) : useMapLibre ? (
        <UzbekistanRealMapView
          markers={markers}
          darkTheme={darkTheme}
          baseMapType={baseMapType}
          activeDetails={activeDetails}
          exclusiveMapTap={exclusiveMapTap}
          viewport={viewport}
          onViewportChange={onViewportChange}
          measurePoints={measurePoints}
          userLocation={userLocation}
          emergencyPin={emergencyPin}
          activeRoutePoints={activeRoutePoints}
          activeRouteWarning={activeRouteWarning}
          downloadPreviewBounds={downloadPreviewBounds}
          savedAreaBounds={savedAreaBounds}
          isTrackingLocation={isTrackingLocation}
          onUserGestureStoppedTracking={onUserGestureStoppedTracking}
          selectedMarkerId={selectedMarkerId}
          onMarkerTap={onMarkerTap}
          onClusterTap={onClusterTap}
          onMapTap={onMapTap}
          onMapLongPress={onMapLongPress}
          onTrafficCorridorTap={onTrafficCorridorTap}
          onTransitStopTap={onTransitStopTap}
          onStreetViewTap={onStreetViewTap}
          onMapLoadFailed={() => setMapLoadFailed(true)}
        />
      ) : (
        <UzbekistanGisCanvas
          markers={markers}
          regions={regions}
          localeCode={locale}
          darkTheme={darkTheme}
          baseMapType={baseMapType}
          activeDetails={activeDetails}
          exclusiveMapTap={exclusiveMapTap}
          viewport={viewport}
          onViewportChange={onViewportChange}
          measurePoints={measurePoints}
          routePoints={activeRoutePoints}
          routeIsWarning={activeRouteWarning}
          userLocation={userLocation}
          emergencyPin={emergencyPin}
          downloadPreviewBounds={downloadPreviewBounds}
          savedAreaBounds={savedAreaBounds}
          selectedObjectId={selectedMarkerId}
          onMarkerTap={onMarkerTap}
          onClusterTap={onClusterTap}
          onMapTap={onMapTap ?? undefined}
          onMapLongPress={onMapLongPress ?? undefined}
          onTrafficCorridorTap={onTrafficCorridorTap}
          onTransitStopTap={onTransitStopTap}
          onStreetViewTap={onStreetViewTap}
        />
      )}

      {/* Top-left unobtrusive status badge below search + chip overlay */}
      <button
        type="button"
        onClick={onSdkBadgeClick}
        data-testid="map_sdk_placeholder_badge"
        className="absolute left-3.5 top-[106px] z-10 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--surface)]/90 border border-[var(--outline)]/45 shadow-md text-[11px] font-bold text-[var(--primary)] cursor-pointer hover:bg-[var(--surface)]"
      >
        <BrandLogo size="xs" />
        {!useGoogleMap && !useMapLibre ? (
          <CloudOff className="w-3.5 h-3.5" />
        ) : usingCachedOfflineTiles ? (
          <MapPin className="w-3.5 h-3.5" />
        ) : (
          <Globe className="w-3.5 h-3.5" />
        )}
        <span>{badgeLabel}</span>
      </button>
    </div>
  );
};
