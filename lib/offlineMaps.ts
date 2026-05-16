import Mapbox from "@rnmapbox/maps";
import { NativeModules } from "react-native";

// ─── Konfiguracja paczki offline ─────────────────────────────────────────────
// MVP: jedna predefiniowana paczka obejmująca obszar Bodensee i Allgäu.
// Bounding box jest celowo konserwatywny — pokrywa region od zachodniego
// Bodensee (Konstanz/Singen) po wschodnie Allgäu (Füssen/Oberstdorf), aby
// uniknąć pobierania ogromnej ilości kafelków. Zakres zoomów: 6–14
// (poziom kraju → poziom ulic w miastach turystycznych).

export const OFFLINE_PACK_NAME = "bodensee-allgaeu";

export const OFFLINE_PACK_BOUNDS: {
  ne: [number, number];
  sw: [number, number];
} = {
  // [longitude, latitude]
  // NE — Füssen / Oberstdorf / Memmingen-okolice
  ne: [10.85, 47.95],
  // SW — Singen / zachodni Bodensee
  sw: [8.7, 47.4],
};

export const OFFLINE_MIN_ZOOM = 6;
export const OFFLINE_MAX_ZOOM = 14;

// Styl mapy — MUSI być zgodny ze stylem używanym w ekranie Karte
// (app/(tabs)/karte.tsx → MapView styleURL={Mapbox.StyleURL.Street}).
// Jeśli styl zostanie zmieniony w karte.tsx, należy zaktualizować również tę
// stałą — inaczej paczka offline pobierze inne kafelki niż renderowane online.
export const OFFLINE_STYLE_URL = Mapbox.StyleURL.Street;

// Czytelna nazwa do wyświetlenia w UI (de-DE).
export const OFFLINE_PACK_LABEL = "Bodensee & Allgäu";

// ─── Typy ────────────────────────────────────────────────────────────────────

export type OfflinePackState =
  | "unknown"
  | "inactive"
  | "active"
  | "complete";

