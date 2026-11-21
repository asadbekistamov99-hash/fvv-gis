import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { StyleSpecification } from 'maplibre-gl';
import {
  BaseMapType,
  GeoBounds,
  GeoPoint,
  GisRegistryItem,
  MapDetailLayer,
  MapViewport,
  MarkerCluster,
  TrafficCorridor,
  TransitStopPoint,
} from '../types/gis';
import {
  CYCLING_ROUTES,
  RELIEF_PEAKS,
  STREET_VIEW_CORRIDORS,
  STREET_VIEW_PANORAMAS,
  TRAFFIC_CORRIDORS,
  TRANSIT_LINES,
  TRANSIT_STATIONS,
  trafficColorHex,
} from '../data/mapLayersData';
import { boundsToPolygonRing } from '../core/offlineMapManager';
import { statusMapHex } from '../theme/colors';

const STYLE_LIGHT_URL = 'https://tiles.openfreemap.org/styles/liberty';
const STYLE_DARK_URL = 'https://tiles.openfreemap.org/styles/dark';

export function openFreeMapStyleUrl(darkTheme: boolean): string {
  return darkTheme ? STYLE_DARK_URL : STYLE_LIGHT_URL;
}

function buildSatelliteStyleSpec(darkTheme: boolean): StyleSpecification {
  return {
    version: 8,
    name: 'FVV Satellite Imagery',
    sources: {
      'esri-world-imagery': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'esri-satellite-base',
        type: 'raster',
        source: 'esri-world-imagery',
        paint: {
          'raster-brightness-max': darkTheme ? 0.88 : 1.0,
          'raster-contrast': 0.08,
        },
      },
    ],
  };
}

function resolveMapStyle(
  darkTheme: boolean,
  baseMapType: BaseMapType
): string | StyleSpecification {
  if (baseMapType === 'satellite') {
    return buildSatelliteStyleSpec(darkTheme);
  }
  return openFreeMapStyleUrl(darkTheme);
}

function canvasZoomToMapLibre(canvasZoom: number): number {
  const log2 = Math.log(Math.max(0.5, canvasZoom)) / Math.LN2;
  return Math.max(3.5, Math.min(19.0, 5.2 + 2.2 * log2));
}

function mapLibreZoomToCanvas(mlZoom: number): number {
  return Math.max(0.5, Math.min(256, Math.pow(2, (mlZoom - 5.2) / 2.2)));
}

function buildGeometryGeoJson(markers: GisRegistryItem[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const item of markers) {
    const color = statusMapHex(item.operationalStatus);
    const geom = item.parsedGeometry;
    if (geom.type === 'LineString' && geom.points.length >= 2) {
      features.push({
        type: 'Feature',
        properties: { color, id: item.id },
        geometry: {
          type: 'LineString',
          coordinates: geom.points.map((p) => [p.lon, p.lat]),
        },
      });
    } else if (geom.type === 'Polygon') {
      const rings = geom.rings
        .filter((r) => r.length >= 3)
        .map((r) => {
          const closed =
            r[0].lat === r[r.length - 1].lat && r[0].lon === r[r.length - 1].lon
              ? r
              : [...r, r[0]];
          return closed.map((p) => [p.lon, p.lat]);
        });
      if (rings.length > 0) {
        features.push({
          type: 'Feature',
          properties: { color, id: item.id },
          geometry: { type: 'Polygon', coordinates: rings },
        });
      }
    }
  }
  return { type: 'FeatureCollection', features };
}

function buildMarkersGeoJson(
  markers: GisRegistryItem[],
  selectedMarkerId: string | null
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: markers.map((item) => ({
      type: 'Feature',
      properties: {
        id: item.id,
        code: item.code,
        color: statusMapHex(item.operationalStatus),
        selected: item.id === selectedMarkerId,
      },
      geometry: {
        type: 'Point',
        coordinates: [item.markerCoordinate.lon, item.markerCoordinate.lat],
      },
    })),
  };
}

