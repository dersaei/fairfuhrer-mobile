// Gemeinsame Standort-Helfer für Karte (useTabGpsCenter) und Liste
// (useGpsSort). Beide Hooks hatten dieselbe Aufgabe und dieselbe Falle —
// der Timeout lag aber nur in einem von beiden.

const POSITION_TIMEOUT_MS = 10000;

/**
 * getCurrentPositionAsync kann endlos hängen, wenn das Gerät keinen Fix
 * bekommt. Ohne Timeout bleibt der aufrufende Hook dauerhaft "in flight"
 * und versucht es nie wieder — bis die App neu gestartet wird.
 *
 * Der Timer wird auch im Erfolgsfall aufgeräumt, sonst bliebe bei jedem
 * Tab-Wechsel ein hängendes setTimeout zurück.
 */
export function withPositionTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`getCurrentPositionAsync timeout (${POSITION_TIMEOUT_MS / 1000}s)`)),
      POSITION_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
