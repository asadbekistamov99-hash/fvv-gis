export function getGoogleMapsApiKey(): string {
  const viteKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  if (viteKey) return viteKey;
  if (typeof window !== 'undefined') {
    const winKey = (window as unknown as Record<string, unknown>).GOOGLE_MAPS_API_KEY;
    if (typeof winKey === 'string' && winKey.trim()) {
      return winKey.trim();
    }
  }
  const fallback = typeof __GMP_FALLBACK_KEY__ === 'string' ? __GMP_FALLBACK_KEY__.trim() : '';
  return fallback;
}

export function canvasZoomToGoogleZoom(canvasZoom: number): number {
  const log2 = Math.log(Math.max(0.5, canvasZoom)) / Math.LN2;
  return Math.max(4, Math.min(21, 5.2 + 2.2 * log2));
}

export function googleZoomToCanvasZoom(googleZoom: number): number {
  return Math.max(0.5, Math.min(256, Math.pow(2, (googleZoom - 5.2) / 2.2)));
}
