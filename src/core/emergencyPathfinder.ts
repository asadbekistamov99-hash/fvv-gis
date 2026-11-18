import { GeoPoint, GisRegistryItem } from '../types/gis';
import { GeoUtils } from './geoUtils';

export interface EmergencyVehicleProfile {
  id: 'fire_engine' | 'rescue_4x4' | 'ambulance_hazmat';
  minWidthMeters: number;
  vehicleWeightTons: number;
  heightMeters: number;
  cruiseSpeedMps: number;
  allowsUnpaved: boolean;
  labelKey: string;
  specsKey: string;
}

export const EMERGENCY_VEHICLE_PROFILES: EmergencyVehicleProfile[] = [
  {
    id: 'fire_engine',
    minWidthMeters: 3.6,
    vehicleWeightTons: 18.0,
    heightMeters: 3.9,
    cruiseSpeedMps: 16.5,
    allowsUnpaved: false,
    labelKey: 'vehicleFireEngine',
    specsKey: 'vehicleFireEngineSpecs',
  },
  {
    id: 'rescue_4x4',
    minWidthMeters: 2.4,
    vehicleWeightTons: 3.8,
    heightMeters: 2.3,
    cruiseSpeedMps: 20.5,
    allowsUnpaved: true,
    labelKey: 'vehicleRescue4x4',
    specsKey: 'vehicleRescue4x4Specs',
  },
  {
    id: 'ambulance_hazmat',
    minWidthMeters: 2.8,
    vehicleWeightTons: 6.5,
    heightMeters: 3.1,
    cruiseSpeedMps: 19.0,
    allowsUnpaved: false,
    labelKey: 'vehicleAmbulanceHazmat',
    specsKey: 'vehicleAmbulanceHazmatSpecs',
  },
];

export interface RoadClassDef {
  id: string;
  labelKey: string;
  widthMeters: number;
  maxWeightTons: number;
  clearanceMeters: number;
  speedMultiplier: number;
  paved: boolean;
}

export const ROAD_CLASSES = {
  NATIONAL_HIGHWAY: {
    id: 'NATIONAL_HIGHWAY',
    labelKey: 'roadHighway',
    widthMeters: 12.0,
    maxWeightTons: 40.0,
    clearanceMeters: 5.2,
    speedMultiplier: 1.25,
    paved: true,
  },
  ARTERIAL_CORRIDOR: {
    id: 'ARTERIAL_CORRIDOR',
    labelKey: 'roadArterial',
    widthMeters: 8.5,
    maxWeightTons: 28.0,
    clearanceMeters: 4.6,
    speedMultiplier: 1.0,
    paved: true,
  },
  COLLECTOR_STREET: {
    id: 'COLLECTOR_STREET',
    labelKey: 'roadCollector',
    widthMeters: 5.0,
    maxWeightTons: 14.0,
    clearanceMeters: 4.2,
    speedMultiplier: 0.82,
    paved: true,
  },
  BRIDGE_CONSTRAINED: {
    id: 'BRIDGE_CONSTRAINED',
    labelKey: 'roadBridge',
    widthMeters: 4.0,
    maxWeightTons: 10.0,
    clearanceMeters: 3.9,
    speedMultiplier: 0.68,
    paved: true,
  },
  NARROW_LANE: {
    id: 'NARROW_LANE',
    labelKey: 'roadNarrow',
    widthMeters: 2.9,
    maxWeightTons: 6.0,
    clearanceMeters: 3.4,
    speedMultiplier: 0.45,
    paved: false,
  },
  UNPAVED_ACCESS: {
    id: 'UNPAVED_ACCESS',
    labelKey: 'roadUnpaved',
    widthMeters: 3.2,
    maxWeightTons: 9.0,
    clearanceMeters: 4.5,
    speedMultiplier: 0.58,
    paved: false,
  },
} satisfies Record<string, RoadClassDef>;

export type RouteAccessibilityStatus =
  | 'FULLY_ACCESSIBLE'
  | 'DETOUR_APPLIED'
  | 'ACCESSIBLE_WITH_CAUTION'
  | 'RESTRICTED_LAST_MILE';

