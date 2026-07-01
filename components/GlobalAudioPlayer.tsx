import { ReactNode, useEffect } from "react";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { usePlaylistStore, selectCurrentPlace } from "@/stores/playlistStore";
import { getAudioUrl, getMainImageUrl } from "@/lib/mediaUrls";
import { PlayerProvider } from "@/context/PlayerContext";

// ─────────────────────────────────────────────────────────────────────────────
// GlobalAudioPlayer — komponent-host w root layoucie.
//
// Tworzy JEDNĄ instancję AudioPlayer'a (bo useAudioPlayer nie deduplikuje po
// URL — każde wywołanie tworzy nowy natywny player). Ten singleton jest
// udostępniany dzieciom przez PlayerContext, żeby player.tsx i MiniPlayer
// mogły odczytywać jego status i sterować seekiem.
//
// Bez tego context'u były 2 różne playery: ten w GlobalAudioPlayer faktycznie
// grał audio, a te w UI-komponentach były martwe (currentTime=0, seekTo
// bez efektu w tle bo GlobalAudioPlayer o tym nie wiedział).
//
// Ustawia: audio mode, auto-advance (didJustFinish → next), reset counter
// (seekTo 0 przy replay/jumpTo), lock-screen metadata.
// ─────────────────────────────────────────────────────────────────────────────

export default function GlobalAudioPlayer({ children }: { children: ReactNode }) {
  const currentPlace = usePlaylistStore(selectCurrentPlace);
  const isPlaying = usePlaylistStore((s) => s.isPlaying);
  const resetCounter = usePlaylistStore((s) => s.resetCounter);
  const next = usePlaylistStore((s) => s.next);

  const audioUrl = currentPlace ? getAudioUrl(currentPlace) : null;
  const player = useAudioPlayer(audioUrl);

  // ── Audio mode: gra w cichym trybie (iOS) + background + doNotMix ──
  // interruptionMode: 'doNotMix' JEST WYMAGANE przez expo-audio żeby
  // setActiveForLockScreen faktycznie zadziałało (bez tego OS nie kojarzy
  // kontrolek lock-screen z naszym playerem).
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {
      // Ignoruj — na starszych patchach expo-audio pole może nie istnieć
    });
  }, []);

  // ── Auto-advance przez event listener (deterministyczny, nie hook) ──
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        // Ostatni pin gra do końca → status.didJustFinish=true → next() ustawi
        // isPlaying=false (bo playlistStore.next widzi że nie ma następnego).
        // Kolejne piny w środku playlisty → next() przesuwa currentIndex.
        next();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [player, next]);

  // ── Sync play/pause: store → player ──
  useEffect(() => {
    if (!player || !audioUrl) return;
    if (isPlaying) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, player, audioUrl]);

  // ── Reset counter: gdy user wywoła jumpTo / replay / next / previous,
  // przewiń audio na początek. Ten sam player, więc seekTo(0) faktycznie
  // przewija (a nie na "martwej" kopii jak było wcześniej).
  useEffect(() => {
    if (!player || resetCounter === 0) return;
    try {
      player.seekTo(0);
    } catch {
      // player może być jeszcze bez source — ignoruj
    }
  }, [resetCounter, player]);

  // ── Lock-screen controls: aktywuj/aktualizuj metadata gdy pin się zmienia ──
  useEffect(() => {
    if (!player || !currentPlace) return;

    const artworkUrl = getMainImageUrl(currentPlace) ?? undefined;

    try {
      player.setActiveForLockScreen(true, {
        title: currentPlace.Name,
        artist: currentPlace.Stadt || "Fairführer",
        albumTitle: "Fairführer Audioguide",
        artworkUrl,
      });
    } catch {
      // Jeżeli metoda nie istnieje (starsza wersja) — po prostu pomiń.
    }

    return () => {
      try {
        player.clearLockScreenControls();
      } catch {
        // ignoruj
      }
    };
  }, [player, currentPlace]);

  return <PlayerProvider player={player}>{children}</PlayerProvider>;
}