export interface OfflinePackStatus {
  name: string;
  state: OfflinePackState;
  percentage: number;
  completedResourceCount: number;
  completedResourceSize: number;
  completedTileCount: number;
  completedTileSize: number;
  requiredResourceCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Surowy status zwracany przez RNMapbox. `state` to natywna stała —
// na iOS/Android może być liczbą lub stringiem (zależnie od platformy),
// dlatego porównujemy ją do RNMBXModule.OfflinePackDownloadState zamiast do
// zahardkodowanych wartości. RNMapbox zna tylko stany Inactive/Active/Complete
// (brak stanu "Invalid" w v10).
type RawPackStatus = {
  name?: string;
  state?: number | string;
  percentage?: number;
  completedResourceCount?: number;
  completedResourceSize?: number;
  completedTileCount?: number;
  completedTileSize?: number;
  requiredResourceCount?: number;
};

type DownloadStateConsts = {
  Inactive: string | number;
  Active: string | number;
  Complete: string | number;
};

function getDownloadStateConsts(): DownloadStateConsts | null {
  const mod = NativeModules.RNMBXModule as
    | { OfflinePackDownloadState?: DownloadStateConsts }
    | undefined;
  return mod?.OfflinePackDownloadState ?? null;
}

function mapState(state: number | string | undefined): OfflinePackState {
  if (state === undefined || state === null) return "unknown";

  const consts = getDownloadStateConsts();
  if (consts) {
    if (state === consts.Complete) return "complete";
    if (state === consts.Active) return "active";
    if (state === consts.Inactive) return "inactive";
  }

  // Fallback, gdyby natywne stałe były niedostępne — RNMapbox historycznie
  // używa 0=Inactive, 1=Active, 2=Complete oraz odpowiadających im stringów.
  if (typeof state === "string") {
    const s = state.toLowerCase();
    if (s === "inactive" || s === "active" || s === "complete") return s;
  }
  if (state === 0) return "inactive";
  if (state === 1) return "active";
  if (state === 2) return "complete";

  return "unknown";
}

export function normalizeStatus(raw: RawPackStatus): OfflinePackStatus {
  return {
    name: raw.name ?? OFFLINE_PACK_NAME,
    state: mapState(raw.state),
    percentage: typeof raw.percentage === "number" ? raw.percentage : 0,
    completedResourceCount: raw.completedResourceCount ?? 0,
    completedResourceSize: raw.completedResourceSize ?? 0,
    completedTileCount: raw.completedTileCount ?? 0,
    completedTileSize: raw.completedTileSize ?? 0,
    requiredResourceCount: raw.requiredResourceCount ?? 0,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Zwraca aktualny status paczki offline lub `null`, jeśli paczka nie istnieje.
 */
export async function getOfflinePackStatus(): Promise<OfflinePackStatus | null> {
  try {
    const pack = await Mapbox.offlineManager.getPack(OFFLINE_PACK_NAME);
    if (!pack) return null;
    const raw = (await pack.status()) as RawPackStatus;
    return normalizeStatus(raw);
  } catch {
    return null;
  }
}

/**
 * Rozpoczyna pobieranie paczki offline. Jeśli paczka już istnieje, zwraca jej
 * aktualny status bez ponownego tworzenia.
 *
 * Callbacki `onProgress` i `onError` są wywoływane przez natywny moduł RNMapbox
 * w trakcie pobierania. Wartość zwracana to status z momentu zakończenia
 * wywołania `createPack` (zwykle stan początkowy, 0 %).
 *
 * UWAGA: `createPack` rejestruje przekazane listenery w singletonie
 * `offlineManager`. Po zakończeniu pobierania (lub przy odmontowaniu ekranu)
 * należy wywołać `unsubscribeOfflinePack()`, aby zwolnić referencje.
 */
export async function startOfflinePackDownload(
  onProgress: (status: OfflinePackStatus) => void,
  onError: (error: { message: string }) => void,
): Promise<OfflinePackStatus> {
  const existing = await getOfflinePackStatus();
  if (existing) return existing;

  const progressListener = (_pack: unknown, status: RawPackStatus) => {
    onProgress(normalizeStatus(status));
  };
  const errorListener = (_pack: unknown, err: unknown) => {
    const message =
      typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "Unbekannter Fehler beim Herunterladen der Offline-Karte.";
    onError({ message });
  };

  await Mapbox.offlineManager.createPack(
    {
      name: OFFLINE_PACK_NAME,
      styleURL: OFFLINE_STYLE_URL,
      bounds: [OFFLINE_PACK_BOUNDS.ne, OFFLINE_PACK_BOUNDS.sw],
      minZoom: OFFLINE_MIN_ZOOM,
      maxZoom: OFFLINE_MAX_ZOOM,
    },
    progressListener,
    errorListener,
  );

  const status = await getOfflinePackStatus();
  return (
    status ?? {
      name: OFFLINE_PACK_NAME,
      state: "active",
      percentage: 0,
      completedResourceCount: 0,
      completedResourceSize: 0,
      completedTileCount: 0,
      completedTileSize: 0,
      requiredResourceCount: 0,
    }
  );
}

/**
 * Wyrejestrowuje listenery powiązane z paczką offline. Należy wywołać przy
 * odmontowaniu ekranu, aby RNMapbox nie trzymał starych closure.
 */
export function unsubscribeOfflinePack(): void {
  try {
    Mapbox.offlineManager.unsubscribe(OFFLINE_PACK_NAME);
  } catch {
    // Brak subskrypcji — bezpiecznie ignorujemy.
  }
}

/**
 * Usuwa paczkę offline. No-op, jeśli paczka nie istnieje.
 */
export async function deleteOfflinePack(): Promise<void> {
  try {
    const pack = await Mapbox.offlineManager.getPack(OFFLINE_PACK_NAME);
    if (!pack) return;
    await Mapbox.offlineManager.deletePack(OFFLINE_PACK_NAME);
  } catch {
    // Brak paczki / błąd natywny — traktujemy jako zakończone.
  }
}

/**
 * Konwersja rozmiaru w bajtach na czytelny ciąg po niemiecku (KB / MB).
 */
export function formatPackSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }
  return `${mb.toFixed(1)} MB`;
}
