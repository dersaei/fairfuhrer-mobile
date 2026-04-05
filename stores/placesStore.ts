import { create } from "zustand";
import { readItems } from "@directus/sdk";
import { directus } from "@/lib/directus";
import type { DirectusOrte, DirectusKategorie, DirectusEinstellungen } from "@/types";

interface PlacesState {
  places: DirectusOrte[];
  categories: DirectusKategorie[];
  einstellungen: DirectusEinstellungen | null;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;

  // Selektory
  getPlaceById: (id: number) => DirectusOrte | undefined;

  // Akcje
  fetchAll: () => Promise<void>;
}

export const usePlacesStore = create<PlacesState>((set, get) => ({
  places: [],
  categories: [],
  einstellungen: null,
  status: "idle",
  error: null,

  getPlaceById: (id) => get().places.find((p) => p.id === id),

  fetchAll: async () => {
    // Nie fetchuj ponownie jeśli dane już są
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