function buildMapDetailsGeoJson(
  baseMapType: BaseMapType,
  activeDetails: Set<MapDetailLayer>
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  if (activeDetails.has('relief') || baseMapType === 'terrain') {
    RELIEF_PEAKS.forEach((peak) => {
      features.push({
        type: 'Feature',
        properties: { kind: 'relief_zone', elevationM: peak.elevationM },
        geometry: {
          type: 'Polygon',
          coordinates: [peak.contourRing.map((p) => [p.lon, p.lat])],
        },
      });
      features.push({
        type: 'Feature',
        properties: {
          kind: 'relief_peak',
          label: `${peak.elevationM}m`,
        },
        geometry: {
          type: 'Point',
          coordinates: [peak.point.lon, peak.point.lat],
        },
      });
    });
  }

  if (activeDetails.has('cycling')) {
    CYCLING_ROUTES.forEach((route) => {
      features.push({
        type: 'Feature',
        properties: { kind: 'cycling_route', id: route.id },
        geometry: {
          type: 'LineString',
          coordinates: route.points.map((p) => [p.lon, p.lat]),
        },
      });
    });
  }

  if (activeDetails.has('transit')) {
    TRANSIT_LINES.forEach((line) => {
      features.push({
        type: 'Feature',
        properties: {
          kind: 'transit_line',
          id: line.id,
          color: line.colorHex,
          mode: line.mode,
        },
        geometry: {
          type: 'LineString',
          coordinates: line.points.map((p) => [p.lon, p.lat]),
        },
      });
    });
    TRANSIT_STATIONS.forEach((st) => {
      features.push({
        type: 'Feature',
        properties: {
          kind: 'transit_station',
          id: st.id,
          color: st.colorHex,
          badge: st.mode === 'metro' ? 'M' : st.mode === 'rail' ? 'R' : 'B',
        },
        geometry: {
          type: 'Point',
          coordinates: [st.point.lon, st.point.lat],
        },
      });
    });
  }

  if (activeDetails.has('traffic')) {
    TRAFFIC_CORRIDORS.forEach((corridor) => {
      features.push({
        type: 'Feature',
        properties: {
          kind: 'traffic_line',
          id: corridor.id,
          color: trafficColorHex(corridor.level),
        },
        geometry: {
          type: 'LineString',
          coordinates: corridor.points.map((p) => [p.lon, p.lat]),
        },
      });
    });
  }

  if (activeDetails.has('streetView')) {
    STREET_VIEW_CORRIDORS.forEach((pts, idx) => {
      features.push({
        type: 'Feature',
        properties: { kind: 'street_view_corridor', id: `sv_corr_${idx}` },
        geometry: {
          type: 'LineString',
          coordinates: pts.map((p) => [p.lon, p.lat]),
        },
      });
    });
    STREET_VIEW_PANORAMAS.forEach((pano) => {
      features.push({
        type: 'Feature',
        properties: { kind: 'street_view_spot', id: pano.id },
        geometry: {
          type: 'Point',
          coordinates: [pano.point.lon, pano.point.lat],
        },
      });
    });
  }

  return { type: 'FeatureCollection', features };
}

