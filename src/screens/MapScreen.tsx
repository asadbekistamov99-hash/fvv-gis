import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CloudDownload,
  CloudUpload,
  Crosshair,
  Globe,
  Layers,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Phone,
  Plus,
  RotateCcw,
  Route,
  Ruler,
  Satellite,
  TrainFront,
  X,
} from 'lucide-react';
import {
  ACCESSIBILITY_STATUS_LABEL_KEY,
  EMERGENCY_VEHICLE_PROFILES,
  EmergencyPathfinder,
  EmergencyVehicleProfile,
} from '../core/emergencyPathfinder';
import { GeoUtils, localizedCategoryName, localizedRegionName } from '../core/geoUtils';
import { requestBrowserGpsFix } from '../core/locationHelper';
import { L10n } from '../core/localization';
import {
  OfflineAreaRecord,
  OfflineTileEstimator,
  TILE_DETAIL_PRESETS,
  TileDetailPreset,
  boundsCenter,
} from '../core/offlineMapManager';
import { buildStreetViewForPoint, trafficColorHex } from '../data/mapLayersData';
import { getGoogleMapsApiKey, googleZoomToCanvasZoom } from '../core/mapsConfig';
import { useApp } from '../context/AppContext';
import {
  AppRoute,
  BaseMapType,
  DEFAULT_VIEWPORT,
  GeoPoint,
  GisRegistryItem,
  MapDetailLayer,
  MapViewport,
  MarkerCluster,
  RegistryCategoryGroup,
  StreetViewPanorama,
} from '../types/gis';
import {
  CategoryIcon,
  DataRowView,
  ModalSheet,
  StatusPill,
  triggerPhoneCall,
} from '../components/CommonComponents';
import { DownloadAreaMode, DownloadAreaSheet } from '../components/DownloadAreaSheet';
import { EmergencyReportSheet } from '../components/EmergencyReportSheet';
import { GisMapViewport } from '../components/GisMapViewport';
import { MapLayersStrip } from '../components/MapLayersStrip';
import { MapSearchOverlay } from '../components/MapSearchOverlay';
import { PathfindingSheet } from '../components/PathfindingSheet';
import { RegistryMarkerDetailSheet } from '../components/RegistryMarkerDetailSheet';
import { StreetViewDock } from '../components/StreetViewDock';
import { StreetViewModal } from '../components/StreetViewModal';

const ALL_GROUPS: RegistryCategoryGroup[] = ['INFRASTRUCTURE', 'HAZARDS', 'EQUIPMENT'];

