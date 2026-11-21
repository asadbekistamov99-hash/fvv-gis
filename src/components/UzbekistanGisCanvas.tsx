import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BaseMapType,
  GeoBounds,
  GeoPoint,
  GisRegistryItem,
  InfrastructureObjectEntity,
  MapDetailLayer,
  MapViewport,
  MarkerCluster,
  ParsedGeometry,
  RegionEntity,
  TrafficCorridor,
  TransitStopPoint,
  getClusterWorstStatus,
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
import { GeoUtils, localizedRegionName, representativePoint } from '../core/geoUtils';
import { boundsToPolygonRing } from '../core/offlineMapManager';
import { GisColors, statusColor } from '../theme/colors';

function projectGeoPoint(
  pt: GeoPoint,
  width: number,
  height: number,
  vp: MapViewport
): { x: number; y: number } {
  if (width === 0 || height === 0) return { x: 0, y: 0 };
  const baseLonSpan = 18.5;
  const pxPerDegLon = (width / baseLonSpan) * vp.zoom;
  const cosLat = 0.75;
  const pxPerDegLat = pxPerDegLon / cosLat;
  const x = width / 2 + (pt.lon - vp.centerLon) * pxPerDegLon;
  const y = height / 2 - (pt.lat - vp.centerLat) * pxPerDegLat;
  return { x, y };
}

function unprojectOffset(
  x: number,
  y: number,
  width: number,
  height: number,
  vp: MapViewport
): GeoPoint {
  if (width === 0 || height === 0) return { lat: 41.299, lon: 69.24 };
  const baseLonSpan = 18.5;
  const pxPerDegLon = (width / baseLonSpan) * vp.zoom;
  const cosLat = 0.75;
  const pxPerDegLat = pxPerDegLon / cosLat;
  const lon = vp.centerLon + (x - width / 2) / pxPerDegLon;
  const lat = vp.centerLat - (y - height / 2) / pxPerDegLat;
  return {
    lat: Math.max(35.0, Math.min(48.0, lat)),
    lon: Math.max(53.0, Math.min(76.0, lon)),
  };
}