function buildOverlayGeoJson(params: {
  measurePoints: GeoPoint[];
  userLocation: GeoPoint | null;
  emergencyPin: GeoPoint | null;
  activeRoutePoints: GeoPoint[];
  activeRouteWarning: boolean;
  downloadPreviewBounds: GeoBounds | null;
  savedAreaBounds: GeoBounds[];
}): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  params.savedAreaBounds.forEach((b) => {
    features.push({
      type: 'Feature',
      properties: { kind: 'saved_offline_bounds' },
      geometry: {
        type: 'Polygon',
        coordinates: [boundsToPolygonRing(b).map((p) => [p.lon, p.lat])],
      },
    });
  });
  if (params.downloadPreviewBounds) {
    features.push({
      type: 'Feature',
      properties: { kind: 'download_preview_bounds' },
      geometry: {
        type: 'Polygon',
        coordinates: [boundsToPolygonRing(params.downloadPreviewBounds).map((p) => [p.lon, p.lat])],
      },
    });
  }
  if (params.activeRoutePoints.length >= 2) {
    const routeColor = params.activeRouteWarning ? '#F59E0B' : '#10B981';
    features.push({
      type: 'Feature',
      properties: { kind: 'active_route', routeColor },
      geometry: {
        type: 'LineString',
        coordinates: params.activeRoutePoints.map((p) => [p.lon, p.lat]),
      },
    });
    const dest = params.activeRoutePoints[params.activeRoutePoints.length - 1];
    features.push({
      type: 'Feature',
      properties: { kind: 'route_dest', routeColor },
      geometry: { type: 'Point', coordinates: [dest.lon, dest.lat] },
    });
  }
  if (params.measurePoints.length >= 2) {
    features.push({
      type: 'Feature',
      properties: { kind: 'measure_line' },
      geometry: {
        type: 'LineString',
        coordinates: params.measurePoints.map((p) => [p.lon, p.lat]),
      },
    });
  }
  params.measurePoints.forEach((pt) => {
    features.push({
      type: 'Feature',
      properties: { kind: 'measure_point' },
      geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
    });
  });
  if (params.userLocation) {
    features.push({
      type: 'Feature',
      properties: { kind: 'user_gps' },
      geometry: {
        type: 'Point',
        coordinates: [params.userLocation.lon, params.userLocation.lat],
      },
    });
  }
  if (params.emergencyPin) {
    features.push({
      type: 'Feature',
      properties: { kind: 'emergency_pin' },
      geometry: {
        type: 'Point',
        coordinates: [params.emergencyPin.lon, params.emergencyPin.lat],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

interface UzbekistanRealMapViewProps {
  markers: GisRegistryItem[];
  darkTheme: boolean;
  baseMapType?: BaseMapType;
  activeDetails?: Set<MapDetailLayer>;
  exclusiveMapTap?: boolean;
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
  onTrafficCorridorTap?: (corridor: TrafficCorridor) => void;
  onTransitStopTap?: (station: TransitStopPoint) => void;
  onStreetViewTap?: (point: GeoPoint) => void;
  onMapLoadFailed: () => void;
}

const EMPTY_DETAILS = new Set<MapDetailLayer>();

export const UzbekistanRealMapView: React.FC<UzbekistanRealMapViewProps> = ({
  markers,
  darkTheme,
  baseMapType = 'standard',
  activeDetails = EMPTY_DETAILS,
  exclusiveMapTap = false,
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
  onTrafficCorridorTap,
  onTransitStopTap,
  onStreetViewTap,
  onMapLoadFailed,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const programmaticMoveRef = useRef(false);

  const propsRef = useRef({
    viewport,
    markers,
    baseMapType,
    activeDetails,
    exclusiveMapTap,
    selectedMarkerId,
    measurePoints,
    userLocation,
    emergencyPin,
    activeRoutePoints,
    activeRouteWarning,
    downloadPreviewBounds,
    savedAreaBounds,
    isTrackingLocation,
    onUserGestureStoppedTracking,
    onMarkerTap,
    onClusterTap,
    onMapTap,
    onMapLongPress,
    onTrafficCorridorTap,
    onTransitStopTap,
    onStreetViewTap,
    onViewportChange,
    onMapLoadFailed,
  });
  propsRef.current = {
    viewport,
    markers,
    baseMapType,
    activeDetails,
    exclusiveMapTap,
    selectedMarkerId,
    measurePoints,
    userLocation,
    emergencyPin,
    activeRoutePoints,
    activeRouteWarning,
    downloadPreviewBounds,
    savedAreaBounds,
    isTrackingLocation,
    onUserGestureStoppedTracking,
    onMarkerTap,
    onClusterTap,
    onMapTap,
    onMapLongPress,
    onTrafficCorridorTap,
    onTransitStopTap,
    onStreetViewTap,
    onViewportChange,
    onMapLoadFailed,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: maplibregl.Map;
    try {
      const initialVp = propsRef.current.viewport;
      map = new maplibregl.Map({
        container,
        style: resolveMapStyle(darkTheme, baseMapType),
        center: [initialVp.centerLon, initialVp.centerLat],
        zoom: canvasZoomToMapLibre(initialVp.zoom),
        minZoom: 3.5,
        maxZoom: 19.0,
        maxBounds: [
          [53.5, 35.0],
          [75.5, 47.5],
        ],
        attributionControl: false,
      });
    } catch {
      propsRef.current.onMapLoadFailed();
      return;
    }

    mapRef.current = map;

    const installLayers = () => {
      const p = propsRef.current;
      const detailsData = buildMapDetailsGeoJson(p.baseMapType, p.activeDetails);
      const geomData = buildGeometryGeoJson(p.markers);
      const markersData = buildMarkersGeoJson(p.markers, p.selectedMarkerId);
      const overlayData = buildOverlayGeoJson({
        measurePoints: p.measurePoints,
        userLocation: p.userLocation,
        emergencyPin: p.emergencyPin,
        activeRoutePoints: p.activeRoutePoints,
        activeRouteWarning: p.activeRouteWarning,
        downloadPreviewBounds: p.downloadPreviewBounds,
        savedAreaBounds: p.savedAreaBounds,
      });

      if (!map.getSource('fvv-map-details-source')) {
        map.addSource('fvv-map-details-source', { type: 'geojson', data: detailsData });
        map.addLayer({
          id: 'fvv-relief-zones-fill',
          type: 'fill',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'relief_zone'],
          paint: { 'fill-color': '#65A30D', 'fill-opacity': 0.14 },
        });
        map.addLayer({
          id: 'fvv-relief-zones-line',
          type: 'line',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'relief_zone'],
          paint: { 'line-color': '#84CC16', 'line-width': 1.5, 'line-dasharray': [4, 3] },
        });
        map.addLayer({
          id: 'fvv-relief-peaks',
          type: 'circle',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'relief_peak'],
          paint: {
            'circle-color': '#854D0E',
            'circle-radius': 5.5,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#FEF08A',
          },
        });
        map.addLayer({
          id: 'fvv-cycling-lines',
          type: 'line',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'cycling_route'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#16A34A', 'line-width': 4, 'line-dasharray': [3, 1.5] },
        });
        map.addLayer({
          id: 'fvv-transit-lines',
          type: 'line',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'transit_line'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 4.5, 'line-opacity': 0.88 },
        });
        map.addLayer({
          id: 'fvv-traffic-casing',
          type: 'line',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'traffic_line'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#0F172A', 'line-width': 7, 'line-opacity': 0.5 },
        });
        map.addLayer({
          id: 'fvv-traffic-lines',
          type: 'line',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'traffic_line'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 4.2 },
        });
        map.addLayer({
          id: 'fvv-streetview-casing',
          type: 'line',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'street_view_corridor'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#0369A1', 'line-width': 7.5, 'line-opacity': 0.55 },
        });
        map.addLayer({
          id: 'fvv-streetview-lines',
          type: 'line',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'street_view_corridor'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#38BDF8', 'line-width': 4 },
        });
        map.addLayer({
          id: 'fvv-streetview-spots',
          type: 'circle',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'street_view_spot'],
          paint: {
            'circle-color': '#0EA5E9',
            'circle-radius': 6.5,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF',
          },
        });
        map.addLayer({
          id: 'fvv-transit-stops',
          type: 'circle',
          source: 'fvv-map-details-source',
          filter: ['==', ['get', 'kind'], 'transit_station'],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
          },
        });
      }

      if (!map.getSource('fvv-geometries-source')) {
        map.addSource('fvv-geometries-source', { type: 'geojson', data: geomData });
        map.addLayer({
          id: 'fvv-polygons-layer',
          type: 'fill',
          source: 'fvv-geometries-source',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.24 },
        });
        map.addLayer({
          id: 'fvv-lines-layer',
          type: 'line',
          source: 'fvv-geometries-source',
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'color'], 'line-width': 3.5 },
        });
      }

      if (!map.getSource('fvv-markers-source')) {
        map.addSource('fvv-markers-source', {
          type: 'geojson',
          data: markersData,
          cluster: true,
          clusterRadius: 36,
          clusterMaxZoom: 9.5,
        });
        map.addLayer({
          id: 'fvv-clusters-halo',
          type: 'circle',
          source: 'fvv-markers-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#0D9488',
            'circle-opacity': 0.25,
            'circle-radius': ['step', ['get', 'point_count'], 22, 5, 26, 15, 30],
          },
        });
        map.addLayer({
          id: 'fvv-clusters-circle',
          type: 'circle',
          source: 'fvv-markers-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': ['step', ['get', 'point_count'], '#0D9488', 5, '#0284C7', 15, '#D97706'],
            'circle-radius': ['step', ['get', 'point_count'], 16, 5, 19, 15, 22],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF',
          },
        });
        map.addLayer({
          id: 'fvv-clusters-count',
          type: 'symbol',
          source: 'fvv-markers-source',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['to-string', ['get', 'point_count']],
            'text-size': 13,
            'text-ignore-placement': true,
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#FFFFFF' },
        });
        map.addLayer({
          id: 'fvv-unclustered-markers',
          type: 'circle',
          source: 'fvv-markers-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['case', ['==', ['get', 'selected'], true], 11, 7.5],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF',
          },
        });
      }

      if (!map.getSource('fvv-overlay-source')) {
        map.addSource('fvv-overlay-source', { type: 'geojson', data: overlayData });
        map.addLayer({
          id: 'fvv-offline-saved-fill',
          type: 'fill',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'saved_offline_bounds'],
          paint: { 'fill-color': '#10B981', 'fill-opacity': 0.08 },
        });
        map.addLayer({
          id: 'fvv-offline-saved-line',
          type: 'line',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'saved_offline_bounds'],
          paint: { 'line-color': '#10B981', 'line-width': 1.5, 'line-dasharray': [4, 3] },
        });
        map.addLayer({
          id: 'fvv-offline-preview-fill',
          type: 'fill',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'download_preview_bounds'],
          paint: { 'fill-color': '#0EA5E9', 'fill-opacity': 0.16 },
        });
        map.addLayer({
          id: 'fvv-offline-preview-line',
          type: 'line',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'download_preview_bounds'],
          paint: { 'line-color': '#0284C7', 'line-width': 2.8, 'line-dasharray': [3, 2] },
        });
        map.addLayer({
          id: 'fvv-active-route-casing',
          type: 'line',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'active_route'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#081320', 'line-width': 8.5 },
        });
        map.addLayer({
          id: 'fvv-active-route-line',
          type: 'line',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'active_route'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': ['get', 'routeColor'], 'line-width': 4.5 },
        });
        map.addLayer({
          id: 'fvv-active-route-dest',
          type: 'circle',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'route_dest'],
          paint: {
            'circle-color': ['get', 'routeColor'],
            'circle-radius': 10,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#FFFFFF',
          },
        });
        map.addLayer({
          id: 'fvv-measure-line-layer',
          type: 'line',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'measure_line'],
          paint: { 'line-color': '#0EA5E9', 'line-width': 3, 'line-dasharray': [3, 2] },
        });
        map.addLayer({
          id: 'fvv-measure-points-layer',
          type: 'circle',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'measure_point'],
          paint: {
            'circle-color': '#F59E0B',
            'circle-radius': 6.5,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF',
          },
        });
        map.addLayer({
          id: 'fvv-gps-halo-layer',
          type: 'circle',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'user_gps'],
          paint: { 'circle-color': '#06B6D4', 'circle-opacity': 0.28, 'circle-radius': 18 },
        });
        map.addLayer({
          id: 'fvv-gps-dot-layer',
          type: 'circle',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'user_gps'],
          paint: {
            'circle-color': '#0284C7',
            'circle-radius': 7,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FFFFFF',
          },
        });
        map.addLayer({
          id: 'fvv-emergency-pin-halo-layer',
          type: 'circle',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'emergency_pin'],
          paint: { 'circle-color': '#DC2626', 'circle-opacity': 0.32, 'circle-radius': 24 },
        });
        map.addLayer({
          id: 'fvv-emergency-pin-core-layer',
          type: 'circle',
          source: 'fvv-overlay-source',
          filter: ['==', ['get', 'kind'], 'emergency_pin'],
          paint: {
            'circle-color': '#DC2626',
            'circle-radius': 10.5,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#FFFFFF',
          },
        });
      }
      setStyleLoaded(true);
    };

    map.on('style.load', installLayers);
    map.on('error', () => {
      if (!map.isStyleLoaded()) {
        propsRef.current.onMapLoadFailed();
      }
    });

    map.on('dragstart', () => {
      if (propsRef.current.isTrackingLocation) {
        propsRef.current.onUserGestureStoppedTracking();
      }
    });

    map.on('moveend', () => {
      if (programmaticMoveRef.current) {
        programmaticMoveRef.current = false;
        return;
      }
      const c = map.getCenter();
      propsRef.current.onViewportChange({
        centerLat: c.lat,
        centerLon: c.lng,
        zoom: mapLibreZoomToCanvas(map.getZoom()),
      });
    });

    map.on('click', (e) => {
      const p = propsRef.current;
      if (p.exclusiveMapTap && p.onMapTap) {
        p.onMapTap({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        return;
      }

      // Check markers first
      if (map.getLayer('fvv-unclustered-markers')) {
        const hits = map.queryRenderedFeatures(e.point, { layers: ['fvv-unclustered-markers'] });
        const hitId = hits[0]?.properties?.id as string | undefined;
        if (hitId) {
          const found = p.markers.find((m) => m.id === hitId);
          if (found) {
            p.onMarkerTap(found);
            return;
          }
        }
      }

      // Check clusters
      if (map.getLayer('fvv-clusters-circle')) {
        const clusters = map.queryRenderedFeatures(e.point, { layers: ['fvv-clusters-circle'] });
        const clusterFeat = clusters[0];
        if (clusterFeat) {
          const camZoom = map.getZoom();
          const count = Number(clusterFeat.properties?.point_count ?? 2);
          if (camZoom < 12.5) {
            map.easeTo({
              center: e.lngLat,
              zoom: Math.min(15.0, camZoom + 2.4),
              duration: 380,
            });
          } else {
            const nearby = [...p.markers]
              .sort((a, b) => {
                const da =
                  (a.markerCoordinate.lat - e.lngLat.lat) ** 2 +
                  (a.markerCoordinate.lon - e.lngLat.lng) ** 2;
                const db =
                  (b.markerCoordinate.lat - e.lngLat.lat) ** 2 +
                  (b.markerCoordinate.lon - e.lngLat.lng) ** 2;
                return da - db;
              })
              .slice(0, Math.max(2, count));
            if (nearby.length > 0) {
              p.onClusterTap({
                id: `ml_cluster_${e.lngLat.lat}_${e.lngLat.lng}`,
                center: { lat: e.lngLat.lat, lon: e.lngLat.lng },
                items: nearby,
              });
            }
          }
          return;
        }
      }

      // If Street View mode is active, clicking the map opens 360 Street View at that spot
      if (p.activeDetails.has('streetView') && p.onStreetViewTap) {
        p.onStreetViewTap({ lat: e.lngLat.lat, lon: e.lngLat.lng });
        return;
      }

      // Check transit station click
      if (p.onTransitStopTap && map.getLayer('fvv-transit-stops')) {
        const stHits = map.queryRenderedFeatures(e.point, { layers: ['fvv-transit-stops'] });
        const stId = stHits[0]?.properties?.id as string | undefined;
        if (stId) {
          const st = TRANSIT_STATIONS.find((s) => s.id === stId);
          if (st) {
            p.onTransitStopTap(st);
            return;
          }
        }
      }

      // Check traffic corridor click
      if (p.onTrafficCorridorTap && map.getLayer('fvv-traffic-lines')) {
        const trHits = map.queryRenderedFeatures(e.point, { layers: ['fvv-traffic-lines'] });
        const trId = trHits[0]?.properties?.id as string | undefined;
        if (trId) {
          const corr = TRAFFIC_CORRIDORS.find((c) => c.id === trId);
          if (corr) {
            p.onTrafficCorridorTap(corr);
            return;
          }
        }
      }

      if (p.onMapTap) {
        p.onMapTap({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      }
    });

    map.on('contextmenu', (e) => {
      if (propsRef.current.onMapLongPress) {
        e.preventDefault();
        propsRef.current.onMapLongPress({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      }
    });

    return () => {
      setStyleLoaded(false);
      map.remove();
      mapRef.current = null;
    };
  }, [darkTheme, baseMapType]);

  // Update GeoJSON data whenever layers or activeDetails change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    const detailsSrc = map.getSource('fvv-map-details-source') as
      | maplibregl.GeoJSONSource
      | undefined;
    const geomSrc = map.getSource('fvv-geometries-source') as maplibregl.GeoJSONSource | undefined;
    const markerSrc = map.getSource('fvv-markers-source') as maplibregl.GeoJSONSource | undefined;
    const overlaySrc = map.getSource('fvv-overlay-source') as maplibregl.GeoJSONSource | undefined;
    detailsSrc?.setData(buildMapDetailsGeoJson(baseMapType, activeDetails));
    geomSrc?.setData(buildGeometryGeoJson(markers));
    markerSrc?.setData(buildMarkersGeoJson(markers, selectedMarkerId));
    overlaySrc?.setData(
      buildOverlayGeoJson({
        measurePoints,
        userLocation,
        emergencyPin,
        activeRoutePoints,
        activeRouteWarning,
        downloadPreviewBounds,
        savedAreaBounds,
      })
    );
  }, [
    styleLoaded,
    baseMapType,
    activeDetails,
    markers,
    selectedMarkerId,
    measurePoints,
    userLocation,
    emergencyPin,
    activeRoutePoints,
    activeRouteWarning,
    downloadPreviewBounds,
    savedAreaBounds,
  ]);

  // Sync programmatic viewport moves
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const camCenter = map.getCenter();
    const camZoom = map.getZoom();
    const desiredZoom = canvasZoomToMapLibre(viewport.zoom);
    const sameTarget =
      Math.abs(camCenter.lat - viewport.centerLat) < 0.0004 &&
      Math.abs(camCenter.lng - viewport.centerLon) < 0.0004 &&
      Math.abs(camZoom - desiredZoom) < 0.08;
    if (!sameTarget) {
      programmaticMoveRef.current = true;
      map.easeTo({
        center: [viewport.centerLon, viewport.centerLat],
        zoom: desiredZoom,
        duration: 320,
      });
    }
  }, [viewport.centerLat, viewport.centerLon, viewport.zoom]);

  return <div ref={containerRef} className="w-full h-full" />;
};
