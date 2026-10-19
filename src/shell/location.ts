/** One-shot location read. No continuous tracking. */

export type LocationError = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

export interface Position {
  lat: number;
  lon: number;
}

export function readLocationOnce(): Promise<Position> {
  return new Promise((resolve, reject: (reason: LocationError) => void) => {
    if (!('geolocation' in navigator)) {
      reject('unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) =>
        reject(
          err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable',
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}
