import React, { useEffect, useMemo, useRef } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  ColorScheme,
  Map as GoogleMap,
  MapCameraChangedEvent,
  MapMouseEvent,
  Polygon,
  Polyline,
  Rectangle,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Building2,
  Droplets,
  Flame,
  Mountain,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import {
  AppLocale,
  BaseMapType,
  GeoBounds,
  GeoPoint,
  GisRegistryItem,
  MapDetailLayer,
  MapViewport,
  MarkerCluster,
  getClusterWorstStatus,
} from '../types/gis';
import { canvasZoomToGoogleZoom, googleZoomToCanvasZoom } from '../core/mapsConfig';
import { RELIEF_PEAKS } from '../data/mapLayersData';
import { statusMapHex } from '../theme/colors';

interface UzbekistanGoogleMapViewProps {
  locale: AppLocale;
  markers: GisRegistryItem[];
  darkTheme: boolean;
  baseMapType: BaseMapType;
  activeDetails: Set<MapDetailLayer>;
  exclusiveMapTap: boolean;
  viewport: MapViewport;
  onViewportChange: (vp: MapViewport) => void;
  measurePoints: GeoPoint[];
  userLocation: GeoPoint | null;
  emergencyPin: GeoPoint | null;
  activeRoutePoints: GeoPoint[];
  activeRouteWarning: boolean;
  downloadPreviewBounds: GeoBounds | null;
  savedAreaBounds: GeoBounds[];
  isTrackingLocation: boolean;
  onUserGestureStoppedTracking: () => void;
  selectedMarkerId: string | null;
  onMarkerTap: (marker: GisRegistryItem) => void;
  onClusterTap: (cluster: MarkerCluster) => void;
  onMapTap: ((pt: GeoPoint) => void) | null;
  onMapLongPress: ((pt: GeoPoint) => void) | null;
  onStreetViewTap: (point: GeoPoint) => void;
  onMapLoadFailed: () => void;
}

