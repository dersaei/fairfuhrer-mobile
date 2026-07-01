import { create } from "zustand";
import type { DirectusOrte } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Playlist store — trzyma kolejkę pinów i indeks aktualnie granego elementu.
//
// Uwaga architektoniczna: `useAudioPlayer` z expo-audio to hook — nie może żyć
// w Zustand store. Faktyczne odtwarzanie robi <GlobalAudioPlayer /> renderowany
// w root layoucie: subskrybuje ten store, tworzy `useAudioPlayer(currentUrl)`
// i steruje play/pause + auto-advance.
//
// Store trzyma tylko: queue, currentIndex, flagi UI (playing/loading), kontekst
// playlisty (skąd została uruchomiona — do wyświetlenia w UI).
// ─────────────────────────────────────────────────────────────────────────────

export type PlaylistContext =
  | { kind: "umgebung" } // Alle abspielen w promieniu GPS
  | { kind: "stadt"; stadt: string }
  | { kind: "kategorie"; kategorieId: number; kategorieName: string };

interface PlaylistState {
  queue: DirectusOrte[];
  currentIndex: number;
  context: PlaylistContext | null;
  isPlaying: boolean; // sterowanie UI: true = ma grać, false = pauza/nic
}

interface PlaylistActions {
  startPlaylist: (queue: DirectusOrte[], context: PlaylistContext) => void;
  stop: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
}

export const usePlaylistStore = create<PlaylistState & PlaylistActions>((set, get) => ({
  queue: [],
  currentIndex: 0,
  context: null,
  isPlaying: false,

  startPlaylist: (queue, context) => {
    if (queue.length === 0) return;
    set({ queue, currentIndex: 0, context, isPlaying: true });
  },

  stop: () => {
    set({ queue: [], currentIndex: 0, context: null, isPlaying: false });
  },

  togglePlay: () => {
    const { queue } = get();
    if (queue.length === 0) return;
    set((state) => ({ isPlaying: !state.isPlaying }));
  },

  next: () => {
    const { queue, currentIndex } = get();
    if (currentIndex + 1 < queue.length) {
      set({ currentIndex: currentIndex + 1, isPlaying: true });
    } else {
      // Koniec playlisty — zatrzymaj (nie kasuj queue, żeby user widział co grało)
      set({ isPlaying: false });
    }
  },

  previous: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1, isPlaying: true });
    }
  },

  jumpTo: (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    set({ currentIndex: index, isPlaying: true });
  },
}));

// ─── Selektory (memoizowane w useShallow po stronie konsumenta) ──────────────

export const selectCurrentPlace = (s: PlaylistState & PlaylistActions) =>
  s.queue[s.currentIndex] ?? null;

export const selectIsPlaylistActive = (s: PlaylistState & PlaylistActions) =>
  s.queue.length > 0 && s.context !== null;