function formatDistanceMeters(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

export const MapScreen: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({
  onNavigate,
}) => {
  const {
    state,
    regions,
    categories,
    mapMarkers,
    syncQueue,
    savedOfflineAreas,
    creatingOfflineArea,
    submitEmergencyIncident,
    startOfflineAreaDownload,
    toggleOfflineAreaPauseResume,
    deleteOfflineArea,
    showMessage,
  } = useApp();
  const locale = state.locale;

  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_VIEWPORT);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleGroups, setVisibleGroups] = useState<Set<RegistryCategoryGroup>>(
    () => new Set(ALL_GROUPS)
  );
  const [regionFilterId, setRegionFilterId] = useState<string>('ALL');
  const [categoryFilterId, setCategoryFilterId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [selectedMarker, setSelectedMarker] = useState<GisRegistryItem | null>(null);
  const [clusterModal, setClusterModal] = useState<MarkerCluster | null>(null);
  const [markersListOpen, setMarkersListOpen] = useState(false);
  const [layersModalOpen, setLayersModalOpen] = useState(false);
  const [layersStripOpen, setLayersStripOpen] = useState(true);
  const [baseMapType, setBaseMapType] = useState<BaseMapType>('satellite');
  const [activeDetails, setActiveDetails] = useState<Set<MapDetailLayer>>(
    () => new Set<MapDetailLayer>(['traffic'])
  );
  const [activeStreetViewPano, setActiveStreetViewPano] = useState<StreetViewPanorama | null>(null);
  const [sdkModalOpen, setSdkModalOpen] = useState(false);

  // GPS tracking & Location
  const [trackingLocation, setTrackingLocation] = useState(false);
  const [userLocation, setUserLocation] = useState<GeoPoint | null>(null);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);

  // Measure distance tool
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<GeoPoint[]>([]);

  // Emergency pin reporting mode
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [emergencyPin, setEmergencyPin] = useState<GeoPoint | null>(null);
  const [submittingEmergency, setSubmittingEmergency] = useState(false);

  // A* Pathfinding
  const [pathfindingOpen, setPathfindingOpen] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<GeoPoint | null>(null);
  const [routeDestination, setRouteDestination] = useState<GisRegistryItem | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<EmergencyVehicleProfile>(
    EMERGENCY_VEHICLE_PROFILES[0]
  );
  const [avoidFaultyHazards, setAvoidFaultyHazards] = useState(true);
  const [showRouteOnMap, setShowRouteOnMap] = useState(false);

  // Offline Download Area Sheet
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadMode, setDownloadMode] = useState<DownloadAreaMode>('CURRENT_VIEW');
  const [downloadRegionId, setDownloadRegionId] = useState<string | null>(regions[0]?.id ?? null);
  const [downloadPreset, setDownloadPreset] = useState<TileDetailPreset>(TILE_DETAIL_PRESETS[0]);

  useEffect(() => {
    if (!trackingLocation || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsAccuracyM(pos.coords.accuracy || 12);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [trackingLocation]);

  const sheetFilteredMarkers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mapMarkers.filter((m) => {
      if (regionFilterId !== 'ALL' && m.regionId !== regionFilterId) return false;
      if (categoryFilterId !== 'ALL' && m.categoryId !== categoryFilterId) return false;
      if (statusFilter !== 'ALL' && m.operationalStatus !== statusFilter) return false;
      if (
        q &&
        !m.name.toLowerCase().includes(q) &&
        !m.code.toLowerCase().includes(q) &&
        !m.categoryName.toLowerCase().includes(q) &&
        !m.regionName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [mapMarkers, regionFilterId, categoryFilterId, statusFilter, searchQuery]);

  const groupCounts = useMemo<Record<RegistryCategoryGroup, number>>(() => {
    const counts: Record<RegistryCategoryGroup, number> = {
      INFRASTRUCTURE: 0,
      HAZARDS: 0,
      EQUIPMENT: 0,
    };
    sheetFilteredMarkers.forEach((m) => {
      counts[m.categoryGroup] = (counts[m.categoryGroup] ?? 0) + 1;
    });
    return counts;
  }, [sheetFilteredMarkers]);

  const filteredMarkers = useMemo(
    () => sheetFilteredMarkers.filter((m) => visibleGroups.has(m.categoryGroup)),
    [sheetFilteredMarkers, visibleGroups]
  );

  const queuedEmergencyCount = useMemo(
    () =>
      syncQueue.filter(
        (op) => op.status === 'pending' && op.entityType === 'emergency_incident'
      ).length,
    [syncQueue]
  );

  const calculatedPath = useMemo(() => {
    const origin = routeOrigin ?? userLocation;
    if (!origin || !routeDestination) return null;
    return EmergencyPathfinder.calculateShortestPath(
      origin,
      routeDestination,
      mapMarkers,
      selectedProfile,
      avoidFaultyHazards
    );
  }, [routeOrigin, userLocation, routeDestination, selectedProfile, mapMarkers, avoidFaultyHazards]);

  const activeRoutePoints = useMemo(() => {
    if (!showRouteOnMap || !calculatedPath) return [];
    return calculatedPath.pathPoints;
  }, [showRouteOnMap, calculatedPath]);

  const activeRouteWarning = calculatedPath?.accessibilityStatus !== 'FULLY_ACCESSIBLE';

  const measureDistanceTotal = useMemo(() => {
    let total = 0;
    for (let i = 1; i < measurePoints.length; i++) {
      total += GeoUtils.distanceMeters(measurePoints[i - 1], measurePoints[i]);
    }
    return total;
  }, [measurePoints]);

  const previewBounds = useMemo(() => {
    if (downloadMode === 'REGION') {
      const reg = regions.find((r) => r.id === downloadRegionId) ?? regions[0];
      if (reg) return OfflineTileEstimator.boundsForRegion(reg);
    }
    return OfflineTileEstimator.boundsForViewport(viewport);
  }, [downloadMode, downloadRegionId, regions, viewport]);

  const savedAreaBounds = useMemo(
    () => savedOfflineAreas.map((a) => a.bounds),
    [savedOfflineAreas]
  );

  const hasCachedOfflineAreas = useMemo(
    () => savedOfflineAreas.some((a) => a.isComplete),
    [savedOfflineAreas]
  );

  const hasActiveSheetFilters =
    regionFilterId !== 'ALL' ||
    categoryFilterId !== 'ALL' ||
    statusFilter !== 'ALL' ||
    baseMapType !== 'satellite' ||
    activeDetails.size > 0;

  const handleToggleDetailLayer = (layer: MapDetailLayer) => {
    setActiveDetails((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
        if (layer === 'relief' && baseMapType === 'terrain') {
          setBaseMapType('standard');
        }
      } else {
        next.add(layer);
        if (layer === 'relief' && baseMapType === 'standard') {
          setBaseMapType('terrain');
        }
        if (layer === 'streetView') {
          showMessage(L10n.text(locale, 'streetViewCoverageHint'));
        }
      }
      return next;
    });
  };

  const handleToggleGroup = (group: RegistryCategoryGroup) => {
    setVisibleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        if (next.size > 1) next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const handleCaptureGps = async (centerMap: boolean) => {
    const fix = await requestBrowserGpsFix();
    setUserLocation(fix.point);
    setGpsAccuracyM(fix.accuracyMeters);
    if (!routeOrigin) setRouteOrigin(fix.point);
    if (centerMap) {
      setViewport((vp) => ({
        centerLat: fix.point.lat,
        centerLon: fix.point.lon,
        zoom: Math.max(vp.zoom, googleZoomToCanvasZoom(15)),
      }));
    }
    return fix.point;
  };

  const handleToggleTracking = async () => {
    if (trackingLocation) {
      setTrackingLocation(false);
      showMessage(L10n.text(locale, 'gpsTrackingStopped'));
      return;
    }
    await handleCaptureGps(true);
    setTrackingLocation(true);
    showMessage(L10n.text(locale, 'gpsTrackingActive'));
  };

  const handleOpenPathfindingForMarker = async (marker: GisRegistryItem) => {
    setSelectedMarker(null);
    setRouteDestination(marker);
    if (!userLocation) {
      const pt = await handleCaptureGps(false);
      setRouteOrigin(pt);
    } else {
      setRouteOrigin(userLocation);
    }
    setShowRouteOnMap(true);
    setPathfindingOpen(true);
  };

  const handleJumpToArea = (area: OfflineAreaRecord) => {
    const center = boundsCenter(area.bounds);
    const mlZoom = Math.max(5, Math.min(15, (area.minZoom + area.maxZoom) / 2));
    const canvasZoom = googleZoomToCanvasZoom(mlZoom);
    setViewport({ centerLat: center.lat, centerLon: center.lon, zoom: canvasZoom });
    setDownloadOpen(false);
  };

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      <GisMapViewport
        locale={locale}
        markers={filteredMarkers}
        regions={regions}
        darkTheme={state.darkTheme}
        offlineMode={state.isEffectiveOffline}
        baseMapType={baseMapType}
        activeDetails={activeDetails}
        exclusiveMapTap={measureMode || emergencyMode}
        viewport={viewport}
        onViewportChange={setViewport}
        measurePoints={measurePoints}
        userLocation={userLocation}
        emergencyPin={emergencyPin}
        emergencyModeActive={emergencyMode}
        activeRoutePoints={activeRoutePoints}
        activeRouteWarning={activeRouteWarning}
        downloadPreviewBounds={downloadOpen ? previewBounds : null}
        savedAreaBounds={savedAreaBounds}
        hasCachedOfflineAreas={hasCachedOfflineAreas}
        isTrackingLocation={trackingLocation}
        onUserGestureStoppedTracking={() => setTrackingLocation(false)}
        selectedMarkerId={selectedMarker?.id ?? null}
        onMarkerTap={(m) => {
          setSelectedMarker(m);
          setClusterModal(null);
        }}
        onClusterTap={(cl) => {
          if (cl.items.length === 1) {
            setSelectedMarker(cl.items[0]);
          } else {
            setClusterModal(cl);
          }
        }}
        onMapTap={
          measureMode
            ? (pt) => setMeasurePoints((prev) => [...prev, pt])
            : emergencyMode
            ? (pt) => setEmergencyPin(pt)
            : () => setSelectedMarker(null)
        }
        onMapLongPress={(pt) => {
          setEmergencyMode(true);
          setEmergencyPin(pt);
        }}
        onTrafficCorridorTap={(corr) => {
          const title =
            locale === 'ru' ? corr.nameRu : locale === 'en' ? corr.nameEn : corr.nameUz;
          const levelKey =
            corr.level === 'free'
              ? 'trafficFree'
              : corr.level === 'moderate'
              ? 'trafficModerate'
              : corr.level === 'heavy'
              ? 'trafficHeavy'
              : 'trafficJam';
          showMessage(
            `${title} · ${L10n.text(locale, levelKey)} (${corr.speedKmh} km/h)`
          );
        }}
        onTransitStopTap={(st) => {
          const title = locale === 'ru' ? st.nameRu : locale === 'en' ? st.nameEn : st.nameUz;
          const modeKey =
            st.mode === 'metro'
              ? 'metroStation'
              : st.mode === 'rail'
              ? 'railStation'
              : 'busHub';
          showMessage(`${L10n.text(locale, modeKey)}: ${title}`);
        }}
        onStreetViewTap={(pt) => {
          const pano = buildStreetViewForPoint(pt);
          setActiveStreetViewPano(pano);
        }}
        onSdkBadgeClick={() => setSdkModalOpen(true)}
      />

      {/* Top Search & Group Chips Overlay */}
      <MapSearchOverlay
        locale={locale}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        visibleGroups={visibleGroups}
        groupCounts={groupCounts}
        onToggleGroup={handleToggleGroup}
        onShowAllGroups={() => setVisibleGroups(new Set(ALL_GROUPS))}
        hasActiveSheetFilters={hasActiveSheetFilters}
        onOpenFiltersSheet={() => setLayersModalOpen(true)}
      />

      {/* Emergency Mode Instructions Banner */}
      {emergencyMode && !emergencyPin && (
        <div
          data-testid="emergency_mode_banner"
          className="absolute top-[146px] left-3 right-16 z-10 max-w-xl rounded-2xl bg-[var(--error-container)]/95 border border-[var(--error)] p-3 shadow-lg space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-[var(--on-error-container)]">
              <AlertTriangle className="w-4 h-4 text-[var(--error)] shrink-0" />
              <span className="text-xs font-black tracking-wide">
                {L10n.text(locale, 'emergencyModeActive')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEmergencyMode(false);
                setEmergencyPin(null);
              }}
              className="p-0.5 text-[var(--on-error-container)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[var(--on-error-container)]">
            {L10n.text(locale, 'emergencyLongPressHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                const pt = await handleCaptureGps(true);
                setEmergencyPin(pt);
              }}
              data-testid="emergency_pin_gps_button"
              className="px-3 py-1.5 rounded-xl bg-[var(--error)] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>{L10n.text(locale, 'emergencyDropAtMyGps')}</span>
            </button>
            <button
              type="button"
              onClick={() => triggerPhoneCall('112', showMessage)}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--error)] text-[var(--error)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>112</span>
            </button>
          </div>
        </div>
      )}

      {/* Right-side compact floating controls toolbar */}
      <div className="absolute right-3 top-[40%] -translate-y-1/2 z-10 flex flex-col gap-1.5 rounded-2xl bg-[var(--surface)]/92 border border-[var(--outline)]/50 p-1.5 shadow-xl backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setLayersStripOpen((v) => !v)}
          title={L10n.text(locale, 'openMapLayersStrip')}
          data-testid="map_layers_strip_toggle_button"
          className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
            layersStripOpen
              ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)]'
              : 'hover:bg-[var(--surface-elevated)] text-[var(--ink)]'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setEmergencyMode((v) => !v);
            if (emergencyMode) setEmergencyPin(null);
          }}
          title={L10n.text(locale, 'emergencyMode')}
          data-testid="map_emergency_mode_button"
          className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
            emergencyMode
              ? 'bg-[var(--error)] text-white'
              : 'hover:bg-[var(--surface-elevated)] text-[var(--error)]'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
        </button>

        <div className="h-px bg-[var(--outline)]/35 mx-1" />

        <button
          type="button"
          onClick={() => setViewport((vp) => ({ ...vp, zoom: Math.min(256, vp.zoom * 1.65) }))}
          aria-label="Zoom in"
          data-testid="map_zoom_in_button"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--surface-elevated)] text-[var(--ink)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setViewport((vp) => ({ ...vp, zoom: Math.max(0.5, vp.zoom / 1.65) }))}
          aria-label="Zoom out"
          data-testid="map_zoom_out_button"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--surface-elevated)] text-[var(--ink)] cursor-pointer"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="h-px bg-[var(--outline)]/35 mx-1" />

        <button
          type="button"
          onClick={() => void handleToggleTracking()}
          title={L10n.text(locale, 'gps')}
          data-testid="map_gps_button"
          className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer ${
            trackingLocation
              ? 'bg-[var(--primary)] text-[var(--on-primary)]'
              : 'hover:bg-[var(--surface-elevated)] text-[var(--ink)]'
          }`}
        >
          <LocateFixed className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={async () => {
            if (!routeOrigin) {
              const pt = await handleCaptureGps(false);
              setRouteOrigin(pt);
            }
            if (!routeDestination && filteredMarkers.length > 0) {
              setRouteDestination(filteredMarkers[0]);
            }
            setPathfindingOpen(true);
          }}
          title={L10n.text(locale, 'pathfindingTitle')}
          data-testid="map_pathfinding_button"
          className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer ${
            showRouteOnMap
              ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)]'
              : 'hover:bg-[var(--surface-elevated)] text-[var(--ink)]'
          }`}
        >
          <Route className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setMeasureMode((m) => !m);
            if (measureMode) setMeasurePoints([]);
          }}
          title={L10n.text(locale, 'measure')}
          data-testid="map_measure_button"
          className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer ${
            measureMode
              ? 'bg-[var(--tertiary)] text-white'
              : 'hover:bg-[var(--surface-elevated)] text-[var(--ink)]'
          }`}
        >
          <Ruler className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setDownloadOpen(true)}
          title={L10n.text(locale, 'downloadArea')}
          data-testid="map_download_area_button"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--surface-elevated)] text-[var(--ink)] cursor-pointer"
        >
          <CloudDownload className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setViewport(DEFAULT_VIEWPORT)}
          title="Reset view"
          data-testid="map_reset_viewport_button"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-[var(--surface-elevated)] text-[var(--ink-muted)] cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Map Details Strip (Relyef, Tirbandlik, Jamoat transporti, Velosiped, Yana) */}
      {layersStripOpen && (
        <div className="absolute bottom-[126px] left-3.5 z-10 max-w-[calc(100%-5rem)]">
          <MapLayersStrip
            locale={locale}
            baseMapType={baseMapType}
            activeDetails={activeDetails}
            onToggleDetail={handleToggleDetailLayer}
            onOpenMore={() => setLayersModalOpen(true)}
          />
        </div>
      )}

      {/* Active Traffic Legend Pill when Traffic layer is enabled */}
      {activeDetails.has('traffic') && (
        <>
          <div
            data-testid="map_traffic_legend"
            className="hidden xl:inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[var(--surface)]/95 border border-[var(--outline)]/45 shadow-lg text-[11px] font-bold text-[var(--ink)] absolute bottom-3.5 left-1/2 -translate-x-1/2 z-10"
          >
            <span>{L10n.text(locale, 'liveTrafficLabel')}</span>
            <span className="h-3 w-px bg-[var(--outline)]/45" />
            <span className="text-[10px] text-[var(--ink-muted)] font-semibold">
              {L10n.text(locale, 'trafficFast')}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <span className="w-3 h-2 rounded-xs bg-[#10B981]" />
              <span className="w-3 h-2 rounded-xs bg-[#F59E0B]" />
              <span className="w-3 h-2 rounded-xs bg-[#EF4444]" />
              <span className="w-3 h-2 rounded-xs bg-[#991B1B]" />
            </span>
            <span className="text-[10px] text-[var(--ink-muted)] font-semibold">
              {L10n.text(locale, 'trafficSlow')}
            </span>
          </div>

          <div
            className="hidden sm:inline-flex xl:hidden items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)]/92 border border-[var(--outline)]/45 shadow-md text-[11px] font-bold text-[var(--ink)] absolute top-[106px] right-16 z-10"
          >
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: trafficColorHex('free') }}
              />
              {L10n.text(locale, 'trafficFree')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: trafficColorHex('moderate') }}
              />
              {L10n.text(locale, 'trafficModerate')}
            </span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: trafficColorHex('heavy') }}
              />
              {L10n.text(locale, 'trafficHeavy')}
            </span>
          </div>
        </>
      )}

      {/* Bottom-left stacked HUD badges */}
      <div className="absolute bottom-3.5 left-3.5 z-10 flex flex-col gap-2 items-start max-w-[calc(100%-9.5rem)]">
        {showRouteOnMap && calculatedPath && (
          <button
            type="button"
            onClick={() => setPathfindingOpen(true)}
            data-testid="map_active_route_hud"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] border border-[var(--primary)]/50 shadow-lg text-xs font-extrabold cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {formatDistanceMeters(calculatedPath.totalDistanceMeters)} ·{' '}
              {calculatedPath.estimatedMinutes} {L10n.text(locale, 'etaMinutes')} ·{' '}
              {L10n.text(locale, ACCESSIBILITY_STATUS_LABEL_KEY[calculatedPath.accessibilityStatus])}
            </span>
          </button>
        )}

        {queuedEmergencyCount > 0 && (
          <button
            type="button"
            onClick={() => onNavigate({ name: 'sync' })}
            data-testid="map_queued_emergency_hud"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border border-[var(--tertiary)] shadow-md text-xs font-extrabold cursor-pointer"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>
              {L10n.text(locale, 'queuedReportsBadge')}: {queuedEmergencyCount}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setMarkersListOpen(true)}
          data-testid="map_marker_count_hud"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--surface)]/95 border border-[var(--outline)]/55 shadow-lg text-xs font-extrabold text-[var(--ink)] cursor-pointer hover:bg-[var(--surface)]"
        >
          {measureMode ? (
            <>
              <Ruler className="w-3.5 h-3.5 text-[var(--tertiary)]" />
              <span className="font-mono tabular-nums">
                {L10n.text(locale, 'measure')}: {formatDistanceMeters(measureDistanceTotal)} ({measurePoints.length})
              </span>
            </>
          ) : (
            <>
              <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span className="tabular-nums">
                {filteredMarkers.length} {L10n.text(locale, 'markerCount')}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Bottom-right Street View Pegman Dock (above Add FAB) */}
      <div className="absolute bottom-[70px] right-3.5 z-10">
        <StreetViewDock
          locale={locale}
          viewportCenter={{ lat: viewport.centerLat, lon: viewport.centerLon }}
          streetViewActive={activeDetails.has('streetView')}
          onToggleStreetViewMode={() => handleToggleDetailLayer('streetView')}
          onSelectPanorama={(pano) => {
            setViewport((vp) => ({
              centerLat: pano.point.lat,
              centerLon: pano.point.lon,
              zoom: Math.max(vp.zoom, googleZoomToCanvasZoom(15)),
            }));
            setActiveStreetViewPano(pano);
          }}
        />
      </div>

      {/* Bottom-right Add Registry Item FAB */}
      <button
        type="button"
        onClick={() => {
          if (state.isEmployee) {
            onNavigate({ name: 'objectForm', objectId: null });
          } else {
            showMessage(L10n.text(locale, 'employeeRequiredForAdd'));
            onNavigate({ name: 'auth' });
          }
        }}
        data-testid="map_add_fab"
        title={L10n.text(locale, 'addRegistryItem')}
        className="absolute bottom-3.5 right-3.5 z-10 h-12 px-4 rounded-2xl bg-[var(--primary)] text-[var(--on-primary)] font-extrabold text-xs inline-flex items-center gap-2 shadow-xl hover:opacity-95 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">{L10n.text(locale, 'addRegistryItem')}</span>
      </button>

      {/* Modals */}
      <RegistryMarkerDetailSheet
        marker={selectedMarker}
        locale={locale}
        isEmployee={state.isEmployee}
        onDismiss={() => setSelectedMarker(null)}
        onCenterOnMarker={(m) => {
          setViewport({
            centerLat: m.markerCoordinate.lat,
            centerLon: m.markerCoordinate.lon,
            zoom: Math.max(viewport.zoom, googleZoomToCanvasZoom(16)),
          });
          setSelectedMarker(null);
        }}
        onFindRoute={(m) => void handleOpenPathfindingForMarker(m)}
        onOpenPassport={(id) => {
          setSelectedMarker(null);
          onNavigate({ name: 'passport', objectId: id });
        }}
      />

      {emergencyPin && (
        <EmergencyReportSheet
          locale={locale}
          pinLocation={emergencyPin}
          currentUserLocation={userLocation}
          currentAccuracyM={gpsAccuracyM}
          regions={regions}
          submitting={submittingEmergency}
          isOffline={state.isEffectiveOffline}
          onRequestCaptureGps={() => void handleCaptureGps(false)}
          onClearPin={() => setEmergencyPin(null)}
          onSubmitIncident={(catId, title, notes, regId) => {
            setSubmittingEmergency(true);
            submitEmergencyIncident(
              emergencyPin,
              userLocation,
              catId,
              title,
              notes,
              regId,
              (res) => {
                setSubmittingEmergency(false);
                setEmergencyPin(null);
                setEmergencyMode(false);
                showMessage(
                  res.queuedOffline
                    ? `${res.code} · ${L10n.text(locale, 'emergencyQueuedMsg')}`
                    : `${res.code} · ${L10n.text(locale, 'emergencySubmittedMsg')}`
                );
              }
            );
          }}
        />
      )}

      {pathfindingOpen && (
        <PathfindingSheet
          locale={locale}
          originLocation={routeOrigin ?? userLocation}
          destinationMarker={routeDestination}
          availableMarkers={filteredMarkers}
          selectedProfile={selectedProfile}
          avoidFaultyHazards={avoidFaultyHazards}
          pathResult={calculatedPath}
          onSelectDestination={(m) => setRouteDestination(m)}
          onSelectProfile={(p) => setSelectedProfile(p)}
          onToggleAvoidHazards={(v) => setAvoidFaultyHazards(v)}
          onRequestGpsFix={() => {
            void handleCaptureGps(false).then((pt) => setRouteOrigin(pt));
          }}
          onClearRoute={() => {
            setShowRouteOnMap(false);
            setPathfindingOpen(false);
          }}
          onShowOnMap={() => {
            setShowRouteOnMap(true);
            setPathfindingOpen(false);
            if (calculatedPath?.pathPoints[0]) {
              const p0 = calculatedPath.pathPoints[0];
              setViewport({
                centerLat: p0.lat,
                centerLon: p0.lon,
                zoom: googleZoomToCanvasZoom(13.5),
              });
            }
          }}
          onDismiss={() => setPathfindingOpen(false)}
        />
      )}

      {downloadOpen && (
        <DownloadAreaSheet
          locale={locale}
          regions={regions}
          currentViewport={viewport}
          savedAreas={savedOfflineAreas}
          creatingDownload={creatingOfflineArea}
          selectedAreaMode={downloadMode}
          selectedRegionId={downloadRegionId}
          selectedPreset={downloadPreset}
          previewBounds={previewBounds}
          onSelectMode={setDownloadMode}
          onSelectRegion={setDownloadRegionId}
          onSelectPreset={setDownloadPreset}
          onStartDownload={(areaName) => {
            startOfflineAreaDownload({
              name: areaName,
              bounds: previewBounds,
              minZoom: downloadPreset.minZoom,
              maxZoom: downloadPreset.maxZoom,
              onComplete: () => {},
            });
          }}
          onTogglePauseResume={toggleOfflineAreaPauseResume}
          onJumpToArea={handleJumpToArea}
          onDeleteArea={(id) =>
            deleteOfflineArea(id, () => showMessage(L10n.text(locale, 'downloadDeletedMsg')))
          }
          onDismiss={() => setDownloadOpen(false)}
        />
      )}

      {/* Cluster / All Markers Modal */}
      <ModalSheet
        open={Boolean(clusterModal) || markersListOpen}
        onClose={() => {
          setClusterModal(null);
          setMarkersListOpen(false);
        }}
        title={
          clusterModal
            ? `${L10n.text(locale, 'clusterObjects')} (${clusterModal.items.length})`
            : `${L10n.text(locale, 'markersList')} (${filteredMarkers.length})`
        }
      >
        <div className="space-y-2.5">
          {(clusterModal ? clusterModal.items : filteredMarkers).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setClusterModal(null);
                setMarkersListOpen(false);
                setSelectedMarker(m);
              }}
              className="w-full p-3 rounded-2xl bg-[var(--surface-elevated)]/55 border border-[var(--outline)]/45 flex items-center gap-3 text-left hover:bg-[var(--surface-elevated)] cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] flex items-center justify-center shrink-0">
                <CategoryIcon categoryId={m.categoryId} className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-[var(--primary)]">{m.code}</p>
                <p className="text-sm font-bold text-[var(--ink)] truncate">{m.name}</p>
                <p className="text-[11px] text-[var(--ink-muted)] truncate">
                  {m.categoryName} · {m.regionName}
                </p>
              </div>
              <StatusPill value={m.operationalStatus} locale={locale} />
            </button>
          ))}
        </div>
      </ModalSheet>

      {/* Layers, Map Type & Registry Filters Modal ("Yana") */}
      <ModalSheet
        open={layersModalOpen}
        onClose={() => setLayersModalOpen(false)}
        title={L10n.text(locale, 'layers')}
      >
        <div className="space-y-4">
          {/* Map Type Selector */}
          <div>
            <p className="text-xs font-bold text-[var(--ink-muted)] mb-2">
              {L10n.text(locale, 'mapTypeSection')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    type: 'standard' as BaseMapType,
                    label: L10n.text(locale, 'baseMapStandard'),
                    icon: <Globe className="w-5 h-5" />,
                  },
                  {
                    type: 'satellite' as BaseMapType,
                    label: L10n.text(locale, 'baseMapSatellite'),
                    icon: <Satellite className="w-5 h-5" />,
                  },
                  {
                    type: 'terrain' as BaseMapType,
                    label: L10n.text(locale, 'baseMapTerrain'),
                    icon: <Layers className="w-5 h-5" />,
                  },
                ]
              ).map((opt) => {
                const selected = baseMapType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setBaseMapType(opt.type)}
                    data-testid={`base_map_option_${opt.type}`}
                    className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 text-center cursor-pointer transition-all ${
                      selected
                        ? 'bg-[var(--primary-container)] border-[var(--primary)] text-[var(--on-primary-container)]'
                        : 'bg-[var(--surface-elevated)]/45 border-[var(--outline)]/40 text-[var(--ink)]'
                    }`}
                  >
                    {opt.icon}
                    <span className="text-[11px] font-bold leading-tight">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Map Details Grid */}
          <div>
            <p className="text-xs font-bold text-[var(--ink-muted)] mb-2">
              {L10n.text(locale, 'mapDetailsSection')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'relief' as MapDetailLayer, key: 'layerRelief' },
                  { id: 'traffic' as MapDetailLayer, key: 'layerTraffic' },
                  { id: 'transit' as MapDetailLayer, key: 'layerTransit' },
                  { id: 'cycling' as MapDetailLayer, key: 'layerCycling' },
                  { id: 'streetView' as MapDetailLayer, key: 'layerStreetView' },
                ]
              ).map((det) => {
                const active = activeDetails.has(det.id);
                return (
                  <button
                    key={det.id}
                    type="button"
                    onClick={() => handleToggleDetailLayer(det.id)}
                    data-testid={`detail_layer_toggle_${det.id}`}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 cursor-pointer ${
                      active
                        ? 'bg-[var(--primary-container)] border-[var(--primary)] text-[var(--on-primary-container)]'
                        : 'bg-[var(--surface-elevated)]/45 border-[var(--outline)]/40 text-[var(--ink)]'
                    }`}
                  >
                    <span className="truncate">{L10n.text(locale, det.key)}</span>
                    {det.id === 'transit' && <TrainFront className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[var(--outline)]/35" />

          <p className="text-xs font-bold text-[var(--ink-muted)]">
            {L10n.text(locale, 'registryFiltersSection')}
          </p>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'region')}
            </label>
            <select
              value={regionFilterId}
              onChange={(e) => setRegionFilterId(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
            >
              <option value="ALL">{L10n.text(locale, 'all')}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {localizedRegionName(r, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'category')}
            </label>
            <select
              value={categoryFilterId}
              onChange={(e) => setCategoryFilterId(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
            >
              <option value="ALL">{L10n.text(locale, 'all')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {localizedCategoryName(c, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink-muted)] mb-1">
              {L10n.text(locale, 'status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-11 rounded-xl border border-[var(--outline)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)]"
            >
              <option value="ALL">{L10n.text(locale, 'all')}</option>
              {['working', 'faulty', 'under_maintenance', 'temporarily_unavailable', 'unknown'].map(
                (st) => (
                  <option key={st} value={st}>
                    {L10n.text(locale, st)}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                setBaseMapType('standard');
                setActiveDetails(new Set());
                setRegionFilterId('ALL');
                setCategoryFilterId('ALL');
                setStatusFilter('ALL');
              }}
              className="flex-1 h-11 rounded-xl border border-[var(--outline)] text-xs font-bold text-[var(--ink)] cursor-pointer"
            >
              {L10n.text(locale, 'cancel')}
            </button>
            <button
              type="button"
              onClick={() => setLayersModalOpen(false)}
              className="flex-1 h-11 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-bold cursor-pointer"
            >
              {L10n.text(locale, 'continue')}
            </button>
          </div>
        </div>
      </ModalSheet>

      {/* Interactive 360 Street View Panorama Modal */}
      <StreetViewModal
        panorama={activeStreetViewPano}
        locale={locale}
        markers={filteredMarkers}
        useGoogleStreetView={!state.isEffectiveOffline && Boolean(getGoogleMapsApiKey())}
        onSelectPanorama={(pano) => setActiveStreetViewPano(pano)}
        onCenterOnPoint={(pt) => {
          setViewport((vp) => ({
            centerLat: pt.lat,
            centerLon: pt.lon,
            zoom: Math.max(vp.zoom, googleZoomToCanvasZoom(16)),
          }));
        }}
        onPinEmergencyHere={(pt) => {
          setEmergencyMode(true);
          setEmergencyPin(pt);
        }}
        onSelectMarker={(m) => setSelectedMarker(m)}
        onClose={() => setActiveStreetViewPano(null)}
      />

      {/* SDK / Map Engine Info Modal */}
      <ModalSheet
        open={sdkModalOpen}
        onClose={() => setSdkModalOpen(false)}
        title={L10n.text(locale, 'gisSdkStatusTitle')}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 text-[var(--primary)] font-bold text-sm">
            <Globe className="w-5 h-5" />
            <span>
              {!state.isEffectiveOffline && Boolean(getGoogleMapsApiKey())
                ? L10n.text(locale, 'googleMapsEngineValue')
                : L10n.text(locale, 'realMapEngineValue')}
            </span>
          </div>
          <p className="text-sm text-[var(--ink-muted)] leading-relaxed">
            {!state.isEffectiveOffline && Boolean(getGoogleMapsApiKey())
              ? L10n.text(locale, 'googleMapsHint')
              : L10n.text(locale, 'realMapHint')}
          </p>
          <div className="rounded-xl bg-[var(--surface-elevated)]/60 border border-[var(--outline)]/40 px-4 py-2 divide-y divide-[var(--outline)]/35">
            <DataRowView
              label={L10n.text(locale, 'gisSdkEngine')}
              value={
                state.isEffectiveOffline && !hasCachedOfflineAreas
                  ? L10n.text(locale, 'realMapOfflineBadge')
                  : !state.isEffectiveOffline && Boolean(getGoogleMapsApiKey())
                  ? L10n.text(locale, 'googleMapsBadge')
                  : L10n.text(locale, 'realMapBadge')
              }
            />
            <DataRowView
              label={L10n.text(locale, 'gisSdkTarget')}
              value={
                !state.isEffectiveOffline && Boolean(getGoogleMapsApiKey())
                  ? L10n.text(locale, 'googleMapsEngineValue')
                  : L10n.text(locale, 'realMapEngineValue')
              }
            />
            <DataRowView
              label={L10n.text(locale, 'savedOfflineAreas')}
              value={savedOfflineAreas.length}
              mono
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSdkModalOpen(false);
              setDownloadOpen(true);
            }}
            className="w-full h-11 rounded-xl bg-[var(--primary-container)] text-[var(--on-primary-container)] text-xs font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
            <span>{L10n.text(locale, 'downloadArea')}</span>
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