function clusterMarkersByProximity(
  markers: GisRegistryItem[],
  width: number,
  height: number,
  viewport: MapViewport,
  clusterRadiusPx: number
): MarkerCluster[] {
  if (markers.length === 0) return [];
  if (width === 0 || height === 0 || viewport.zoom >= 14 || clusterRadiusPx <= 0) {
    return markers.map((item) => ({
      id: item.id,
      center: item.markerCoordinate,
      items: [item],
    }));
  }

  const buckets: { anchor: { x: number; y: number }; items: GisRegistryItem[] }[] = [];
  for (const item of markers) {
    const pos = projectGeoPoint(item.markerCoordinate, width, height, viewport);
    let targetIndex = -1;
    let bestDist = clusterRadiusPx;
    for (let i = 0; i < buckets.length; i++) {
      const anchor = buckets[i].anchor;
      const d = Math.hypot(pos.x - anchor.x, pos.y - anchor.y);
      if (d <= bestDist) {
        bestDist = d;
        targetIndex = i;
      }
    }
    if (targetIndex >= 0) {
      buckets[targetIndex].items.push(item);
    } else {
      buckets.push({ anchor: pos, items: [item] });
    }
  }

  return buckets.map((bucket, idx) => {
    const avgLat = bucket.items.reduce((s, m) => s + m.markerCoordinate.lat, 0) / bucket.items.length;
    const avgLon = bucket.items.reduce((s, m) => s + m.markerCoordinate.lon, 0) / bucket.items.length;
    return {
      id:
        bucket.items.length === 1
          ? bucket.items[0].id
          : `cluster_${idx}_${bucket.items[0].id}`,
      center: { lat: avgLat, lon: avgLon },
      items: bucket.items,
    };
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const EMPTY_DETAILS = new Set<MapDetailLayer>();

interface UzbekistanGisCanvasProps {
  objects?: InfrastructureObjectEntity[];
  markers?: GisRegistryItem[];
  regions: RegionEntity[];
  localeCode: string;
  darkTheme: boolean;
  baseMapType?: BaseMapType;
  activeDetails?: Set<MapDetailLayer>;
  exclusiveMapTap?: boolean;
  viewport: MapViewport;
  onViewportChange: (vp: MapViewport) => void;
  measurePoints?: GeoPoint[];
  routePoints?: GeoPoint[];
  routeIsWarning?: boolean;
  pickedVertices?: GeoPoint[];
  userLocation?: GeoPoint | null;
  emergencyPin?: GeoPoint | null;
  downloadPreviewBounds?: GeoBounds | null;
  savedAreaBounds?: GeoBounds[];
  selectedObjectId?: string | null;
  onFeatureTap?: (obj: InfrastructureObjectEntity) => void;
  onMarkerTap?: (marker: GisRegistryItem) => void;
  onClusterTap?: (cluster: MarkerCluster) => void;
  onMapTap?: (pt: GeoPoint) => void;
  onMapLongPress?: (pt: GeoPoint) => void;
  onTrafficCorridorTap?: (corridor: TrafficCorridor) => void;
  onTransitStopTap?: (station: TransitStopPoint) => void;
  onStreetViewTap?: (pt: GeoPoint) => void;
  className?: string;
}

export const UzbekistanGisCanvas: React.FC<UzbekistanGisCanvasProps> = ({
  objects = [],
  markers = [],
  regions,
  localeCode,
  darkTheme,
  baseMapType = 'standard',
  activeDetails = EMPTY_DETAILS,
  exclusiveMapTap = false,
  viewport,
  onViewportChange,
  measurePoints = [],
  routePoints = [],
  routeIsWarning = false,
  pickedVertices = [],
  userLocation = null,
  emergencyPin = null,
  downloadPreviewBounds = null,
  savedAreaBounds = [],
  selectedObjectId = null,
  onFeatureTap,
  onMarkerTap,
  onClusterTap,
  onMapTap,
  onMapLongPress,
  onTrafficCorridorTap,
  onTransitStopTap,
  onStreetViewTap,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    longPressTimer: number | null;
    longPressed: boolean;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    longPressTimer: null,
    longPressed: false,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        setSize({ width: Math.floor(cr.width), height: Math.floor(cr.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const parsedObjects = useMemo(
    () =>
      objects
        .map((obj) => {
          const geom = GeoUtils.parseGeoJson(obj.geometryJson);
          return geom ? { obj, geom } : null;
        })
        .filter((x): x is { obj: InfrastructureObjectEntity; geom: ParsedGeometry } => x !== null),
    [objects]
  );

  const clusters = useMemo(
    () => clusterMarkersByProximity(markers, size.width, size.height, viewport, 46),
    [markers, size.width, size.height, viewport]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = size.width;
    const h = size.height;

    const isSatellite = baseMapType === 'satellite';
    const isRelief = baseMapType === 'terrain' || activeDetails.has('relief');

    const bgColor = isSatellite
      ? '#0D1B17'
      : isRelief
      ? darkTheme
        ? '#0D1E1B'
        : '#E4ECE3'
      : darkTheme
      ? '#091826'
      : '#E6EEF4';
    const gridColor = isSatellite
      ? '#1E3A30'
      : darkTheme
      ? '#17314A'
      : '#CBDAE6';
    const landFill = isSatellite
      ? '#1A2E25'
      : isRelief
      ? darkTheme
        ? '#142923'
        : '#EEF3E7'
      : darkTheme
      ? '#102438'
      : '#F5F9FC';
    const borderColor = isSatellite
      ? '#34D399'
      : darkTheme
      ? '#2D6580'
      : '#5D89A3';
    const waterFill = isSatellite ? '#0A314A' : darkTheme ? '#0C344D' : '#C5E3F5';
    const labelColor = isSatellite ? '#CBD5E1' : darkTheme ? '#8BB7CE' : '#395B72';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Coordinate Graticule
    const lonStep = viewport.zoom > 6 ? 0.5 : viewport.zoom > 2.5 ? 1.0 : 2.0;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let lon = 54.0; lon <= 75.0; lon += lonStep) {
      const x = projectGeoPoint({ lat: 41.0, lon }, w, h, viewport).x;
      if (x >= -50 && x <= w + 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }
    for (let lat = 36.0; lat <= 46.5; lat += lonStep) {
      const y = projectGeoPoint({ lat, lon: 64.0 }, w, h, viewport).y;
      if (y >= -50 && y <= h + 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    // Uzbekistan boundary
    ctx.beginPath();
    GeoUtils.uzbekistanBorder.forEach((pt, idx) => {
      const p = projectGeoPoint(pt, w, h, viewport);
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = landFill;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Satellite terrain mosaic blocks when in offline satellite mode
    if (isSatellite) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const yBand = (h / 8) * i;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(52, 211, 153, 0.03)' : 'rgba(234, 179, 8, 0.025)';
        ctx.fillRect(0, yBand, w, h / 16);
      }
      ctx.restore();
    }

    // Water bodies (Aral & Aydar Lake)
    [GeoUtils.aralContour, GeoUtils.aydarLakeContour].forEach((poly) => {
      ctx.beginPath();
      poly.forEach((pt, idx) => {
        const p = projectGeoPoint(pt, w, h, viewport);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = waterFill;
      ctx.fill();
      ctx.strokeStyle = hexToRgba(borderColor, 0.5);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // Topographic Relief Contours & Peaks
    if (isRelief) {
      RELIEF_PEAKS.forEach((peak) => {
        ctx.beginPath();
        peak.contourRing.forEach((pt, idx) => {
          const p = projectGeoPoint(pt, w, h, viewport);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(132, 204, 22, 0.14)';
        ctx.fill();
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(132, 204, 22, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        const pp = projectGeoPoint(peak.point, w, h, viewport);
        if (pp.x >= -40 && pp.x <= w + 40 && pp.y >= -40 && pp.y <= h + 40) {
          ctx.fillStyle = '#CA8A04';
          ctx.beginPath();
          ctx.moveTo(pp.x, pp.y - 6);
          ctx.lineTo(pp.x - 5, pp.y + 4);
          ctx.lineTo(pp.x + 5, pp.y + 4);
          ctx.closePath();
          ctx.fill();
          ctx.font = '700 10px "Noto Sans", sans-serif';
          ctx.fillStyle = darkTheme || isSatellite ? '#FEF08A' : '#713F12';
          ctx.fillText(`▲ ${peak.elevationM}m`, pp.x + 7, pp.y + 3);
        }
      });
    }

    // Cycling routes overlay
    if (activeDetails.has('cycling')) {
      CYCLING_ROUTES.forEach((route) => {
        ctx.beginPath();
        route.points.forEach((pt, idx) => {
          const p = projectGeoPoint(pt, w, h, viewport);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.save();
        ctx.setLineDash([7, 4]);
        ctx.strokeStyle = '#16A34A';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      });
    }

    // Public Transit lines & stations
    if (activeDetails.has('transit')) {
      TRANSIT_LINES.forEach((line) => {
        ctx.beginPath();
        line.points.forEach((pt, idx) => {
          const p = projectGeoPoint(pt, w, h, viewport);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = line.colorHex;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      });
      TRANSIT_STATIONS.forEach((st) => {
        const sp = projectGeoPoint(st.point, w, h, viewport);
        if (sp.x < -30 || sp.x > w + 30 || sp.y < -30 || sp.y > h + 30) return;
        ctx.fillStyle = st.colorHex;
        ctx.beginPath();
        ctx.roundRect(sp.x - 7, sp.y - 7, 14, 14, 4);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 9px "Noto Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(st.mode === 'metro' ? 'M' : 'R', sp.x, sp.y + 0.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      });
    }

    // Traffic corridors overlay
    if (activeDetails.has('traffic')) {
      TRAFFIC_CORRIDORS.forEach((corr) => {
        ctx.beginPath();
        corr.points.forEach((pt, idx) => {
          const p = projectGeoPoint(pt, w, h, viewport);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(15,23,42,0.55)';
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.strokeStyle = trafficColorHex(corr.level);
        ctx.lineWidth = 4.2;
        ctx.stroke();
      });
    }

    // Street View blue coverage corridors & spots
    if (activeDetails.has('streetView')) {
      STREET_VIEW_CORRIDORS.forEach((pts) => {
        ctx.beginPath();
        pts.forEach((pt, idx) => {
          const p = projectGeoPoint(pt, w, h, viewport);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(3, 105, 161, 0.55)';
        ctx.lineWidth = 7.5;
        ctx.stroke();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 4;
        ctx.stroke();
      });
      STREET_VIEW_PANORAMAS.forEach((pano) => {
        const p = projectGeoPoint(pano.point, w, h, viewport);
        if (p.x < -30 || p.x > w + 30 || p.y < -30 || p.y > h + 30) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#0EA5E9';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Regional centers & labels
    ctx.font = '500 10px "Noto Sans", sans-serif';
    regions.forEach((region) => {
      const p = projectGeoPoint({ lat: region.centerLat, lon: region.centerLon }, w, h, viewport);
      if (p.x >= -40 && p.x <= w + 40 && p.y >= -40 && p.y <= h + 40) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(borderColor, 0.5);
        ctx.fill();
        ctx.fillStyle = labelColor;
        const shortName = localizedRegionName(region, localeCode).split(' ')[0];
        ctx.fillText(shortName, p.x + 6, p.y - 4);
      }
    });

    const drawSpatialGeometry = (geom: ParsedGeometry, color: string, isSelected: boolean) => {
      if (geom.type === 'Polygon') {
        geom.rings.forEach((ring) => {
          ctx.beginPath();
          ring.forEach((pt, idx) => {
            const p = projectGeoPoint(pt, w, h, viewport);
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fillStyle = hexToRgba(color, 0.26);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = isSelected ? 3.5 : 2;
          ctx.stroke();
        });
      } else if (geom.type === 'LineString') {
        ctx.beginPath();
        geom.points.forEach((pt, idx) => {
          const p = projectGeoPoint(pt, w, h, viewport);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = isSelected ? 6 : 3.8;
        ctx.stroke();
      }
    };

    if (clusters.length > 0) {
      if (viewport.zoom >= 2.2) {
        markers.forEach((marker) => {
          drawSpatialGeometry(
            marker.parsedGeometry,
            statusColor(marker.operationalStatus),
            marker.id === selectedObjectId
          );
        });
      }

      clusters.forEach((cluster) => {
        const p = projectGeoPoint(cluster.center, w, h, viewport);
        if (p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) return;

        if (cluster.items.length > 1) {
          const hasSelected = cluster.items.some((it) => it.id === selectedObjectId);
          const cColor = statusColor(getClusterWorstStatus(cluster.items));
          const extra = Math.min(cluster.items.length, 20) * 0.35;
          const outerR = 18 + extra;
          const ringR = 15.5 + extra;
          const coreR = 13 + extra;

          ctx.beginPath();
          ctx.arc(p.x, p.y, outerR, 0, Math.PI * 2);
          ctx.fillStyle = hexToRgba(cColor, hasSelected ? 0.35 : 0.22);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
          ctx.fillStyle = darkTheme ? '#081320' : '#FFFFFF';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
          ctx.fillStyle = cColor;
          ctx.fill();

          ctx.fillStyle = '#081320';
          ctx.font = '800 11px "Noto Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(cluster.items.length), p.x, p.y + 0.5);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        } else {
          const marker = cluster.items[0];
          const color = statusColor(marker.operationalStatus);
          const isSelected = marker.id === selectedObjectId;

          if (isSelected) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(color, 0.28);
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(p.x, p.y, isSelected ? 9.5 : 7.2, 0, Math.PI * 2);
          ctx.fillStyle = darkTheme ? '#081320' : '#FFFFFF';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, isSelected ? 7.5 : 5.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, isSelected ? 2.5 : 1.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          ctx.fill();

          if (isSelected || viewport.zoom >= 3.0) {
            ctx.font = '700 10px "Noto Sans", sans-serif';
            const tw = ctx.measureText(marker.code).width;
            const boxLeft = p.x + 11;
            const boxTop = p.y - 10;
            const bw = tw + 10;
            const bh = 20;
            ctx.fillStyle = darkTheme ? 'rgba(14,35,54,0.92)' : 'rgba(255,255,255,0.94)';
            ctx.beginPath();
            ctx.roundRect(boxLeft, boxTop, bw, bh, 6);
            ctx.fill();
            ctx.fillStyle = darkTheme ? '#F3F8FB' : '#0D2030';
            ctx.fillText(marker.code, boxLeft + 5, boxTop + 13);
          }
        }
      });
    } else {
      parsedObjects.forEach(({ obj, geom }) => {
        const color = statusColor(obj.operationalStatus);
        const isSelected = obj.id === selectedObjectId;
        if (geom.type === 'Point') {
          const p = projectGeoPoint(geom.point, w, h, viewport);
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(color, 0.28);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, isSelected ? 8.5 : 7, 0, Math.PI * 2);
          ctx.fillStyle = '#081320';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, isSelected ? 6.8 : 5.3, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          drawSpatialGeometry(geom, color, isSelected);
        }
      });
    }

    // Saved offline area bounds
    savedAreaBounds.forEach((b) => {
      const ring = boundsToPolygonRing(b);
      ctx.beginPath();
      ring.forEach((pt, idx) => {
        const p = projectGeoPoint(pt, w, h, viewport);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = hexToRgba(GisColors.StatusWorking, 0.08);
      ctx.fill();
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = hexToRgba(GisColors.StatusWorking, 0.7);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    });

    if (downloadPreviewBounds) {
      const ring = boundsToPolygonRing(downloadPreviewBounds);
      ctx.beginPath();
      ring.forEach((pt, idx) => {
        const p = projectGeoPoint(pt, w, h, viewport);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = hexToRgba(GisColors.CyanAccent, 0.16);
      ctx.fill();
      ctx.save();
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = GisColors.CyanAccent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // Active Route overlay
    if (routePoints.length >= 2) {
      const routeColor = routeIsWarning ? GisColors.StatusMaintenance : GisColors.StatusWorking;
      ctx.beginPath();
      routePoints.forEach((pt, idx) => {
        const p = projectGeoPoint(pt, w, h, viewport);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#081320';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = routeColor;
      ctx.lineWidth = 5;
      ctx.stroke();

      const endP = projectGeoPoint(routePoints[routePoints.length - 1], w, h, viewport);
      ctx.beginPath();
      ctx.arc(endP.x, endP.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(endP.x, endP.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = routeColor;
      ctx.fill();
    }

    // Picked vertices (ObjectForm geometry picker)
    if (pickedVertices.length > 0) {
      if (pickedVertices.length >= 2) {
        ctx.beginPath();
        pickedVertices.forEach((pt, idx) => {
          const p = projectGeoPoint(pt, w, h, viewport);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = GisColors.CyanAccent;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
      pickedVertices.forEach((pt) => {
        const p = projectGeoPoint(pt, w, h, viewport);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = GisColors.DeepTeal;
        ctx.fill();
      });
    }

    // Measure distance overlay
    if (measurePoints.length > 0) {
      if (measurePoints.length >= 2) {
        ctx.beginPath();
        measurePoints.forEach((pt, idx) => {
          const p = projectGeoPoint(pt, w, h, viewport);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.save();
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = darkTheme ? '#FFFFFF' : GisColors.LightInk;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
      measurePoints.forEach((pt) => {
        const p = projectGeoPoint(pt, w, h, viewport);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = GisColors.StatusMaintenance;
        ctx.fill();
      });
    }

    // User GPS pin
    if (userLocation) {
      const up = projectGeoPoint(userLocation, w, h, viewport);
      ctx.beginPath();
      ctx.arc(up.x, up.y, 16, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(GisColors.CyanAccent, 0.25);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(up.x, up.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(up.x, up.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = GisColors.DeepTeal;
      ctx.fill();
    }

    // Emergency incident pin
    if (emergencyPin) {
      const ep = projectGeoPoint(emergencyPin, w, h, viewport);
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(GisColors.StatusFaulty, 0.26);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ep.x, ep.y, 16, 0, Math.PI * 2);
      ctx.strokeStyle = GisColors.StatusFaulty;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(ep.x, ep.y, 11, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ep.x, ep.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = GisColors.StatusFaulty;
      ctx.fill();
    }
  }, [
    size,
    darkTheme,
    baseMapType,
    activeDetails,
    viewport,
    regions,
    localeCode,
    clusters,
    markers,
    parsedObjects,
    selectedObjectId,
    savedAreaBounds,
    downloadPreviewBounds,
    routePoints,
    routeIsWarning,
    pickedVertices,
    measurePoints,
    userLocation,
    emergencyPin,
  ]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (dragStateRef.current.longPressTimer !== null) {
      window.clearTimeout(dragStateRef.current.longPressTimer);
    }
    const timer = onMapLongPress
      ? window.setTimeout(() => {
          if (!dragStateRef.current.moved) {
            dragStateRef.current.longPressed = true;
            const geo = unprojectOffset(x, y, size.width, size.height, viewport);
            onMapLongPress(geo);
          }
        }, 520)
      : null;

    dragStateRef.current = {
      active: true,
      moved: false,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      longPressTimer: timer,
      longPressed: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ds = dragStateRef.current;
    if (!ds.active) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (Math.hypot(x - ds.startX, y - ds.startY) > 6) {
      ds.moved = true;
      if (ds.longPressTimer !== null) {
        window.clearTimeout(ds.longPressTimer);
        ds.longPressTimer = null;
      }
    }
    if (ds.moved) {
      const dx = x - ds.lastX;
      const dy = y - ds.lastY;
      ds.lastX = x;
      ds.lastY = y;
      const baseLonSpan = 18.5;
      const pxPerDegLon = (Math.max(1, size.width) / baseLonSpan) * viewport.zoom;
      const pxPerDegLat = pxPerDegLon / 0.75;
      const newLon = Math.max(55.0, Math.min(74.0, viewport.centerLon - dx / pxPerDegLon));
      const newLat = Math.max(36.5, Math.min(46.0, viewport.centerLat + dy / pxPerDegLat));
      onViewportChange({ ...viewport, centerLat: newLat, centerLon: newLon });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ds = dragStateRef.current;
    if (ds.longPressTimer !== null) {
      window.clearTimeout(ds.longPressTimer);
      ds.longPressTimer = null;
    }
    const wasTap = ds.active && !ds.moved && !ds.longPressed;
    ds.active = false;
    if (!wasTap) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const tappedGeo = unprojectOffset(x, y, size.width, size.height, viewport);

    if (exclusiveMapTap && onMapTap) {
      onMapTap(tappedGeo);
      return;
    }

    if ((onMarkerTap || onClusterTap) && clusters.length > 0) {
      let closest: MarkerCluster | null = null;
      let bestDist = 28;
      for (const cluster of clusters) {
        const pos = projectGeoPoint(cluster.center, size.width, size.height, viewport);
        const dist = Math.hypot(pos.x - x, pos.y - y);
        if (dist < bestDist) {
          bestDist = dist;
          closest = cluster;
        }
      }
      if (closest) {
        if (closest.items.length > 1) {
          onClusterTap?.(closest);
        } else {
          onMarkerTap?.(closest.items[0]);
        }
        return;
      }
    }

    if (activeDetails.has('streetView') && onStreetViewTap) {
      onStreetViewTap(tappedGeo);
      return;
    }

    if (activeDetails.has('transit') && onTransitStopTap) {
      let closestStop: TransitStopPoint | null = null;
      let bestDist = 24;
      for (const st of TRANSIT_STATIONS) {
        const pos = projectGeoPoint(st.point, size.width, size.height, viewport);
        const dist = Math.hypot(pos.x - x, pos.y - y);
        if (dist < bestDist) {
          bestDist = dist;
          closestStop = st;
        }
      }
      if (closestStop) {
        onTransitStopTap(closestStop);
        return;
      }
    }

    if (activeDetails.has('traffic') && onTrafficCorridorTap) {
      let closestCorr: TrafficCorridor | null = null;
      let bestDist = 22;
      for (const corr of TRAFFIC_CORRIDORS) {
        for (const pt of corr.points) {
          const pos = projectGeoPoint(pt, size.width, size.height, viewport);
          const dist = Math.hypot(pos.x - x, pos.y - y);
          if (dist < bestDist) {
            bestDist = dist;
            closestCorr = corr;
          }
        }
      }
      if (closestCorr) {
        onTrafficCorridorTap(closestCorr);
        return;
      }
    }

    if (onFeatureTap && parsedObjects.length > 0) {
      let closestObj: InfrastructureObjectEntity | null = null;
      let bestDist = 26;
      for (const { obj, geom } of parsedObjects) {
        const pos = projectGeoPoint(representativePoint(geom), size.width, size.height, viewport);
        const dist = Math.hypot(pos.x - x, pos.y - y);
        if (dist < bestDist) {
          bestDist = dist;
          closestObj = obj;
        }
      }
      if (closestObj) {
        onFeatureTap(closestObj);
        return;
      }
    }

    if (onMapTap) {
      onMapTap(tappedGeo);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onMapLongPress) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onMapLongPress(unprojectOffset(x, y, size.width, size.height, viewport));
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const nextZoom = Math.max(0.75, Math.min(40, viewport.zoom * factor));
    onViewportChange({ ...viewport, zoom: nextZoom });
  };

  return (
    <div ref={containerRef} className={`relative w-full h-full select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          if (dragStateRef.current.longPressTimer !== null) {
            window.clearTimeout(dragStateRef.current.longPressTimer);
          }
          dragStateRef.current.active = false;
        }}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};
