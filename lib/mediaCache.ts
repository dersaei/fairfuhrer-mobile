import { Directory, File, Paths } from "expo-file-system";

// ─── Offline cache mediów ────────────────────────────────────────────────────
//
// Pobiera pliki mediów (zdjęcia, audio) spod zdalnych URL-i do lokalnego
// katalogu aplikacji. Komponenty UI używają resolveMediaUri(), aby — gdy plik
// jest scache'owany — wskazać lokalną ścieżkę zamiast zdalnego URL-a.
//
// Zdjęcia (główne + certyfikaty) pobierane są razem z paczką mapy offline.
// Audio pobierane jest osobno (świadoma decyzja użytkownika — duże pliki).
//
// Cache leży w document directory (Paths.document) — nie cache directory —
// aby system NIE usuwał plików offline przy braku miejsca.

const MEDIA_ROOT = "offlineMedia";
const IMAGES_DIR = "images";
const AUDIO_DIR = "audio";

export type MediaKind = "image" | "audio";

// ─── Ścieżki ─────────────────────────────────────────────────────────────────

function rootDir(): Directory {
  return new Directory(Paths.document, MEDIA_ROOT);
}

function kindDir(kind: MediaKind): Directory {
  return new Directory(rootDir(), kind === "audio" ? AUDIO_DIR : IMAGES_DIR);
}

// Deterministyczna, bezpieczna nazwa pliku z URL-a. Ten sam URL → ta sama
// nazwa, więc resolveMediaUri() potrafi odnaleźć wcześniej pobrany plik.
// FNV-1a 32-bit — bez zależności, wystarczająco unikalny dla naszej skali.
function fileNameFromUrl(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hash = (h >>> 0).toString(16).padStart(8, "0");
  // Zachowaj rozszerzenie z URL-a, jeśli wygląda sensownie (dla Image/Audio).
  const match = url.split("?")[0].match(/\.([a-zA-Z0-9]{1,5})$/);
  const ext = match ? `.${match[1].toLowerCase()}` : "";
  return `${hash}${ext}`;
}

function fileFor(kind: MediaKind, url: string): File {
  return new File(kindDir(kind), fileNameFromUrl(url));
}

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Zwraca lokalną ścieżkę `file://`, jeśli medium spod `remoteUrl` jest
 * scache'owane offline; w przeciwnym razie zwraca oryginalny `remoteUrl`.
 *
 * Synchroniczna — `File.exists` to natywna właściwość, więc bezpieczna do
 * wywołania w trakcie renderu komponentu.
 */
export function resolveMediaUri(
  remoteUrl: string | null | undefined,
  kind: MediaKind,
): string | null {
  if (!remoteUrl) return null;
  try {
    const file = fileFor(kind, remoteUrl);
    return file.exists ? file.uri : remoteUrl;
  } catch {
    return remoteUrl;
  }
}

// ─── Pobieranie ──────────────────────────────────────────────────────────────

/**
 * Pobiera jeden plik medium do lokalnego cache. No-op, jeśli plik już istnieje.
 * Zwraca `true` przy sukcesie (lub gdy plik już był), `false` przy błędzie.
 */
async function downloadOne(kind: MediaKind, url: string): Promise<boolean> {
  try {
    const dir = kindDir(kind);
    if (!dir.exists) dir.create({ intermediates: true });
    const target = fileFor(kind, url);
    if (target.exists) return true;
    await File.downloadFileAsync(url, target, { idempotent: true });
    return true;
  } catch {
    return false;
  }
}

export interface MediaDownloadProgress {
  total: number;
  completed: number;
  failed: number;
}

/**
 * Pobiera listę mediów do cache, raportując postęp. Pliki już obecne są
 * pomijane (szybko), więc funkcja jest bezpieczna do ponownego wywołania.
 */
export async function downloadMedia(
  kind: MediaKind,
  urls: string[],
  onProgress?: (p: MediaDownloadProgress) => void,
): Promise<MediaDownloadProgress> {
  // Deduplikacja — ten sam URL mógłby wystąpić w wielu miejscach.
  const unique = Array.from(new Set(urls.filter(Boolean)));
  const progress: MediaDownloadProgress = {
    total: unique.length,
    completed: 0,
    failed: 0,
  };
  onProgress?.({ ...progress });

  for (const url of unique) {
    const ok = await downloadOne(kind, url);
    if (ok) progress.completed += 1;
    else progress.failed += 1;
    onProgress?.({ ...progress });
  }
  return progress;
}

// ─── Rozmiar i usuwanie ──────────────────────────────────────────────────────

/**
 * Zwraca rozmiar lokalnego cache danego rodzaju mediów w bajtach (0, jeśli
 * katalog nie istnieje lub jest pusty).
 */
export function getMediaCacheSize(kind: MediaKind): number {
  try {
    const dir = kindDir(kind);
    if (!dir.exists) return 0;
    return dir.size ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Usuwa cały lokalny cache danego rodzaju mediów.
 */
export function clearMediaCache(kind: MediaKind): void {
  try {
    const dir = kindDir(kind);
    if (dir.exists) dir.delete();
  } catch {
    // Brak katalogu / błąd — traktujemy jako zakończone.
  }
}

/**
 * Usuwa cały cache mediów (zdjęcia + audio).
 */
export function clearAllMediaCache(): void {
  try {
    const root = rootDir();
    if (root.exists) root.delete();
  } catch {
    // Brak katalogu / błąd — traktujemy jako zakończone.
  }
}
