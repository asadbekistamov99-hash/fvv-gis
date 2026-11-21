import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  MoveHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { GeoUtils } from '../core/geoUtils';
import { L10n } from '../core/localization';
import { STREET_VIEW_PANORAMAS } from '../data/mapLayersData';
import { AppLocale, GeoPoint, GisRegistryItem, StreetViewPanorama } from '../types/gis';

interface StreetViewModalProps {
  panorama: StreetViewPanorama | null;
  locale: AppLocale;
  markers: GisRegistryItem[];
  useGoogleStreetView?: boolean;
  onSelectPanorama: (pano: StreetViewPanorama) => void;
  onCenterOnPoint: (pt: GeoPoint) => void;
  onPinEmergencyHere: (pt: GeoPoint) => void;
  onSelectMarker: (marker: GisRegistryItem) => void;
  onClose: () => void;
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function compassCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(normalizeDeg(deg) / 45) % 8];
}

interface GoogleStreetViewHostProps {
  point: GeoPoint;
  defaultHeadingDeg: number;
  onResolved: (hasGoogleImagery: boolean) => void;
}

const GoogleStreetViewHost: React.FC<GoogleStreetViewHostProps> = ({
  point,
  defaultHeadingDeg,
  onResolved,
}) => {
  const streetViewLib = useMapsLibrary('streetView');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panoInstanceRef = useRef<google.maps.StreetViewPanorama | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!streetViewLib || !containerRef.current) return;

    const sv = new streetViewLib.StreetViewService();
    sv.getPanorama({
      location: { lat: point.lat, lng: point.lon },
      radius: 2500,
      preference: streetViewLib.StreetViewPreference.NEAREST,
      source: streetViewLib.StreetViewSource.DEFAULT,
    })
      .then((res) => {
        if (cancelled || !containerRef.current) return;
        const panoId = res?.data?.location?.pano;
        if (!panoId) {
          onResolved(false);
          return;
        }
        onResolved(true);
        if (!panoInstanceRef.current) {
          panoInstanceRef.current = new streetViewLib.StreetViewPanorama(
            containerRef.current,
            {
              pano: panoId,
              pov: { heading: defaultHeadingDeg, pitch: 0 },
              visible: true,
              addressControl: true,
              linksControl: true,
              panControl: true,
              zoomControl: true,
              fullscreenControl: false,
              enableCloseButton: false,
              motionTracking: false,
            }
          );
        } else {
          panoInstanceRef.current.setPano(panoId);
          panoInstanceRef.current.setPov({ heading: defaultHeadingDeg, pitch: 0 });
          panoInstanceRef.current.setVisible(true);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = String(err ?? '');
        if (msg.includes('OVER_QUERY_LIMIT') || msg.includes('RESOURCE_EXHAUSTED')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onResolved(false);
      });

    return () => {
      cancelled = true;
    };
  }, [streetViewLib, point.lat, point.lon, defaultHeadingDeg, onResolved]);

  return (
    <div
      ref={containerRef}
      data-testid="google_street_view_pano"
      className="w-full h-full min-h-[240px]"
    />
  );
};

