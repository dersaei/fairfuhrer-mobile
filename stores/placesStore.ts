import { create } from "zustand";
import { readItems } from "@directus/sdk";
import { directus } from "@/lib/directus";
import { loadPlacesCache, savePlacesCache } from "@/lib/placesCache";
import type { DirectusOrte, DirectusKategorie, DirectusEinstellungen } from "@/types";

// ─── Sehenswürdigkeiten gating ───────────────────────────────────────────────
//
// Free accounts see ALL pins in EVERY category EXCEPT "Sehenswertes"
// (Directus category, env-overridable id). For Sehenswertes-tagged places
// we select a deterministic top-N subset by stable hash so the free user
// always sees exactly ceil(0.2 * N) places — same set across devices.
// Premium sees 100 %.
//
// Detection priority:
//   1. EXPO_PUBLIC_SIGHTS_CATEGORY_ID — explicit override (preferred)
//   2. Fallback: normalized German name starts with "sehen"
//      (matches "Sehenswertes" and "Sehenswürdigkeiten").
//
// A place tagged with Sehenswertes + any other category is still treated as
// Sehenswertes and is subject to the 20 % cap.
const FREE_VISIBLE_RATIO = 0.2;

function normalizeGerman(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .trim();
}

function envSightsCategoryId(): number | null {
  const raw = process.env.EXPO_PUBLIC_SIGHTS_CATEGORY_ID;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function isSightsCategory(cat: DirectusKategorie | undefined | null): boolean {
  if (!cat) return false;
  const overrideId = envSightsCategoryId();
  if (overrideId !== null && cat.id === overrideId) return true;
  return normalizeGerman(cat.Name ?? "").startsWith("sehen");
}

export const FREE_SIGHTS_VISIBLE_RATIO = FREE_VISIBLE_RATIO;

function placeHasSights(place: DirectusOrte, sightsCategoryIds: Set<number>): boolean {
  if (!place.Kategorie) return false;
  return place.Kategorie.some((k) => k.Kategorie_id && sightsCategoryIds.has(k.Kategorie_id.id));
}

// FNV-1a 32-bit — stable, no external deps, well-distributed enough that a
// 20 % cutoff produces a 20 % visible subset in practice. Keys are derived
// from place.id (primary) plus Name to make the hash robust if id schemas
// change later.
function stableHash01(place: DirectusOrte): number {
  const key = `${place.id}:${place.Name ?? ""}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Map to [0, 1). >>> 0 normalizes the int32 to uint32.
  return (h >>> 0) / 0x100000000;
}

// ─── Shared gating computation ───────────────────────────────────────────────
//
// Returns two sets for free users:
//   visibleSightsIds — the top-20% Sehenswertes places (unlocked)
//   lockedSightsIds  — the remaining 80% (shown on map, paywall on tap)
//
// For premium users both sets are empty (not needed — all places are open).

function computeSightsGating(
  places: DirectusOrte[],
  categories: DirectusKategorie[],
): { visibleSightsIds: Set<number>; lockedSightsIds: Set<number> } {
  const sightsCategoryIds = new Set(categories.filter(isSightsCategory).map((c) => c.id));
  if (sightsCategoryIds.size === 0) {
    return { visibleSightsIds: new Set(), lockedSightsIds: new Set() };
  }

  const sights: DirectusOrte[] = [];
  for (const p of places) {
    if (placeHasSights(p, sightsCategoryIds)) sights.push(p);
  }
  if (sights.length === 0) {
    return { visibleSightsIds: new Set(), lockedSightsIds: new Set() };
  }

  const visibleCount = Math.ceil(FREE_VISIBLE_RATIO * sights.length);
  const ranked = sights
    .map((p) => ({ p, h: stableHash01(p) }))
    .sort((a, b) => (a.h === b.h ? a.p.id - b.p.id : a.h - b.h));

  const visibleSightsIds = new Set(ranked.slice(0, visibleCount).map((x) => x.p.id));
  const lockedSightsIds = new Set(ranked.slice(visibleCount).map((x) => x.p.id));
  return { visibleSightsIds, lockedSightsIds };
}

// ─── Pobieranie z Directusa ──────────────────────────────────────────────────
//
// Wspólne zapytania dla fetchAll (start aplikacji) i refreshOfflineData
// (ręczne odświeżanie). Jedno źródło prawdy dla zestawu pól.

interface DirectusFetchResult {
  settings: DirectusEinstellungen;
  places: DirectusOrte[];
  categories: DirectusKategorie[];
}

async function fetchFromDirectus(): Promise<DirectusFetchResult> {
  const [settings, places, categories] = await Promise.all([
    directus.request(
      readItems("Einstellungen" as never, {
        fields: ["Logo", "Slogan"] as never[],
      }),
    ),
    directus.request(
      readItems("Orte" as never, {
        fields: [
          "id",
          "Name",
          "Adresse",
          "Stadt",
          "Land",
          "Telefon",
          "Vollbeschreibung",
          "location",
          "Hauptbild",
          "Titelbild",
          "Audio",
          "Audio_Datei",
          "Link_URL",
          "Link_Text",
          "Galerie.directus_files_id",
          "Galerie_Bilder",
          "Kategorie.Kategorie_id.id",
          "Kategorie.Kategorie_id.Name",
          "Kategorie.Kategorie_id.Farbe",
          "Zertifizierungen.Zertifizierungen_id.id",
          "Zertifizierungen.Zertifizierungen_id.Name",
          "Zertifizierungen.Zertifizierungen_id.Image",
          "Bearbeitungsstatus",
        ] as never[],
        limit: -1,
      }),
    ),
    directus.request(
      readItems("Kategorie" as never, {
        fields: ["id", "Name", "Farbe", "Reihenfolge"] as never[],
        sort: ["Reihenfolge"] as never[],
        limit: -1,
      }),
    ),
  ]);

  return {
    settings: settings as unknown as DirectusEinstellungen,
    places: places as unknown as DirectusOrte[],
    categories: categories as unknown as DirectusKategorie[],
  };
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface PlacesState {
  places: DirectusOrte[];
  categories: DirectusKategorie[];
  einstellungen: DirectusEinstellungen | null;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  // true, gdy aktualne dane pochodzą z lokalnego cache offline
  // (sieć była niedostępna, a cache istniał).
  isOffline: boolean;

  getPlaceById: (id: number) => DirectusOrte | undefined;
  getVisiblePlaces: (isPro: boolean) => DirectusOrte[];
  // Returns all places (for map display), plus the set of locked IDs.
  // Locked = Sehenswertes but outside the free 20% — shown as pins,
  // but tapping opens paywall instead of the detail screen.
  getAllPlacesWithLocked: (isPro: boolean) => {
    places: DirectusOrte[];
    lockedIds: Set<number>;
  };
  isLockedPlace: (placeId: number, isPro: boolean) => boolean;
  // isPro decyduje, czy przy braku sieci wolno użyć cache offline —
  // offline to funkcja premium, więc dla nie-premium fallback jest pomijany.
  fetchAll: (isPro: boolean) => Promise<void>;
  // Zapisuje aktualnie załadowane dane do lokalnego cache offline.
  // Wywoływane po udanym pobraniu paczki mapy offline (funkcja premium).
  cacheCurrentPlaces: () => Promise<void>;
  // Pobiera świeże dane z Directusa, aktualizuje store i nadpisuje cache
  // offline. Używane przez ręczny przycisk „Aktualisieren". W odróżnieniu
  // od fetchAll nie ma guarda status — zawsze wykonuje request.
  // Zwraca true przy sukcesie, false przy błędzie sieci.
  refreshOfflineData: () => Promise<boolean>;
}

export const usePlacesStore = create<PlacesState>((set, get) => ({
  places: [],
  categories: [],
  einstellungen: null,
  status: "idle",
  error: null,
  isOffline: false,

  getPlaceById: (id) => get().places.find((p) => p.id === id),

  // Deterministic visibility filter:
  //   - Premium → all places
  //   - Free   → all non-Sehenswertes places + exactly ceil(0.2 * N) of
  //              the Sehenswertes places (N = total Sehenswertes count).
  //              Selection is stable: sort by hash, take the smallest N20.
  getVisiblePlaces: (isPro) => {
    const { places, categories } = get();
    if (isPro) return places;

    const { visibleSightsIds, lockedSightsIds } = computeSightsGating(places, categories);
    if (visibleSightsIds.size === 0 && lockedSightsIds.size === 0) return places;

    const sightsCategoryIds = new Set(categories.filter(isSightsCategory).map((c) => c.id));
    return places.filter(
      (p) => !placeHasSights(p, sightsCategoryIds) || visibleSightsIds.has(p.id),
    );
  },

  // For map: returns ALL places (so locked pins still appear) plus the set
  // of locked IDs so the map layer can route taps to paywall.
  getAllPlacesWithLocked: (isPro) => {
    const { places, categories } = get();
    if (isPro) return { places, lockedIds: new Set() };

    const { lockedSightsIds } = computeSightsGating(places, categories);
    return { places, lockedIds: lockedSightsIds };
  },

  isLockedPlace: (placeId, isPro) => {
    if (isPro) return false;
    const { places, categories } = get();
    const { lockedSightsIds } = computeSightsGating(places, categories);
    return lockedSightsIds.has(placeId);
  },

  fetchAll: async (isPro: boolean) => {
    if (get().status === "loading" || get().status === "success") return;

    set({ status: "loading", error: null });

    try {
      const { settings, places, categories } = await fetchFromDirectus();

      set({
        einstellungen: settings,
        places,
        categories,
        status: "success",
        isOffline: false,
      });
    } catch {
      // Sieć zawiodła. Cache offline to funkcja premium — dla nie-premium
      // (lub po wygaśnięciu premium) NIE używamy go, nawet jeśli pliki
      // fizycznie istnieją na urządzeniu.
      const cached = isPro ? await loadPlacesCache() : null;
      if (cached) {
        set({
          einstellungen: cached.einstellungen,
          places: cached.places,
          categories: cached.categories,
          status: "success",
          error: null,
          isOffline: true,
        });
        return;
      }
      set({ status: "error", error: "Daten konnten nicht geladen werden." });
    }
  },

  cacheCurrentPlaces: async () => {
    const { places, categories, einstellungen, status } = get();
    // Cache'ujemy tylko realnie załadowane dane online.
    if (status !== "success" || places.length === 0) return;
    await savePlacesCache({ places, categories, einstellungen });
  },

  refreshOfflineData: async () => {
    try {
      const { settings, places, categories } = await fetchFromDirectus();
      set({
        einstellungen: settings,
        places,
        categories,
        status: "success",
        error: null,
        isOffline: false,
      });
      // Nadpisz cache offline świeżymi danymi (savePlacesCache aktualizuje
      // też savedAt → UI pokaże nową datę „Zuletzt aktualisiert").
      await savePlacesCache({ places, categories, einstellungen: settings });
      return true;
    } catch {
      // Brak sieci / błąd Directusa — store i cache zostają bez zmian.
      return false;
    }
  },
}));