export const ACCESSIBILITY_STATUS_LABEL_KEY: Record<RouteAccessibilityStatus, string> = {
  FULLY_ACCESSIBLE: 'routeAccessibleFull',
  DETOUR_APPLIED: 'routeDetourApplied',
  ACCESSIBLE_WITH_CAUTION: 'routeAccessibleCaution',
  RESTRICTED_LAST_MILE: 'routeRestrictedLastMile',
};

export interface PathNavigationStep {
  roadName: string;
  roadClass: RoadClassDef;
  distanceMeters: number;
  durationSeconds: number;
  widthMeters: number;
  maxWeightTons: number;
  cautionReasonKey: string | null;
  from: GeoPoint;
  to: GeoPoint;
}

export interface EmergencyPathResult {
  origin: GeoPoint;
  destination: GeoPoint;
  destinationMarkerId: string;
  destinationCode: string;
  destinationName: string;
  pathPoints: GeoPoint[];
  totalDistanceMeters: number;
  estimatedDurationSeconds: number;
  estimatedMinutes: number;
  vehicleProfile: EmergencyVehicleProfile;
  accessibilityStatus: RouteAccessibilityStatus;
  steps: PathNavigationStep[];
  avoidedObstacleKeys: string[];
  minRoadWidthMeters: number;
  minWeightLimitTons: number;
}

interface GraphNode {
  id: string;
  point: GeoPoint;
}

interface GraphEdge {
  fromId: string;
  toId: string;
  roadName: string;
  roadClass: RoadClassDef;
  distanceMeters: number;
  widthMeters: number;
  maxWeightTons: number;
  clearanceMeters: number;
  obstacleReasonKey: string | null;
}

const TRUNK_HUBS = [
  { id: 'tashkent', name: 'Tashkent', point: { lat: 41.2995, lon: 69.2401 } },
  { id: 'chirchiq', name: 'Chirchiq', point: { lat: 41.4689, lon: 69.5822 } },
  { id: 'ohangaron', name: 'Ohangaron', point: { lat: 40.9167, lon: 69.6333 } },
  { id: 'kamchik', name: 'Kamchik Pass', point: { lat: 41.095, lon: 70.51 } },
  { id: 'guliston', name: 'Guliston', point: { lat: 40.4897, lon: 68.7842 } },
  { id: 'jizzakh', name: 'Jizzakh', point: { lat: 40.1158, lon: 67.8422 } },
  { id: 'samarkand', name: 'Samarkand', point: { lat: 39.6542, lon: 66.9597 } },
  { id: 'navoi', name: 'Navoi', point: { lat: 40.0844, lon: 65.3792 } },
  { id: 'bukhara', name: 'Bukhara', point: { lat: 39.7747, lon: 64.4286 } },
  { id: 'qarshi', name: 'Qarshi', point: { lat: 38.8606, lon: 65.7891 } },
  { id: 'termez', name: 'Termez', point: { lat: 37.2242, lon: 67.2783 } },
  { id: 'namangan', name: 'Namangan', point: { lat: 40.9983, lon: 71.6726 } },
  { id: 'andijan', name: 'Andijan', point: { lat: 40.7821, lon: 72.3442 } },
  { id: 'fergana', name: 'Fergana', point: { lat: 40.3864, lon: 71.7864 } },
  { id: 'urgench', name: 'Urgench', point: { lat: 41.55, lon: 60.6333 } },
  { id: 'nukus', name: 'Nukus', point: { lat: 42.4619, lon: 59.6166 } },
];