function latLonToWorldPx(lat: number, lon: number, zoom: number): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom);
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clampedSin = Math.max(-0.9999, Math.min(0.9999, sinLat));
  const x = ((lon + 180) / 360) * scale;
  const y = (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function clusterGoogleMarkers(
  markers: GisRegistryItem[],
  googleZoom: number
): MarkerCluster[] {
  if (markers.length === 0) return [];
  // Above zoom 9.5 (city/region level), always show every single point individually
  if (googleZoom >= 9.5) {
    return markers.map((item) => ({
      id: item.id,
      center: item.markerCoordinate,
      items: [item],
    }));
  }

  const radiusPx = 32;
  const radiusSq = radiusPx * radiusPx;
  const clusters: { sumLat: number; sumLon: number; px: { x: number; y: number }; items: GisRegistryItem[] }[] = [];

  for (const item of markers) {
    const ptPx = latLonToWorldPx(item.markerCoordinate.lat, item.markerCoordinate.lon, googleZoom);
    let matched = false;
    for (const cl of clusters) {
      const dx = cl.px.x - ptPx.x;
      const dy = cl.px.y - ptPx.y;
      if (dx * dx + dy * dy <= radiusSq) {
        cl.items.push(item);
        cl.sumLat += item.markerCoordinate.lat;
        cl.sumLon += item.markerCoordinate.lon;
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({
        sumLat: item.markerCoordinate.lat,
        sumLon: item.markerCoordinate.lon,
        px: ptPx,
        items: [item],
      });
    }
  }

  return clusters.map((cl, idx) => ({
    id: cl.items.length === 1 ? cl.items[0].id : `gcl_${idx}_${cl.items[0].id}`,
    center: {
      lat: cl.sumLat / cl.items.length,
      lon: cl.sumLon / cl.items.length,
    },
    items: cl.items,
  }));
}

function renderCategoryGlyph(categoryId: string): React.ReactNode {
  if (categoryId.includes('fire') || categoryId.includes('gas')) {
    return <Flame className="w-3.5 h-3.5 text-white" />;
  }
  if (categoryId.includes('electric') || categoryId.includes('substation')) {
    return <Zap className="w-3.5 h-3.5 text-white" />;
  }
  if (categoryId.includes('water') || categoryId.includes('pump') || categoryId.includes('hydrant')) {
    return <Droplets className="w-3.5 h-3.5 text-white" />;
  }
  if (categoryId.includes('hazard') || categoryId.includes('emergency')) {
    return <ShieldAlert className="w-3.5 h-3.5 text-white" />;
  }
  return <Building2 className="w-3.5 h-3.5 text-white" />;
}

interface NativeLayersBridgeProps {
  activeDetails: Set<MapDetailLayer>;
  viewport: MapViewport;
  programmaticMoveRef: React.MutableRefObject<boolean>;
}

const NativeLayersAndCameraBridge: React.FC<NativeLayersBridgeProps> = ({
  activeDetails,
  viewport,
  programmaticMoveRef,
}) => {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');
  const streetViewLib = useMapsLibrary('streetView');

  const trafficRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitRef = useRef<google.maps.TransitLayer | null>(null);
  const bicyclingRef = useRef<google.maps.BicyclingLayer | null>(null);
  const svCoverageRef = useRef<google.maps.StreetViewCoverageLayer | null>(null);

  // Manage Google Maps built-in Traffic, Transit, Bicycling layers
  useEffect(() => {
    if (!map || !mapsLib) return;

    if (!trafficRef.current) trafficRef.current = new mapsLib.TrafficLayer();
    if (!transitRef.current) transitRef.current = new mapsLib.TransitLayer();
    if (!bicyclingRef.current) bicyclingRef.current = new mapsLib.BicyclingLayer();

    trafficRef.current.setMap(activeDetails.has('traffic') ? map : null);
    transitRef.current.setMap(activeDetails.has('transit') ? map : null);
    bicyclingRef.current.setMap(activeDetails.has('cycling') ? map : null);
  }, [map, mapsLib, activeDetails]);

  // Manage Google Maps Street View Coverage overlay (blue coverage lines on streets)
  useEffect(() => {
    if (!map || !streetViewLib) return;
    if (!svCoverageRef.current) {
      svCoverageRef.current = new streetViewLib.StreetViewCoverageLayer();
    }
    svCoverageRef.current.setMap(activeDetails.has('streetView') ? map : null);
  }, [map, streetViewLib, activeDetails]);

  // Clean up native layers on unmount
  useEffect(() => {
    return () => {
      trafficRef.current?.setMap(null);
      transitRef.current?.setMap(null);
      bicyclingRef.current?.setMap(null);
      svCoverageRef.current?.setMap(null);
    };
  }, []);

  // Sync external programmatic viewport changes (zoom +/-, GPS, marker center, reset)
  useEffect(() => {
    if (!map) return;
    const desiredZoom = canvasZoomToGoogleZoom(viewport.zoom);
    const curCenter = map.getCenter();
    const curZoom = map.getZoom() ?? desiredZoom;
    const sameCenter =
      curCenter != null &&
      Math.abs(curCenter.lat() - viewport.centerLat) < 0.00015 &&
      Math.abs(curCenter.lng() - viewport.centerLon) < 0.00015;
    const sameZoom = Math.abs(curZoom - desiredZoom) < 0.05;
    if (!sameCenter || !sameZoom) {
      programmaticMoveRef.current = true;
      map.moveCamera({
        center: { lat: viewport.centerLat, lng: viewport.centerLon },
        zoom: desiredZoom,
      });
    }
  }, [map, viewport.centerLat, viewport.centerLon, viewport.zoom, programmaticMoveRef]);

  return null;
};

export const UzbekistanGoogleMapView: React.FC<UzbekistanGoogleMapViewProps> = ({
  locale,
  markers,
  darkTheme,
  baseMapType,
  activeDetails,
  exclusiveMapTap,
  viewport,
  onViewportChange,
  measurePoints,
  userLocation,
  emergencyPin,
  activeRoutePoints,
  activeRouteWarning,
  downloadPreviewBounds,
  savedAreaBounds,
  isTrackingLocation,
  onUserGestureStoppedTracking,
  selectedMarkerId,
  onMarkerTap,
  onClusterTap,
  onMapTap,
  onMapLongPress,
  onStreetViewTap,
  onMapLoadFailed,
}) => {
  const apiStatus = useApiLoadingStatus();
  const map = useMap('fvv-google-map');
  const programmaticMoveRef = useRef(false);

  useEffect(() => {
    if (
      apiStatus === APILoadingStatus.FAILED ||
      apiStatus === APILoadingStatus.AUTH_FAILURE
    ) {
      onMapLoadFailed();
    }
  }, [apiStatus, onMapLoadFailed]);

  const googleZoom = canvasZoomToGoogleZoom(viewport.zoom);

  const resolvedMapTypeId = useMemo<'roadmap' | 'hybrid' | 'terrain'>(() => {
    if (baseMapType === 'satellite') return 'hybrid';
    if (baseMapType === 'terrain') return 'terrain';
    if (activeDetails.has('relief')) return 'terrain';
    return 'roadmap';
  }, [baseMapType, activeDetails]);

  const clusters = useMemo(
    () => clusterGoogleMarkers(markers, googleZoom),
    [markers, googleZoom]
  );

  const polygonGeoms = useMemo(
    () =>
      markers
        .filter((m) => m.parsedGeometry.type === 'Polygon')
        .map((m) => {
          const geom = m.parsedGeometry as { type: 'Polygon'; rings: GeoPoint[][] };
          return {
            id: m.id,
            color: statusMapHex(m.operationalStatus),
            paths: geom.rings
              .filter((r) => r.length >= 3)
              .map((r) => r.map((p) => ({ lat: p.lat, lng: p.lon }))),
          };
        }),
    [markers]
  );

  const lineGeoms = useMemo(
    () =>
      markers
        .filter((m) => m.parsedGeometry.type === 'LineString')
        .map((m) => {
          const geom = m.parsedGeometry as { type: 'LineString'; points: GeoPoint[] };
          return {
            id: m.id,
            color: statusMapHex(m.operationalStatus),
            path: geom.points.map((p) => ({ lat: p.lat, lng: p.lon })),
          };
        }),
    [markers]
  );

  const handleCameraChanged = (ev: MapCameraChangedEvent) => {
    if (programmaticMoveRef.current) {
      programmaticMoveRef.current = false;
      return;
    }
    const { center, zoom } = ev.detail;
    onViewportChange({
      centerLat: center.lat,
      centerLon: center.lng,
      zoom: googleZoomToCanvasZoom(zoom),
    });
  };

  const handleMapClick = (ev: MapMouseEvent) => {
    const ll = ev.detail.latLng;
    if (!ll) return;
    const pt: GeoPoint = { lat: ll.lat, lon: ll.lng };
    if (exclusiveMapTap && onMapTap) {
      onMapTap(pt);
      return;
    }
    if (activeDetails.has('streetView')) {
      onStreetViewTap(pt);
      return;
    }
    if (onMapTap) {
      onMapTap(pt);
    }
  };

  const handleMapContextMenu = (ev: MapMouseEvent) => {
    const ll = ev.detail.latLng;
    if (ll && onMapLongPress) {
      ev.stop();
      onMapLongPress({ lat: ll.lat, lon: ll.lng });
    }
  };

  return (
    <div className="w-full h-full relative" data-testid="google_maps_container">
      <GoogleMap
        id="fvv-google-map"
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={{ lat: viewport.centerLat, lng: viewport.centerLon }}
        defaultZoom={googleZoom}
        minZoom={4}
        maxZoom={21}
        mapTypeId={resolvedMapTypeId}
        colorScheme={darkTheme ? ColorScheme.DARK : ColorScheme.LIGHT}
        gestureHandling="greedy"
        disableDefaultUI={true}
        clickableIcons={true}
        onDragstart={() => {
          if (isTrackingLocation) {
            onUserGestureStoppedTracking();
          }
        }}
        onCameraChanged={handleCameraChanged}
        onClick={handleMapClick}
        onContextmenu={handleMapContextMenu}
        style={{ width: '100%', height: '100%' }}
      >
        <NativeLayersAndCameraBridge
          activeDetails={activeDetails}
          viewport={viewport}
          programmaticMoveRef={programmaticMoveRef}
        />

        {/* Saved Offline Area Bounds */}
        {savedAreaBounds.map((b, idx) => (
          <Rectangle
            key={`saved_bounds_${idx}`}
            bounds={{
              north: b.northLat,
              south: b.southLat,
              east: b.eastLon,
              west: b.westLon,
            }}
            strokeColor="#10B981"
            strokeOpacity={0.85}
            strokeWeight={1.5}
            fillColor="#10B981"
            fillOpacity={0.08}
            clickable={false}
          />
        ))}

        {/* Offline Download Preview Bounds */}
        {downloadPreviewBounds && (
          <Rectangle
            bounds={{
              north: downloadPreviewBounds.northLat,
              south: downloadPreviewBounds.southLat,
              east: downloadPreviewBounds.eastLon,
              west: downloadPreviewBounds.westLon,
            }}
            strokeColor="#0284C7"
            strokeOpacity={0.95}
            strokeWeight={2.8}
            fillColor="#0EA5E9"
            fillOpacity={0.16}
            clickable={false}
          />
        )}

        {/* Registry Polygons */}
        {polygonGeoms.map((pg) => (
          <Polygon
            key={`poly_${pg.id}`}
            paths={pg.paths}
            strokeColor={pg.color}
            strokeOpacity={0.9}
            strokeWeight={2}
            fillColor={pg.color}
            fillOpacity={0.22}
            clickable={false}
          />
        ))}

        {/* Registry LineStrings (Gas Pipelines, Electrical Cables) */}
        {lineGeoms.map((ln) => (
          <Polyline
            key={`line_${ln.id}`}
            path={ln.path}
            strokeColor={ln.color}
            strokeOpacity={0.92}
            strokeWeight={3.5}
            geodesic={true}
            clickable={false}
          />
        ))}

        {/* Active Emergency Pathfinding Route */}
        {activeRoutePoints.length >= 2 && (
          <>
            <Polyline
              path={activeRoutePoints.map((p) => ({ lat: p.lat, lng: p.lon }))}
              strokeColor="#081320"
              strokeOpacity={0.9}
              strokeWeight={8.5}
              geodesic={true}
              clickable={false}
            />
            <Polyline
              path={activeRoutePoints.map((p) => ({ lat: p.lat, lng: p.lon }))}
              strokeColor={activeRouteWarning ? '#F59E0B' : '#10B981'}
              strokeOpacity={1}
              strokeWeight={4.5}
              geodesic={true}
              clickable={false}
            />
          </>
        )}

        {/* Distance Measure Polyline & Vertices */}
        {measurePoints.length >= 2 && (
          <Polyline
            path={measurePoints.map((p) => ({ lat: p.lat, lng: p.lon }))}
            strokeColor="#0EA5E9"
            strokeOpacity={0.95}
            strokeWeight={3.5}
            geodesic={true}
            clickable={false}
          />
        )}
        {measurePoints.map((pt, idx) => (
          <AdvancedMarker
            key={`measure_pt_${idx}`}
            position={{ lat: pt.lat, lng: pt.lon }}
            zIndex={65}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-md -translate-y-1/2" />
          </AdvancedMarker>
        ))}

        {/* Relief Peaks badges when Terrain/Relief detail is active */}
        {(activeDetails.has('relief') || baseMapType === 'terrain') &&
          RELIEF_PEAKS.map((peak) => {
            const label =
              locale === 'ru' ? peak.nameRu : locale === 'en' ? peak.nameEn : peak.nameUz;
            return (
              <AdvancedMarker
                key={peak.id}
                position={{ lat: peak.point.lat, lng: peak.point.lon }}
                title={label}
                zIndex={15}
              >
                <div className="px-2 py-0.5 rounded-lg bg-amber-950/85 border border-amber-300/70 text-[10px] font-bold text-amber-100 shadow-md inline-flex items-center gap-1 whitespace-nowrap">
                  <Mountain className="w-3 h-3 text-amber-300" />
                  <span>{peak.elevationM} m</span>
                </div>
              </AdvancedMarker>
            );
          })}

        {/* FVV Registry Markers & Clusters */}
        {clusters.map((cl) => {
          if (cl.items.length > 1) {
            const worstStatus = getClusterWorstStatus(cl.items);
            const clColor = statusMapHex(worstStatus);
            return (
              <AdvancedMarker
                key={cl.id}
                position={{ lat: cl.center.lat, lng: cl.center.lon }}
                zIndex={40}
                onClick={() => {
                  if (map && googleZoom < 12) {
                    map.panTo({ lat: cl.center.lat, lng: cl.center.lon });
                    map.setZoom(Math.min(14, Math.round(googleZoom) + 3));
                  } else {
                    onClusterTap(cl);
                  }
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-black text-xs text-white border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-110"
                  style={{
                    backgroundColor: clColor,
                    boxShadow: `0 0 0 4px ${clColor}44, 0 4px 10px rgba(0,0,0,0.45)`,
                  }}
                >
                  {cl.items.length}
                </div>
              </AdvancedMarker>
            );
          }

          const item = cl.items[0];
          const color = statusMapHex(item.operationalStatus);
          const isSelected = item.id === selectedMarkerId;
          const showCodeChip = isSelected || googleZoom >= 12.5;

          return (
            <AdvancedMarker
              key={item.id}
              position={{
                lat: item.markerCoordinate.lat,
                lng: item.markerCoordinate.lon,
              }}
              title={`${item.code} · ${item.name}`}
              zIndex={isSelected ? 80 : 35}
              onClick={() => {
                if (exclusiveMapTap && onMapTap) {
                  onMapTap(item.markerCoordinate);
                } else {
                  onMarkerTap(item);
                }
              }}
            >
              <div className="flex flex-col items-center cursor-pointer group">
                <div
                  className={`flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform ${
                    isSelected ? 'w-9 h-9 scale-115 ring-4 ring-white/50' : 'w-7 h-7 group-hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {renderCategoryGlyph(item.categoryId)}
                </div>
                {showCodeChip && (
                  <span className="mt-0.5 px-1.5 py-0.5 rounded bg-slate-950/85 text-white text-[9px] font-bold tracking-tight border border-white/25 shadow whitespace-nowrap max-w-[140px] truncate">
                    {item.code}
                  </span>
                )}
              </div>
            </AdvancedMarker>
          );
        })}

        {/* User Live GPS Location */}
        {userLocation && (
          <AdvancedMarker
            position={{ lat: userLocation.lat, lng: userLocation.lon }}
            zIndex={90}
            title="GPS"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute w-8 h-8 rounded-full bg-sky-400/35 animate-ping" />
              <span className="w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow-lg" />
            </div>
          </AdvancedMarker>
        )}

        {/* Emergency Dropped Pin */}
        {emergencyPin && (
          <AdvancedMarker
            position={{ lat: emergencyPin.lat, lng: emergencyPin.lon }}
            zIndex={100}
            title="Emergency Pin"
          >
            <div className="flex flex-col items-center -translate-y-1">
              <div className="w-9 h-9 rounded-full bg-red-600 border-2 border-white shadow-xl flex items-center justify-center animate-bounce">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
            </div>
          </AdvancedMarker>
        )}
      </GoogleMap>
    </div>
  );
};
