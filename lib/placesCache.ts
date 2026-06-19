import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DirectusOrte, DirectusKategorie, DirectusEinstellungen } from "@/types";

// ─── Offline cache danych Directusa ──────────────────────────────────────────
//
// Cache obejmuje pełny wynik fetchAll (places + categories + einstellungen) —
// te same dane, które normalnie trzymane są w RAM przez placesStore. Dzięki
// temu po restarcie aplikacji bez internetu mapa nadal pokazuje piny, a ekran
// szczegółów ma komplet pól.
//
// Cache zapisywany jest świadomie tylko po udanym pobraniu paczki mapy offline
// (funkcja premium). fetchAll używa go jako fallbacku, gdy brak sieci.

const CACHE_KEY = "fairfuhrer.placesCache.v1";

export interface PlacesCachePayload {
  places: DirectusOrte[];
  categories: DirectusKategorie[];
  einstellungen: DirectusEinstellungen | null;
}

export interface PlacesCacheEnvelope extends PlacesCachePayload {
  // Unix-ms znacznik czasu zapisania cache — do wyświetlenia
  // „Zuletzt aktualisiert" i do polityki odświeżania.
  savedAt: number;
}

/**
 * Zapisuje dane Directusa do lokalnego cache. Wywoływane po udanym pobraniu
 * paczki mapy offline. Błąd zapisu jest świadomie połykany — brak cache nie
 * może zablokować ukończenia pobierania paczki.
 */
export async function savePlacesCache(payload: PlacesCachePayload): Promise<void> {
  try {
    const envelope: PlacesCacheEnvelope = {
      ...payload,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // Brak miejsca / błąd storage — cache po prostu nie powstanie.
  }
}

/**
 * Wczytuje cache danych Directusa lub `null`, jeśli cache nie istnieje albo
 * jest uszkodzony.
 */
export async function loadPlacesCache(): Promise<PlacesCacheEnvelope | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlacesCacheEnvelope>;
    if (!Array.isArray(parsed.places) || !Array.isArray(parsed.categories)) {
      return null;
    }
    return {
      places: parsed.places,
      categories: parsed.categories,
      einstellungen: parsed.einstellungen ?? null,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Czy lokalny cache danych istnieje. Lekki sprawdzian bez deserializacji
 * całego payloadu — przydatny dla UI (np. status sekcji offline).
 */
export async function hasPlacesCache(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw !== null;
  } catch {
    return false;
  }
}

// Po ilu dniach lokalne dane uznajemy za potencjalnie nieaktualne i
// zachęcamy użytkownika do odświeżenia.
export const CACHE_STALE_AFTER_DAYS = 30;

/**
 * Czy cache jest starszy niż próg CACHE_STALE_AFTER_DAYS. Zwraca `false` dla
 * braku/nieprawidłowego znacznika (brak danych ≠ nieaktualne dane).
 */
export function isCacheStale(savedAt: number | undefined): boolean {
  if (!savedAt || savedAt <= 0) return false;
  const ageMs = Date.now() - savedAt;
  return ageMs > CACHE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Formatuje znacznik czasu cache (Unix-ms) na czytelną datę de-DE
 * w formacie DD.MM.YYYY. Zwraca `null` dla braku/nieprawidłowej wartości.
 */
export function formatCacheDate(savedAt: number | undefined): string | null {
  if (!savedAt || savedAt <= 0) return null;
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/**
 * Usuwa cache danych. Wywoływane przy usuwaniu paczki offline, aby offline
 * mapa i offline piny były spójne (usunięcie jednego usuwa oba).
 */
export async function clearPlacesCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Brak cache / błąd storage — traktujemy jako zakończone.
  }
}