const TRUNK_CONNECTIONS: [string, string, string, RoadClassDef][] = [
  ['tashkent', 'chirchiq', '4R12 Emergency Arterial', ROAD_CLASSES.ARTERIAL_CORRIDOR],
  ['tashkent', 'ohangaron', 'A373 Corridor', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['ohangaron', 'kamchik', 'A373 Kamchik Pass', ROAD_CLASSES.BRIDGE_CONSTRAINED],
  ['kamchik', 'namangan', 'A373 Valley Descent', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['namangan', 'andijan', 'A373 Andijan Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['namangan', 'fergana', '4R112 Fergana Ring', ROAD_CLASSES.ARTERIAL_CORRIDOR],
  ['fergana', 'andijan', 'A373 Fergana-Andijan', ROAD_CLASSES.ARTERIAL_CORRIDOR],
  ['tashkent', 'guliston', 'M39 Syr Darya Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['guliston', 'jizzakh', 'M39 Jizzakh Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['jizzakh', 'samarkand', 'M39 Samarkand Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['samarkand', 'navoi', 'M37 Zeravshan Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['navoi', 'bukhara', 'M37 Bukhara Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['samarkand', 'qarshi', 'A378 Kashkadarya Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['bukhara', 'qarshi', 'A380 Steppe Corridor', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['qarshi', 'termez', 'M39 Surkhandarya Pass', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['samarkand', 'termez', 'M39 Mountain Hwy', ROAD_CLASSES.ARTERIAL_CORRIDOR],
  ['bukhara', 'urgench', 'A380 Kyzylkum Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
  ['urgench', 'nukus', 'A380 Amu Darya Hwy', ROAD_CLASSES.NATIONAL_HIGHWAY],
];

function buildLocalRoadMesh(
  startId: string,
  endId: string,
  start: GeoPoint,
  end: GeoPoint,
  prefix: string,
  addNode: (id: string, pt: GeoPoint) => void,
  addEdge: (
    aId: string,
    bId: string,
    roadName: string,
    roadClass: RoadClassDef,
    widthMeters?: number,
    maxWeightTons?: number,
    clearanceMeters?: number,
    obstacleReasonKey?: string | null
  ) => void
) {
  const dLat = end.lat - start.lat;
  const dLon = end.lon - start.lon;
  const cosLat = Math.max(0.4, Math.cos((((start.lat + end.lat) / 2) * Math.PI) / 180));
  const dx = dLon * cosLat;
  const dy = dLat;
  const len = Math.max(1e-6, Math.hypot(dx, dy));

  const perpLat = dx / len;
  const perpLon = -(dy / len) / cosLat;

  const spanDeg = Math.hypot(dLat, dLon * cosLat);
  const lateralScale = Math.max(0.0025, Math.min(0.045, spanDeg * 0.14));

  const pointAt = (t: number, lateralFactor: number): GeoPoint => ({
    lat: Math.max(36.0, Math.min(46.5, start.lat + dLat * t + perpLat * lateralScale * lateralFactor)),
    lon: Math.max(54.0, Math.min(75.0, start.lon + dLon * t + perpLon * lateralScale * lateralFactor)),
  });

  const c1 = `${prefix}_c1`,
    c2 = `${prefix}_c2`,
    c3 = `${prefix}_c3`;
  const a1 = `${prefix}_a1`,
    a2 = `${prefix}_a2`,
    a3 = `${prefix}_a3`;
  const s1 = `${prefix}_s1`,
    s2 = `${prefix}_s2`,
    s3 = `${prefix}_s3`;

  addNode(c1, pointAt(0.26, 0.0));
  addNode(c2, pointAt(0.52, 0.02));
  addNode(c3, pointAt(0.76, 0.0));

  addNode(a1, pointAt(0.24, 1.0));
  addNode(a2, pointAt(0.5, 1.15));
  addNode(a3, pointAt(0.76, 0.95));

  addNode(s1, pointAt(0.25, -0.95));
  addNode(s2, pointAt(0.51, -1.05));
  addNode(s3, pointAt(0.75, -0.9));

  addEdge(startId, c1, 'Central Access Street', ROAD_CLASSES.COLLECTOR_STREET, 5.0, 14.0, 4.2, null);
  addEdge(c1, c2, 'Old Quarter Lane', ROAD_CLASSES.NARROW_LANE, 2.9, 6.0, 3.4, 'obstacleNarrowLane');
  addEdge(c2, c3, 'Canal Crossing Bridge', ROAD_CLASSES.BRIDGE_CONSTRAINED, 3.8, 10.0, 3.8, 'obstacleWeakBridge');
  addEdge(c3, endId, 'Final Collector Approach', ROAD_CLASSES.COLLECTOR_STREET, 5.0, 14.0, 4.2, null);

  addEdge(startId, a1, 'Emergency Arterial Feeder', ROAD_CLASSES.ARTERIAL_CORRIDOR, 8.5, 28.0, 4.6, null);
  addEdge(a1, a2, 'Main Emergency Boulevard', ROAD_CLASSES.ARTERIAL_CORRIDOR, 9.0, 32.0, 4.8, null);
  addEdge(a2, a3, 'Ring Emergency Avenue', ROAD_CLASSES.ARTERIAL_CORRIDOR, 8.5, 28.0, 4.6, null);
  addEdge(a3, endId, 'Paved Service Approach', ROAD_CLASSES.ARTERIAL_CORRIDOR, 7.5, 24.0, 4.5, null);

  addEdge(startId, s1, 'District Link Road', ROAD_CLASSES.COLLECTOR_STREET, 5.0, 14.0, 4.2, null);
  addEdge(s1, s2, 'Gravel Utility Track', ROAD_CLASSES.UNPAVED_ACCESS, 3.2, 9.0, 4.5, 'obstacleUnpavedTrack');
  addEdge(s2, s3, 'Perimeter Access Road', ROAD_CLASSES.UNPAVED_ACCESS, 3.3, 9.5, 4.5, 'obstacleUnpavedTrack');
  addEdge(s3, endId, 'Secondary Collector', ROAD_CLASSES.COLLECTOR_STREET, 4.8, 14.0, 4.2, null);

  addEdge(c1, a1, 'Cross Avenue N-1', ROAD_CLASSES.ARTERIAL_CORRIDOR, 7.0, 22.0, 4.5, null);
  addEdge(c2, a2, 'Cross Avenue N-2', ROAD_CLASSES.COLLECTOR_STREET, 5.2, 16.0, 4.2, null);
  addEdge(c3, a3, 'Cross Avenue N-3', ROAD_CLASSES.ARTERIAL_CORRIDOR, 7.0, 22.0, 4.5, null);
  addEdge(c1, s1, 'Cross Street S-1', ROAD_CLASSES.COLLECTOR_STREET, 4.8, 14.0, 4.2, null);
  addEdge(c2, s2, 'Cross Street S-2', ROAD_CLASSES.COLLECTOR_STREET, 4.8, 14.0, 4.2, null);
  addEdge(c3, s3, 'Cross Street S-3', ROAD_CLASSES.COLLECTOR_STREET, 4.8, 14.0, 4.2, null);
}

function runAStar(
  nodes: Map<string, GraphNode>,
  adj: Map<string, GraphEdge[]>,
  startId: string,
  goalId: string,
  profile: EmergencyVehicleProfile,
  evaluateEdge: (edge: GraphEdge) => { cost: number; cautionKey: string | null } | null
): GraphEdge[] | null {
  const goalPt = nodes.get(goalId)?.point;
  if (!goalPt) return null;
  const maxSpeed = profile.cruiseSpeedMps * ROAD_CLASSES.NATIONAL_HIGHWAY.speedMultiplier;

  const heuristic = (nodeId: string): number => {
    const pt = nodes.get(nodeId)?.point;
    if (!pt) return 0;
    return GeoUtils.distanceMeters(pt, goalPt) / maxSpeed;
  };

  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, GraphEdge>();
  const closed = new Set<string>();
  const open: { nodeId: string; fScore: number }[] = [{ nodeId: startId, fScore: heuristic(startId) }];

  gScore.set(startId, 0);

  while (open.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].fScore < open[bestIdx].fScore) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    if (current.nodeId === goalId) {
      const reconstructed: GraphEdge[] = [];
      let cur = goalId;
      while (cur !== startId) {
        const edge = cameFrom.get(cur);
        if (!edge) break;
        reconstructed.push(edge);
        cur = edge.fromId;
      }
      reconstructed.reverse();
      return reconstructed;
    }
    if (closed.has(current.nodeId)) continue;
    closed.add(current.nodeId);

    const currentG = gScore.get(current.nodeId);
    if (currentG === undefined) continue;

    const neighbors = adj.get(current.nodeId) ?? [];
    for (const edge of neighbors) {
      if (closed.has(edge.toId)) continue;
      const evaluated = evaluateEdge(edge);
      if (!evaluated) continue;
      const tentativeG = currentG + evaluated.cost;
      const prevG = gScore.get(edge.toId);
      if (prevG === undefined || tentativeG < prevG) {
        gScore.set(edge.toId, tentativeG);
        cameFrom.set(edge.toId, edge);
        open.push({ nodeId: edge.toId, fScore: tentativeG + heuristic(edge.toId) });
      }
    }
  }
  return null;
}

export const EmergencyPathfinder = {
  calculateShortestPath(
    origin: GeoPoint,
    destinationMarker: GisRegistryItem,
    allMarkers: GisRegistryItem[],
    profile: EmergencyVehicleProfile,
    avoidFaultyHazards = true
  ): EmergencyPathResult {
    const destination = destinationMarker.markerCoordinate;
    const directDistance = GeoUtils.distanceMeters(origin, destination);

    const hazardZones = avoidFaultyHazards
      ? allMarkers
          .filter(
            (m) =>
              m.id !== destinationMarker.id &&
              (m.operationalStatus === 'faulty' || m.operationalStatus === 'temporarily_unavailable') &&
              (m.categoryGroup === 'HAZARDS' ||
                m.categoryId.includes('water') ||
                m.categoryId.includes('sewer'))
          )
          .map((m) => m.markerCoordinate)
      : [];

    if (directDistance < 250) {
      const speed = profile.cruiseSpeedMps * ROAD_CLASSES.ARTERIAL_CORRIDOR.speedMultiplier;
      const dur = Math.max(15, directDistance / speed);
      return {
        origin,
        destination,
        destinationMarkerId: destinationMarker.id,
        destinationCode: destinationMarker.code,
        destinationName: destinationMarker.name,
        pathPoints: [origin, destination],
        totalDistanceMeters: directDistance,
        estimatedDurationSeconds: dur,
        estimatedMinutes: Math.max(1, Math.round(dur / 60)),
        vehicleProfile: profile,
        accessibilityStatus: 'FULLY_ACCESSIBLE',
        steps: [
          {
            roadName: 'Direct Emergency Access',
            roadClass: ROAD_CLASSES.ARTERIAL_CORRIDOR,
            distanceMeters: directDistance,
            durationSeconds: dur,
            widthMeters: ROAD_CLASSES.ARTERIAL_CORRIDOR.widthMeters,
            maxWeightTons: ROAD_CLASSES.ARTERIAL_CORRIDOR.maxWeightTons,
            cautionReasonKey: null,
            from: origin,
            to: destination,
          },
        ],
        avoidedObstacleKeys: [],
        minRoadWidthMeters: ROAD_CLASSES.ARTERIAL_CORRIDOR.widthMeters,
        minWeightLimitTons: ROAD_CLASSES.ARTERIAL_CORRIDOR.maxWeightTons,
      };
    }

    const nodes = new Map<string, GraphNode>();
    const adj = new Map<string, GraphEdge[]>();

    const addNode = (id: string, pt: GeoPoint) => {
      nodes.set(id, { id, point: pt });
      if (!adj.has(id)) adj.set(id, []);
    };

    const addBidirectionalEdge = (
      aId: string,
      bId: string,
      roadName: string,
      roadClass: RoadClassDef,
      widthMeters = roadClass.widthMeters,
      maxWeightTons = roadClass.maxWeightTons,
      clearanceMeters = roadClass.clearanceMeters,
      obstacleReasonKey: string | null = null
    ) => {
      const a = nodes.get(aId)?.point;
      const b = nodes.get(bId)?.point;
      if (!a || !b) return;
      const dist = GeoUtils.distanceMeters(a, b);
      adj.get(aId)?.push({
        fromId: aId,
        toId: bId,
        roadName,
        roadClass,
        distanceMeters: dist,
        widthMeters,
        maxWeightTons,
        clearanceMeters,
        obstacleReasonKey,
      });
      adj.get(bId)?.push({
        fromId: bId,
        toId: aId,
        roadName,
        roadClass,
        distanceMeters: dist,
        widthMeters,
        maxWeightTons,
        clearanceMeters,
        obstacleReasonKey,
      });
    };

    addNode('origin', origin);
    addNode('dest', destination);

    if (directDistance <= 65000) {
      buildLocalRoadMesh('origin', 'dest', origin, destination, 'loc', addNode, addBidirectionalEdge);
    } else {
      TRUNK_HUBS.forEach((h) => addNode(`hub_${h.id}`, h.point));
      TRUNK_CONNECTIONS.forEach(([from, to, name, rClass]) => {
        const isKamchik = from === 'kamchik' || to === 'kamchik';
        addBidirectionalEdge(
          `hub_${from}`,
          `hub_${to}`,
          name,
          rClass,
          isKamchik ? 7.0 : rClass.widthMeters,
          isKamchik ? 22.0 : rClass.maxWeightTons,
          isKamchik ? 4.0 : rClass.clearanceMeters,
          isKamchik ? 'obstacleMountainPass' : null
        );
      });
      const startHubs = [...TRUNK_HUBS]
        .sort((a, b) => GeoUtils.distanceMeters(origin, a.point) - GeoUtils.distanceMeters(origin, b.point))
        .slice(0, 2);
      const endHubs = [...TRUNK_HUBS]
        .sort((a, b) => GeoUtils.distanceMeters(destination, a.point) - GeoUtils.distanceMeters(destination, b.point))
        .slice(0, 2);
      startHubs.forEach((hub, idx) => {
        buildLocalRoadMesh('origin', `hub_${hub.id}`, origin, hub.point, `start_${idx}`, addNode, addBidirectionalEdge);
      });
      endHubs.forEach((hub, idx) => {
        buildLocalRoadMesh(`hub_${hub.id}`, 'dest', hub.point, destination, `end_${idx}`, addNode, addBidirectionalEdge);
      });
    }

    const hazardThresholdMeters = directDistance <= 65000 ? 220 : 1200;
    const avoidedObstacles = new Set<string>();

    const evaluateEdge = (
      edge: GraphEdge,
      allowFallbackRestricted: boolean
    ): { cost: number; cautionKey: string | null } | null => {
      const fromPt = nodes.get(edge.fromId)?.point;
      const toPt = nodes.get(edge.toId)?.point;
      if (!fromPt || !toPt) return null;

      const tooNarrow = profile.minWidthMeters > edge.widthMeters;
      const tooHeavy = profile.vehicleWeightTons > edge.maxWeightTons;
      const tooTall = profile.heightMeters > edge.clearanceMeters;
      const unpavedBlocked = !edge.roadClass.paved && !profile.allowsUnpaved;

      const passesNearHazard = hazardZones.some(
        (hz) => GeoUtils.distanceFromLineMeters(hz, [fromPt, toPt]) <= hazardThresholdMeters
      );

      if (tooNarrow || tooHeavy || tooTall || unpavedBlocked) {
        if (tooNarrow) avoidedObstacles.add('obstacleNarrowLane');
        if (tooHeavy) avoidedObstacles.add('obstacleWeakBridge');
        if (tooTall) avoidedObstacles.add('obstacleMountainPass');
        if (unpavedBlocked) avoidedObstacles.add('obstacleUnpavedTrack');
        if (!allowFallbackRestricted) return null;
        const baseSpeed = profile.cruiseSpeedMps * edge.roadClass.speedMultiplier;
        const note = tooNarrow
          ? 'obstacleNarrowLane'
          : tooHeavy
          ? 'obstacleWeakBridge'
          : tooTall
          ? 'obstacleMountainPass'
          : 'obstacleUnpavedTrack';
        return { cost: (edge.distanceMeters / baseSpeed) * 250.0, cautionKey: note };
      }

      const baseSpeed = profile.cruiseSpeedMps * edge.roadClass.speedMultiplier;
      let costSeconds = edge.distanceMeters / baseSpeed;
      let cautionKey: string | null = edge.obstacleReasonKey;

      if (passesNearHazard) {
        avoidedObstacles.add('obstacleHazardZone');
        costSeconds *= 18.0;
        cautionKey = 'obstacleHazardZone';
      } else if (!edge.roadClass.paved && profile.allowsUnpaved) {
        costSeconds *= 1.12;
      }

      return { cost: costSeconds, cautionKey };
    };

    const strictResult = runAStar(nodes, adj, 'origin', 'dest', profile, (edge) =>
      evaluateEdge(edge, false)
    );
    let chosenEdges: GraphEdge[] = [];
    let usedRestrictedFallback = false;

    if (strictResult) {
      chosenEdges = strictResult;
    } else {
      chosenEdges =
        runAStar(nodes, adj, 'origin', 'dest', profile, (edge) => evaluateEdge(edge, true)) ?? [];
      usedRestrictedFallback = true;
    }

    if (chosenEdges.length === 0) {
      const speed = profile.cruiseSpeedMps * ROAD_CLASSES.COLLECTOR_STREET.speedMultiplier;
      const dur = Math.max(30, directDistance / speed);
      return {
        origin,
        destination,
        destinationMarkerId: destinationMarker.id,
        destinationCode: destinationMarker.code,
        destinationName: destinationMarker.name,
        pathPoints: [origin, destination],
        totalDistanceMeters: directDistance,
        estimatedDurationSeconds: dur,
        estimatedMinutes: Math.max(1, Math.round(dur / 60)),
        vehicleProfile: profile,
        accessibilityStatus: 'ACCESSIBLE_WITH_CAUTION',
        steps: [
          {
            roadName: 'Direct Access',
            roadClass: ROAD_CLASSES.COLLECTOR_STREET,
            distanceMeters: directDistance,
            durationSeconds: dur,
            widthMeters: ROAD_CLASSES.COLLECTOR_STREET.widthMeters,
            maxWeightTons: ROAD_CLASSES.COLLECTOR_STREET.maxWeightTons,
            cautionReasonKey: null,
            from: origin,
            to: destination,
          },
        ],
        avoidedObstacleKeys: [],
        minRoadWidthMeters: ROAD_CLASSES.COLLECTOR_STREET.widthMeters,
        minWeightLimitTons: ROAD_CLASSES.COLLECTOR_STREET.maxWeightTons,
      };
    }

    const points: GeoPoint[] = [origin];
    const steps: PathNavigationStep[] = [];
    let totalDist = 0;
    let totalDuration = 0;
    let minWidth = Infinity;
    let minWeight = Infinity;
    let hasCaution = false;

    for (const edge of chosenEdges) {
      const fromPt = nodes.get(edge.fromId)?.point;
      const toPt = nodes.get(edge.toId)?.point;
      if (!fromPt || !toPt) continue;
      const evalRes = evaluateEdge(edge, usedRestrictedFallback);
      const caution = evalRes?.cautionKey ?? null;
      if (caution !== null) hasCaution = true;
      const speed = profile.cruiseSpeedMps * edge.roadClass.speedMultiplier;
      const stepDuration = edge.distanceMeters / speed;
      totalDist += edge.distanceMeters;
      totalDuration += stepDuration;
      if (edge.widthMeters < minWidth) minWidth = edge.widthMeters;
      if (edge.maxWeightTons < minWeight) minWeight = edge.maxWeightTons;
      points.push(toPt);
      steps.push({
        roadName: edge.roadName,
        roadClass: edge.roadClass,
        distanceMeters: edge.distanceMeters,
        durationSeconds: stepDuration,
        widthMeters: edge.widthMeters,
        maxWeightTons: edge.maxWeightTons,
        cautionReasonKey: caution,
        from: fromPt,
        to: toPt,
      });
    }

    const status: RouteAccessibilityStatus = usedRestrictedFallback
      ? 'RESTRICTED_LAST_MILE'
      : hasCaution
      ? 'ACCESSIBLE_WITH_CAUTION'
      : avoidedObstacles.size > 0
      ? 'DETOUR_APPLIED'
      : 'FULLY_ACCESSIBLE';

    return {
      origin,
      destination,
      destinationMarkerId: destinationMarker.id,
      destinationCode: destinationMarker.code,
      destinationName: destinationMarker.name,
      pathPoints: points,
      totalDistanceMeters: totalDist,
      estimatedDurationSeconds: totalDuration,
      estimatedMinutes: Math.max(1, Math.round(totalDuration / 60)),
      vehicleProfile: profile,
      accessibilityStatus: status,
      steps,
      avoidedObstacleKeys: Array.from(avoidedObstacles),
      minRoadWidthMeters: Number.isFinite(minWidth) ? minWidth : 5.0,
      minWeightLimitTons: Number.isFinite(minWeight) ? minWeight : 14.0,
    };
  },
};
