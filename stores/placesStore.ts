import { create } from "zustand";
import { readItems } from "@directus/sdk";
import { directus } from "@/lib/directus";
import type {
  DirectusOrte,
  DirectusKategorie,
  DirectusEinstellungen,
} from "@/types";

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

export function isSightsCategory(
  cat: DirectusKategorie | undefined | null,
): boolean {
  if (!cat) return false;
  const overrideId = envSightsCategoryId();
  if (overrideId !== null && cat.id === overrideId) return true;
  return normalizeGerman(cat.Name ?? "").startsWith("sehen");
}

export const FREE_SIGHTS_VISIBLE_RATIO = FREE_VISIBLE_RATIO;

function placeHasSights(
  place: DirectusOrte,
  sightsCategoryIds: Set<number>,
): boolean {
  if (!place.Kategorie) return false;
  return place.Kategorie.some(
    (k) => k.Kategorie_id && sightsCategoryIds.has(k.Kategorie_id.id),
  );
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

// ─── Store ──────────────────────────────────────────────────────────────────

interface PlacesState {
  places: DirectusOrte[];
  categories: DirectusKategorie[];
  einstellungen: DirectusEinstellungen | null;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;

  getPlaceById: (id: number) => DirectusOrte | undefined;
  getVisiblePlaces: (isPro: boolean) => DirectusOrte[];
  fetchAll: () => Promise<void>;
}

export const usePlacesStore = create<PlacesState>((set, get) => ({
  places: [],
  categories: [],
  einstellungen: null,
  status: "idle",
  error: null,

  getPlaceById: (id) => get().places.find((p) => p.id === id),

  // Deterministic visibility filter:
  //   - Premium → all places
  //   - Free   → all non-Sehenswertes places + exactly ceil(0.2 * N) of
  //              the Sehenswertes places (N = total Sehenswertes count).
  //              Selection is stable: sort by hash, take the smallest N20.
  getVisiblePlaces: (isPro) => {
    const { places, categories } = get();
    if (isPro) return places;

    const sightsCategoryIds = new Set(
      categories.filter(isSightsCategory).map((c) => c.id),
    );
    if (sightsCategoryIds.size === 0) return places;

    const sights: DirectusOrte[] = [];
    const others: DirectusOrte[] = [];
    for (const p of places) {
      if (placeHasSights(p, sightsCategoryIds)) sights.push(p);
      else others.push(p);
    }
    if (sights.length === 0) return others;

    const visibleCount = Math.ceil(FREE_VISIBLE_RATIO * sights.length);
    const ranked = sights
      .map((p) => ({ p, h: stableHash01(p) }))
      .sort((a, b) => (a.h === b.h ? a.p.id - b.p.id : a.h - b.h))
      .slice(0, visibleCount)
      .map((x) => x.p);
    const visibleSightsIds = new Set(ranked.map((p) => p.id));

    return places.filter(
      (p) =>
        !placeHasSights(p, sightsCategoryIds) || visibleSightsIds.has(p.id),
    );
  },

  fetchAll: async () => {
    if (get().status === "loading" || get().status === "success") return;

    set({ status: "loading", error: null });

    try {
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

      set({
        einstellungen: settings as unknown as DirectusEinstellungen,
        places: places as unknown as DirectusOrte[],
        categories: categories as unknown as DirectusKategorie[],
        status: "success",
      });
    } catch {
      set({ status: "error", error: "Daten konnten nicht geladen werden." });
    }
  },
}));
