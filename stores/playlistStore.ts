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
  // Licznik "resetów" — inkrementowany gdy user chce zagrać ten sam track od
  // zera (replay po końcu, jumpTo(currentIndex)). GlobalAudioPlayer i player.tsx
  // subskrybują ten counter i wywołują player.seekTo(0) gdy się zmieni.
  resetCounter: number;
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
  resetCounter: 0,

  startPlaylist: (queue, context) => {
    if (queue.length === 0) return;
    set((state) => ({
      queue,
      currentIndex: 0,
      context,
      isPlaying: true,
      resetCounter: state.resetCounter + 1, // wymuś reset audio (nowy pin od 0)
    }));
  },

  stop: () => {
    set({ queue: [], currentIndex: 0, context: null, isPlaying: false });
  },

  togglePlay: () => {
    const { queue, isPlaying, currentIndex } = get();
    if (queue.length === 0) return;
    // Gdy user klika play po zakończeniu playlisty (ostatni pin, isPlaying=false)
    // — chcemy zagrać ten sam track od nowa, więc zwiększamy resetCounter.
    // GlobalAudioPlayer wywoła seekTo(0) → play().
    if (!isPlaying && currentIndex === queue.length - 1) {
      set((state) => ({ isPlaying: true, resetCounter: state.resetCounter + 1 }));
      return;
    }
    set({ isPlaying: !isPlaying });
  },

  next: () => {
    const { queue, currentIndex } = get();
    if (currentIndex + 1 < queue.length) {
      set((state) => ({
        currentIndex: currentIndex + 1,
        isPlaying: true,
        resetCounter: state.resetCounter + 1,
      }));
    } else {
      // Koniec playlisty — zatrzymaj (nie kasuj queue, żeby user widział co grało)
      set({ isPlaying: false });
    }
  },

  previous: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set((state) => ({
        currentIndex: currentIndex - 1,
        isPlaying: true,
        resetCounter: state.resetCounter + 1,
      }));
    }
  },

  jumpTo: (index) => {
    const { queue } = get();
    if (index < 0 || index >= queue.length) return;
    // Zawsze inkrementuj resetCounter — nawet gdy klikamy ten sam pin
    // (user chce go zagrać od nowa). To rozwiązuje "trzeba dwukrotnie tapnąć".
    set((state) => ({
      currentIndex: index,
      isPlaying: true,
      resetCounter: state.resetCounter + 1,
    }));
  },
}));

// ─── Selektory (memoizowane w useShallow po stronie konsumenta) ──────────────

export const selectCurrentPlace = (s: PlaylistState & PlaylistActions) =>
  s.queue[s.currentIndex] ?? null;

export const selectIsPlaylistActive = (s: PlaylistState & PlaylistActions) =>
  s.queue.length > 0 && s.context !== null;
