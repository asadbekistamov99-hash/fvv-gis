import { GeoPoint } from '../types/gis';

export interface LocationFix {
  point: GeoPoint;
  accuracyMeters: number;
  usedFallback: boolean;
}

const DEFAULT_TASHKENT_FALLBACK: GeoPoint = { lat: 41.2995, lon: 69.2401 };

export function requestBrowserGpsFix(): Promise<LocationFix> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ point: DEFAULT_TASHKENT_FALLBACK, accuracyMeters: 18.0, usedFallback: true });
      return;
    }

    let settled = false;
    const finish = (fix: LocationFix) => {
      if (settled) return;
      settled = true;
      resolve(fix);
    };

    const fallbackTimer = window.setTimeout(() => {
      finish({ point: DEFAULT_TASHKENT_FALLBACK, accuracyMeters: 18.0, usedFallback: true });
    }, 3500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(fallbackTimer);
        finish({
          point: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          accuracyMeters: pos.coords.accuracy || 12.0,
          usedFallback: false,
        });
      },
      () => {
        window.clearTimeout(fallbackTimer);
        finish({ point: DEFAULT_TASHKENT_FALLBACK, accuracyMeters: 18.0, usedFallback: true });
      },
      { enableHighAccuracy: true, timeout: 3000, maximumAge: 30000 }
    );
  });
}
