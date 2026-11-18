import {
  CategoryEntity,
  GeoPoint,
  GisRegistryItem,
  InfrastructureObjectEntity,
  ParsedGeometry,
  RegionEntity,
  RegistryGeometryType,
  categoryGroupFromId,
  severityFromStatus,
} from '../types/gis';

export function representativePoint(geom: ParsedGeometry): GeoPoint {
  if (geom.type === 'Point') return geom.point;
  if (geom.type === 'LineString') {
    return geom.points[Math.floor(geom.points.length / 2)] ?? { lat: 41.299, lon: 69.240 };
  }
  const outer = geom.rings[0] ?? [];
  if (outer.length === 0) return { lat: 41.299, lon: 69.240 };
  const sumLat = outer.reduce((acc, p) => acc + p.lat, 0);
  const sumLon = outer.reduce((acc, p) => acc + p.lon, 0);
  return { lat: sumLat / outer.length, lon: sumLon / outer.length };
}

export function allGeometryPoints(geom: ParsedGeometry): GeoPoint[] {
  if (geom.type === 'Point') return [geom.point];
  if (geom.type === 'LineString') return geom.points;
  return geom.rings.flat();
}

function parsePointList(arr: unknown): GeoPoint[] {
  if (!Array.isArray(arr)) return [];
  const pts: GeoPoint[] = [];
  for (const item of arr) {
    if (Array.isArray(item) && item.length >= 2) {
      const lon = Number(item[0]);
      const lat = Number(item[1]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        pts.push({ lat, lon });
      }
    }
  }
  return pts;
}

export const GeoUtils = {
  parseGeoJson(raw: string): ParsedGeometry | null {
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      const type = obj.type;
      const coords = obj.coordinates;
      if (type === 'Point' && Array.isArray(coords) && coords.length >= 2) {
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { type: 'Point', point: { lat, lon } };
      }
      if (type === 'LineString') {
        const pts = parsePointList(coords);
        return pts.length < 2 ? null : { type: 'LineString', points: pts };
      }
      if (type === 'Polygon' && Array.isArray(coords)) {
        const rings = coords
          .map((ring) => parsePointList(ring))
          .filter((pts) => pts.length >= 3);
        return rings.length === 0 ? null : { type: 'Polygon', rings };
      }
      return null;
    } catch {
      return null;
    }
  },

  encodeGeoJson(type: string, vertices: GeoPoint[]): string {
    if (type === 'Point') {
      const p = vertices[0] ?? { lat: 41.299, lon: 69.240 };
      return JSON.stringify({
        type: 'Point',
        coordinates: [p.lon, p.lat],
      });
    }
    if (type === 'LineString') {
      return JSON.stringify({
        type: 'LineString',
        coordinates: vertices.map((v) => [v.lon, v.lat]),
      });
    }
    const ring =
      vertices.length > 0 &&
      (vertices[0].lat !== vertices[vertices.length - 1].lat ||
        vertices[0].lon !== vertices[vertices.length - 1].lon)
        ? [...vertices, vertices[0]]
        : vertices;
    return JSON.stringify({
      type: 'Polygon',
      coordinates: [ring.map((v) => [v.lon, v.lat])],
    });
  },

  distanceMeters(a: GeoPoint, b: GeoPoint): number {
    const r = 6371000.0;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
  },

  distanceFromLineMeters(point: GeoPoint, line: GeoPoint[]): number {
    if (line.length < 2) return Infinity;
    const scale = Math.cos((point.lat * Math.PI) / 180);
    const metresPerDeg = 111195.0;
    let nearest = Infinity;
    for (let i = 1; i < line.length; i++) {
      const ax = (line[i - 1].lon - point.lon) * scale * metresPerDeg;
      const ay = (line[i - 1].lat - point.lat) * metresPerDeg;
      const bx = (line[i].lon - point.lon) * scale * metresPerDeg;
      const by = (line[i].lat - point.lat) * metresPerDeg;
      const dx = bx - ax;
      const dy = by - ay;
      const denom = dx * dx + dy * dy;
      const proj =
        denom === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denom));
      const d = Math.hypot(ax + proj * dx, ay + proj * dy);
      if (d < nearest) nearest = d;
    }
    return nearest;
  },

  uzbekistanBorder: [
    { lat: 45.58, lon: 58.60 },
    { lat: 45.10, lon: 56.00 },
    { lat: 41.32, lon: 56.00 },
    { lat: 41.15, lon: 57.50 },
    { lat: 42.20, lon: 58.60 },
    { lat: 41.30, lon: 60.10 },
    { lat: 40.15, lon: 62.20 },
    { lat: 39.00, lon: 63.60 },
    { lat: 37.35, lon: 65.20 },
    { lat: 37.18, lon: 67.20 },
    { lat: 37.40, lon: 68.10 },
    { lat: 38.90, lon: 67.80 },
    { lat: 39.50, lon: 67.50 },
    { lat: 40.10, lon: 69.00 },
    { lat: 40.30, lon: 70.60 },
    { lat: 40.00, lon: 71.70 },
    { lat: 40.55, lon: 73.15 },
    { lat: 41.35, lon: 72.10 },
    { lat: 41.55, lon: 70.95 },
    { lat: 42.10, lon: 70.20 },
    { lat: 41.50, lon: 69.05 },
    { lat: 40.80, lon: 68.10 },
    { lat: 41.30, lon: 66.80 },
    { lat: 42.40, lon: 66.00 },
    { lat: 43.10, lon: 64.00 },
    { lat: 43.80, lon: 62.00 },
    { lat: 44.50, lon: 60.50 },
    { lat: 45.58, lon: 58.60 },
  ] as GeoPoint[],

  aralContour: [
    { lat: 45.3, lon: 58.4 },
    { lat: 45.2, lon: 59.5 },
    { lat: 44.2, lon: 59.7 },
    { lat: 43.7, lon: 58.8 },
    { lat: 44.4, lon: 58.2 },
    { lat: 45.3, lon: 58.4 },
  ] as GeoPoint[],

  aydarLakeContour: [
    { lat: 40.95, lon: 66.20 },
    { lat: 40.85, lon: 67.15 },
    { lat: 40.68, lon: 67.30 },
    { lat: 40.72, lon: 66.40 },
    { lat: 40.95, lon: 66.20 },
  ] as GeoPoint[],
};

