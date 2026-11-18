import { GeoBounds, GeoPoint, MapViewport, RegionEntity } from '../types/gis';

export type TileDetailPresetId = 'OVERVIEW' | 'CITY' | 'STREET';

export interface TileDetailPreset {
  id: TileDetailPresetId;
  minZoom: number;
  maxZoom: number;
  labelKey: string;
}

export const TILE_DETAIL_PRESETS: TileDetailPreset[] = [
  { id: 'OVERVIEW', minZoom: 6.0, maxZoom: 11.0, labelKey: 'detailOverview' },
  { id: 'CITY', minZoom: 8.0, maxZoom: 14.0, labelKey: 'detailCity' },
  { id: 'STREET', minZoom: 10.0, maxZoom: 15.0, labelKey: 'detailStreet' },
];

export interface OfflineAreaRecord {
  id: number;
  name: string;
  bounds: GeoBounds;
  minZoom: number;
  maxZoom: number;
  completedResources: number;
  requiredResources: number;
  completedBytes: number;
  isComplete: boolean;
  isActive: boolean;
  errorMessage?: string | null;
}

export function boundsCenter(bounds: GeoBounds): GeoPoint {
  return {
    lat: (bounds.northLat + bounds.southLat) / 2.0,
    lon: (bounds.eastLon + bounds.westLon) / 2.0,
  };
}

export function boundsToPolygonRing(bounds: GeoBounds): GeoPoint[] {
  return [
    { lat: bounds.northLat, lon: bounds.westLon },
    { lat: bounds.northLat, lon: bounds.eastLon },
    { lat: bounds.southLat, lon: bounds.eastLon },
    { lat: bounds.southLat, lon: bounds.westLon },
    { lat: bounds.northLat, lon: bounds.westLon },
  ];
}

function lonToTileX(lon: number, zoom: number): number {
  const n = Math.pow(2, zoom);
  return Math.max(0, Math.min((1 << zoom) - 1, Math.floor(((lon + 180.0) / 360.0) * n)));
}

function latToTileY(lat: number, zoom: number): number {
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const latRad = (clampedLat * Math.PI) / 180.0;
  const n = Math.pow(2, zoom);
  const y = ((1.0 - Math.log(Math.tan(latRad) + 1.0 / Math.cos(latRad)) / Math.PI) / 2.0) * n;
  return Math.max(0, Math.min((1 << zoom) - 1, Math.floor(y)));
}

export const OfflineTileEstimator = {
  estimateTileCount(bounds: GeoBounds, minZoom: number, maxZoom: number): number {
    const zMin = Math.max(0, Math.min(18, Math.floor(minZoom)));
    const zMax = Math.max(zMin, Math.min(18, Math.floor(maxZoom)));
    let total = 0;
    for (let z = zMin; z <= zMax; z++) {
      const xMin = lonToTileX(bounds.westLon, z);
      const xMax = lonToTileX(bounds.eastLon, z);
      const yMin = latToTileY(bounds.northLat, z);
      const yMax = latToTileY(bounds.southLat, z);
      const countX = Math.max(1, xMax - xMin + 1);
      const countY = Math.max(1, yMax - yMin + 1);
      total += countX * countY;
    }
    return total;
  },

  estimateBytes(tileCount: number): number {
    return tileCount * 24576;
  },

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  },

  boundsForViewport(viewport: MapViewport): GeoBounds {
    const latSpan = Math.max(0.08, Math.min(4.5, 7.2 / Math.max(0.75, viewport.zoom)));
    const lonSpan = Math.max(0.1, Math.min(6.0, latSpan / 0.75));
    const halfLat = latSpan / 2.0;
    const halfLon = lonSpan / 2.0;
    const south = Math.max(35.5, Math.min(45.8, viewport.centerLat - halfLat));
    const north = Math.max(south + 0.04, Math.min(46.2, viewport.centerLat + halfLat));
    const west = Math.max(55.0, Math.min(74.0, viewport.centerLon - halfLon));
    const east = Math.max(west + 0.05, Math.min(74.5, viewport.centerLon + halfLon));
    return { northLat: north, southLat: south, eastLon: east, westLon: west };
  },

  boundsForRegion(region: RegionEntity): GeoBounds {
    let halfLat = 0.3;
    let halfLon = 0.42;
    if (region.id === 'UZ-TK') {
      halfLat = 0.14;
      halfLon = 0.18;
    } else if (region.id === 'UZ-QR' || region.id === 'UZ-NW') {
      halfLat = 0.65;
      halfLon = 0.85;
    }
    const south = Math.max(35.5, Math.min(45.8, region.centerLat - halfLat));
    const north = Math.max(south + 0.05, Math.min(46.2, region.centerLat + halfLat));
    const west = Math.max(55.0, Math.min(74.0, region.centerLon - halfLon));
    const east = Math.max(west + 0.05, Math.min(74.5, region.centerLon + halfLon));
    return { northLat: north, southLat: south, eastLon: east, westLon: west };
  },
};
