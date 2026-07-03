import { createContext, useContext, ReactNode } from "react";
import type { AudioPlayer } from "expo-audio";

// ─────────────────────────────────────────────────────────────────────────────
// PlayerContext — udostępnia singleton `AudioPlayer` z GlobalAudioPlayer.
//
// Powód istnienia: `useAudioPlayer(url)` tworzy NOWĄ instancję playera przy
// każdym wywołaniu (nie deduplikuje po URL). Bez tego context'u pełny player
// i MiniPlayer miały własnych "martwych" playerów, a tylko GlobalAudioPlayer
// grał faktyczne audio → seekbar/currentTime nie działały w UI.
//
// GlobalAudioPlayer zawsze wywołuje useAudioPlayer(...) — nawet z null-source —
// więc `player` w Providerze jest ZAWSZE zdefiniowany. `useSharedPlayer`
// zwraca non-null AudioPlayer (wewnątrz GlobalAudioPlayer tree).
// ─────────────────────────────────────────────────────────────────────────────

export const PlayerContext = createContext<AudioPlayer | null>(null);

export function PlayerProvider({ player, children }: { player: AudioPlayer; children: ReactNode }) {
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>;
}

/**
 * Zwraca shared AudioPlayer z GlobalAudioPlayer.
 * Rzuca gdy używane poza tree GlobalAudioPlayer (bug programisty).
 */
export function useSharedPlayer(): AudioPlayer {
  const player = useContext(PlayerContext);
  if (!player) {
    throw new Error(
      "useSharedPlayer must be used within <GlobalAudioPlayer>. " +
        "Wrap your root tree with <GlobalAudioPlayer>...</GlobalAudioPlayer>.",
    );
  }
  return player;
}