export function localizedRegionName(region: RegionEntity, locale: string): string {
  if (locale === 'ru') return region.nameRu;
  if (locale === 'en') return region.nameEn;
  return region.nameUz;
}

export function localizedCategoryName(cat: CategoryEntity, locale: string): string {
  if (locale === 'ru') return cat.nameRu;
  if (locale === 'en') return cat.nameEn;
  return cat.nameUz;
}

export function toGisRegistryItem(
  obj: InfrastructureObjectEntity,
  regionsById: Map<string, RegionEntity>,
  categoriesById: Map<string, CategoryEntity>,
  localeCode: string
): GisRegistryItem | null {
  const parsed = GeoUtils.parseGeoJson(obj.geometryJson);
  if (!parsed) return null;
  const geomType: RegistryGeometryType =
    parsed.type === 'Point' ? 'POINT' : parsed.type === 'LineString' ? 'LINE' : 'POLYGON';
  const reg = regionsById.get(obj.regionId);
  const cat = categoriesById.get(obj.categoryId);
  return {
    id: obj.id,
    code: obj.code,
    name: obj.name,
    description: obj.description,
    categoryId: obj.categoryId,
    categoryName: cat ? localizedCategoryName(cat, localeCode) : obj.categoryId,
    categoryGroup: categoryGroupFromId(obj.categoryId),
    regionId: obj.regionId,
    regionName: reg ? localizedRegionName(reg, localeCode) : obj.regionId,
    operationalStatus: obj.operationalStatus,
    severity: severityFromStatus(obj.operationalStatus),
    lifecycle: obj.lifecycle,
    geometryType: geomType,
    markerCoordinate: representativePoint(parsed),
    parsedGeometry: parsed,
    accuracyM: obj.accuracyM,
    updatedAt: obj.updatedAt,
    isSynthetic: obj.isSynthetic,
    isPublicProjected: obj.isPublicProjected,
  };
}
