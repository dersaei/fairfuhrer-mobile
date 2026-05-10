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
// Free accounts see ALL pins in EVERY category EXCEPT "Sehenswürdigkeiten",
// where they see a deterministic ~20 % subset based on a stable hash of the
// place's id / Name. Premium sees 100 %.
//
// We do not assume a hard-coded category id (it differs across environments).
// Detection priority:
//   1. EXPO_PUBLIC_SIGHTS_CATEGORY_ID  — explicit override from Doppler/Expo
//   2. Category whose normalized German name starts with "sehen"
//      (matches "Sehenswürdigkeiten", "Sehenswertes", … — the displayed
//      label in profil.tsx is "Sehenswertes", but the brief refers to the
//      same canonical category as "Sehenswürdigkeiten").
//
// The threshold is the literal 20 % from the product spec.
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

function isSightsCategory(cat: DirectusKategorie | undefined | null): boolean {
  if (!cat) return false;
  const overrideId = envSightsCategoryId();
  if (overrideId !== null && cat.id === overrideId) return true;
  return normalizeGerman(cat.Name ?? "").startsWith("sehen");
}

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
  //   - Free   → all places EXCEPT ~80 % of those tagged with the
  //              "Sehenswürdigkeiten" category. Selection is stable per
  //              place id + name, so a free user always sees the same
  //              subset across runs / devices.
  getVisiblePlaces: (isPro) => {
    const { places, categories } = get();
    if (isPro) return places;

    const sightsCategoryIds = new Set(
      categories.filter(isSightsCategory).map((c) => c.id),
    );
    if (sightsCategoryIds.size === 0) return places;

    return places.filter((p) => {
      if (!placeHasSights(p, sightsCategoryIds)) return true;
      return stableHash01(p) < FREE_VISIBLE_RATIO;
    });
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