export const StreetViewModal: React.FC<StreetViewModalProps> = ({
  panorama,
  locale,
  markers,
  useGoogleStreetView = false,
  onSelectPanorama,
  onCenterOnPoint,
  onPinEmergencyHere,
  onSelectMarker,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });
  const [headingDeg, setHeadingDeg] = useState(0);
  const [fovZoom, setFovZoom] = useState(1);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  useEffect(() => {
    if (panorama) {
      setHeadingDeg(panorama.defaultHeadingDeg);
      setFovZoom(1);
      setGoogleAvailable(false);
    }
  }, [panorama]);

  const nearbyMarkers = useMemo(() => {
    if (!panorama) return [];
    return markers
      .map((m) => ({
        marker: m,
        distM: GeoUtils.distanceMeters(panorama.point, m.markerCoordinate),
      }))
      .sort((a, b) => a.distM - b.distM)
      .slice(0, 4);
  }, [panorama, markers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !panorama || googleAvailable) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 720;
    const h = canvas.clientHeight || 340;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { palette, landmarks } = panorama;
    const horizonY = h * 0.56;
    const fov = 95 / fovZoom;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, palette.skyTop);
    skyGrad.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, horizonY);

    // Asphalt road / ground gradient
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, palette.ground);
    groundGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    const bearingToX = (bearing: number) => {
      let diff = normalizeDeg(bearing - headingDeg);
      if (diff > 180) diff -= 360;
      return w / 2 + (diff / fov) * w;
    };

    for (let deg = 0; deg < 360; deg += 20) {
      const bx = bearingToX(deg);
      if (bx < -80 || bx > w + 80) continue;
      const seedH = 26 + ((deg * 17) % 46);
      const bw = 22 * fovZoom;
      ctx.fillStyle = palette.horizon;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(bx - bw / 2, horizonY - seedH, bw, seedH);
      ctx.globalAlpha = 1;
    }

    const roadAxisX = bearingToX(headingDeg);
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(roadAxisX - 24 * fovZoom, horizonY);
    ctx.lineTo(roadAxisX + 24 * fovZoom, horizonY);
    ctx.lineTo(w * 0.88, h);
    ctx.lineTo(w * 0.12, h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, horizonY + 8);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();
    ctx.setLineDash([]);

    landmarks.forEach((lm) => {
      const lx = bearingToX(lm.bearingDeg);
      if (lx < -120 || lx > w + 120) return;

      ctx.save();
      if (lm.kind === 'dome') {
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(lx - 38 * fovZoom, horizonY - 48 * fovZoom, 76 * fovZoom, 48 * fovZoom);
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(lx, horizonY - 48 * fovZoom, 32 * fovZoom, Math.PI, 0);
        ctx.fill();
      } else if (lm.kind === 'tower') {
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx - 14 * fovZoom, horizonY - 108 * fovZoom, 28 * fovZoom, 108 * fovZoom);
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(lx, horizonY - 112 * fovZoom, 8 * fovZoom, 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.kind === 'arch') {
        ctx.fillStyle = '#B45309';
        ctx.fillRect(lx - 42 * fovZoom, horizonY - 72 * fovZoom, 84 * fovZoom, 72 * fovZoom);
        ctx.fillStyle = '#0EA5E9';
        ctx.beginPath();
        ctx.arc(lx, horizonY - 26 * fovZoom, 20 * fovZoom, Math.PI, 0);
        ctx.fill();
      } else if (lm.kind === 'mountain') {
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(lx - 90 * fovZoom, horizonY);
        ctx.lineTo(lx, horizonY - 120 * fovZoom);
        ctx.lineTo(lx + 90 * fovZoom, horizonY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(lx - 26 * fovZoom, horizonY - 85 * fovZoom);
        ctx.lineTo(lx, horizonY - 120 * fovZoom);
        ctx.lineTo(lx + 26 * fovZoom, horizonY - 85 * fovZoom);
        ctx.closePath();
        ctx.fill();
      } else if (lm.kind === 'park') {
        ctx.fillStyle = '#15803D';
        ctx.beginPath();
        ctx.arc(lx - 18, horizonY - 24 * fovZoom, 22 * fovZoom, 0, Math.PI * 2);
        ctx.arc(lx + 14, horizonY - 30 * fovZoom, 26 * fovZoom, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx - 36 * fovZoom, horizonY - 76 * fovZoom, 72 * fovZoom, 76 * fovZoom);
        ctx.fillStyle = '#93C5FD';
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 4; c++) {
            ctx.fillRect(
              lx - 28 * fovZoom + c * 15 * fovZoom,
              horizonY - 66 * fovZoom + r * 18 * fovZoom,
              9 * fovZoom,
              10 * fovZoom
            );
          }
        }
      }

      const label = locale === 'ru' ? lm.labelRu : locale === 'en' ? lm.labelEn : lm.labelUz;
      ctx.font = '700 11px "Noto Sans", sans-serif';
      const tw = ctx.measureText(label).width;
      const px = Math.max(8, Math.min(w - tw - 24, lx - (tw + 16) / 2));
      const py = Math.max(12, horizonY - 135 * fovZoom);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(px, py, tw + 16, 24, 8);
      ctx.fill();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(label, px + 8, py + 15.5);
      ctx.restore();
    });
  }, [panorama, headingDeg, fovZoom, locale, googleAvailable]);

  if (!panorama) return null;

  const title =
    locale === 'ru' ? panorama.titleRu : locale === 'en' ? panorama.titleEn : panorama.titleUz;
  const subtitle =
    locale === 'ru'
      ? panorama.subtitleRu
      : locale === 'en'
      ? panorama.subtitleEn
      : panorama.subtitleUz;

  const currentIdx = STREET_VIEW_PANORAMAS.findIndex((p) => p.id === panorama.id);
  const handleStep = (delta: number) => {
    const baseIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx =
      (baseIdx + delta + STREET_VIEW_PANORAMAS.length) % STREET_VIEW_PANORAMAS.length;
    onSelectPanorama(STREET_VIEW_PANORAMAS[nextIdx]);
  };

  return (
    <div
      data-testid="street_view_modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5"
    >
      <div className="w-full max-w-3xl rounded-3xl bg-[var(--surface)] border border-[var(--outline)]/55 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--outline)]/35">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 text-[10px] font-black uppercase tracking-wider">
                {googleAvailable ? 'Google Street View 360°' : `360° ${L10n.text(locale, 'layerStreetView')}`}
              </span>
              <span className="text-[11px] font-mono text-[var(--ink-muted)]">
                {panorama.point.lat.toFixed(4)}°N, {panorama.point.lon.toFixed(4)}°E
              </span>
            </div>
            <h3 className="text-base font-extrabold text-[var(--ink)] truncate mt-0.5">{title}</h3>
            <p className="text-xs text-[var(--ink-muted)] truncate">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="street_view_close_button"
            className="w-9 h-9 rounded-xl bg-[var(--surface-elevated)] text-[var(--ink)] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive 360 Panorama Host */}
        <div className="relative h-72 sm:h-96 w-full bg-slate-900 select-none overflow-hidden">
          {useGoogleStreetView && (
            <div className={`absolute inset-0 ${googleAvailable ? 'z-10' : 'opacity-0 pointer-events-none'}`}>
              <GoogleStreetViewHost
                point={panorama.point}
                defaultHeadingDeg={panorama.defaultHeadingDeg}
                onResolved={setGoogleAvailable}
              />
            </div>
          )}

          {!googleAvailable && (
            <>
              <canvas
                ref={canvasRef}
                onPointerDown={(e) => {
                  dragRef.current = { active: true, lastX: e.clientX };
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current.active) return;
                  const dx = e.clientX - dragRef.current.lastX;
                  dragRef.current.lastX = e.clientX;
                  setHeadingDeg((h) => normalizeDeg(h - dx * 0.45));
                }}
                onPointerUp={() => {
                  dragRef.current.active = false;
                }}
                onPointerLeave={() => {
                  dragRef.current.active = false;
                }}
                className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
              />

              {/* Top-left Compass + Drag Hint */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/65 text-white text-xs font-mono font-bold backdrop-blur-sm">
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {Math.round(headingDeg)}° {compassCardinal(headingDeg)}
                  </span>
                </div>
                <div className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-black/55 text-white/85 text-[11px] font-semibold">
                  <MoveHorizontal className="w-3.5 h-3.5" />
                  <span>{L10n.text(locale, 'dragToRotate360')}</span>
                </div>
              </div>

              {/* Right Zoom & Pan Controls */}
              <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setFovZoom((z) => Math.min(2.2, z + 0.25))}
                  className="w-8 h-8 rounded-lg bg-black/65 text-white flex items-center justify-center hover:bg-black/80 cursor-pointer"
                  aria-label="Zoom in panorama"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFovZoom((z) => Math.max(0.75, z - 0.25))}
                  className="w-8 h-8 rounded-lg bg-black/65 text-white flex items-center justify-center hover:bg-black/80 cursor-pointer"
                  aria-label="Zoom out panorama"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Left/Right Panorama Spot Switcher */}
          <button
            type="button"
            onClick={() => handleStep(-1)}
            className="absolute left-3 bottom-3 z-20 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-black/85 cursor-pointer"
            aria-label="Previous street view spot"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleStep(1)}
            className="absolute right-3 bottom-3 z-20 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center hover:bg-black/85 cursor-pointer"
            aria-label="Next street view spot"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Footer: Nearby FVV Objects & Quick Actions */}
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onCenterOnPoint(panorama.point);
                onClose();
              }}
              className="flex-1 min-w-[150px] h-10 rounded-xl bg-[var(--primary)] text-[var(--on-primary)] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>{L10n.text(locale, 'centerOnMap')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onPinEmergencyHere(panorama.point);
                onClose();
              }}
              data-testid="street_view_pin_incident_button"
              className="flex-1 min-w-[150px] h-10 rounded-xl bg-[var(--error)] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{L10n.text(locale, 'pinHazardHere')}</span>
            </button>
          </div>

          {nearbyMarkers.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-1.5">
                {L10n.text(locale, 'nearbyFvvObjects')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {nearbyMarkers.map(({ marker, distM }) => (
                  <button
                    key={marker.id}
                    type="button"
                    onClick={() => {
                      onSelectMarker(marker);
                      onClose();
                    }}
                    className="p-2 rounded-xl bg-[var(--surface-elevated)]/65 border border-[var(--outline)]/40 text-left flex items-center justify-between gap-2 hover:bg-[var(--surface-elevated)] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold text-[var(--primary)]">{marker.code}</p>
                      <p className="text-xs font-bold text-[var(--ink)] truncate">{marker.name}</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[var(--ink-muted)] shrink-0">
                      {distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
