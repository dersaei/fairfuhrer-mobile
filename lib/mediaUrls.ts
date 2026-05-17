import type { DirectusOrte } from "@/types";

// ─── Budowanie URL-i mediów ──────────────────────────────────────────────────
//
// Współdzielona logika konstruowania zdalnych URL-i mediów (zdjęcia, audio).
// Używana zarówno przez ekran szczegółów (place/[id].tsx) do wyświetlania,
// jak i przez offline media cache do zebrania listy plików do pobrania.
// Jedno źródło prawdy — gdy zmieni się struktura storage, zmiana jest tu.

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

/** URL głównego zdjęcia miejsca (Titelbild → Directus, Hauptbild → Supabase). */
export function getMainImageUrl(place: DirectusOrte): string | null {
  if (place.Titelbild) return `${DIRECTUS_URL}/assets/${place.Titelbild}`;
  if (place.Hauptbild)
    return `${SUPABASE_URL}/storage/v1/object/public/media-files/places/images/main/${place.Hauptbild}`;
  return null;
}

/** URL audioguide'u miejsca (Audio → Directus, Audio_Datei → Supabase). */
export function getAudioUrl(place: DirectusOrte): string | null {
  if (place.Audio) return `${DIRECTUS_URL}/assets/${place.Audio}`;
  if (place.Audio_Datei)
    return `${SUPABASE_URL}/storage/v1/object/public/media-files/places/audio/${place.Audio_Datei}`;
  return null;
}

/** URL-e zdjęć galerii miejsca (Directus ma pierwszeństwo nad Supabase). */
export function getGalleryUrls(place: DirectusOrte): string[] {
  const directusGallery = place.Galerie?.filter((g) => g?.directus_files_id) ?? [];
  if (directusGallery.length > 0) {
    return directusGallery.map((g) => `${DIRECTUS_URL}/assets/${g.directus_files_id}`);
  }
  return (place.Galerie_Bilder ?? []).map(
    (f) => `${SUPABASE_URL}/storage/v1/object/public/media-files/places/images/gallery/${f}`,
  );
}

/** URL-e logotypów certyfikatów miejsca (tylko Directus). */
export function getCertificateImageUrls(place: DirectusOrte): string[] {
  return (place.Zertifizierungen ?? [])
    .map((z) => z.Zertifizierungen_id?.Image)
    .filter((img): img is string => Boolean(img))
    .map((img) => `${DIRECTUS_URL}/assets/${img}`);
}

/**
 * Zbiera wszystkie URL-e zdjęć do cache offline ze wszystkich miejsc:
 * zdjęcia główne + logotypy certyfikatów. Galeria świadomie pominięta —
 * zgodnie z zakresem Etapu 4 (główne + certyfikaty). Wynik jest
 * zdeduplikowany.
 */
export function collectOfflineImageUrls(places: DirectusOrte[]): string[] {
  const urls = new Set<string>();
  for (const place of places) {
    const main = getMainImageUrl(place);
    if (main) urls.add(main);
    for (const cert of getCertificateImageUrls(place)) urls.add(cert);
  }
  return Array.from(urls);
}

/**
 * Zbiera wszystkie URL-e audioguide'ów do cache offline ze wszystkich miejsc.
 * Wynik jest zdeduplikowany.
 */
export function collectOfflineAudioUrls(places: DirectusOrte[]): string[] {
  const urls = new Set<string>();
  for (const place of places) {
    const audio = getAudioUrl(place);
    if (audio) urls.add(audio);
  }
  return Array.from(urls);
}
