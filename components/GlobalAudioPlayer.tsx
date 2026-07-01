import { useEffect, useRef } from "react";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import { usePlaylistStore, selectCurrentPlace } from "@/stores/playlistStore";
import { getAudioUrl } from "@/lib/mediaUrls";

// ─────────────────────────────────────────────────────────────────────────────
// GlobalAudioPlayer — headless component renderowany raz w root layoucie.
//
// Subskrybuje playlistStore, tworzy `useAudioPlayer(currentUrl)`, wywołuje
// play/pause zgodnie z `isPlaying`, auto-advance przy `didJustFinish`.
//
// Nie renderuje nic wizualnie — UI robi MiniPlayer / player.tsx / tour.tsx,
// które czytają ten sam store.
// ─────────────────────────────────────────────────────────────────────────────

export default function GlobalAudioPlayer() {
  const currentPlace = usePlaylistStore(selectCurrentPlace);
  const isPlaying = usePlaylistStore((s) => s.isPlaying);
  const next = usePlaylistStore((s) => s.next);

  const audioUrl = currentPlace ? getAudioUrl(currentPlace) : null;

  // useAudioPlayer akceptuje null — player wtedy jest "pusty".
  // Gdy audioUrl się zmienia (kolejny pin), player automatycznie ładuje nowe źródło.
  const player = useAudioPlayer(audioUrl);
  const status = useAudioPlayerStatus(player);

  // ── Audio mode: gra w cichym trybie (iOS) — wymagane dla audioguide'ów ──
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {
      // Ignoruj — na starszych wersjach expo-audio pole może nie istnieć
    });
  }, []);

  // ── Sync play/pause: store → player ──
  useEffect(() => {
    if (!player || !audioUrl) return;
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, player, audioUrl]);

  // ── Auto-advance przy końcu ścieżki ──
  // `didJustFinish` jest true przez jeden tick po zakończeniu; guard `advancedRef`
  // zabezpiecza przed podwójnym wywołaniem (status może przyjść kilka razy).
  const advancedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!status?.didJustFinish) return;
    const marker = `${currentPlace?.id ?? "none"}-${status.currentTime ?? 0}`;
    if (advancedRef.current === marker) return;
    advancedRef.current = marker;
    next();
  }, [status?.didJustFinish, status?.currentTime, currentPlace?.id, next]);

  // Reset guard przy zmianie pina — kolejny track dostaje świeży marker
  useEffect(() => {
    advancedRef.current = null;
  }, [currentPlace?.id]);

  return null;
}
