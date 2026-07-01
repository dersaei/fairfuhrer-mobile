import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";
import Svg, { Polygon, Rect } from "react-native-svg";
import {
  usePlaylistStore,
  selectCurrentPlace,
  selectIsPlaylistActive,
} from "@/stores/playlistStore";
import { getMainImageUrl } from "@/lib/mediaUrls";

// ─── Ikony (spójne z AudioPlayer.tsx) ───────────────────────────────────────

function PlayIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Polygon points="9.5,7.5 16.5,12 9.5,16.5" fill="#fff" />
    </Svg>
  );
}

function PauseIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Rect x="9" y="7.5" width="2.5" height="9" fill="#fff" rx="0.5" />
      <Rect x="12.5" y="7.5" width="2.5" height="9" fill="#fff" rx="0.5" />
    </Svg>
  );
}

function NextIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Polygon points="7,6 15,12 7,18" fill="#fff" />
      <Rect x="15.5" y="6" width="2" height="12" fill="#fff" />
    </Svg>
  );
}

// ─── MiniPlayer ─────────────────────────────────────────────────────────────
//
// Persistent bar renderowany w root layoucie NAD tab-barem. Widoczny tylko gdy
// playlista aktywna (queue.length > 0). Tap otwiera pełnoekranowy player.

export default function MiniPlayer() {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = usePlaylistStore(selectIsPlaylistActive);
  const currentPlace = usePlaylistStore(selectCurrentPlace);
  const isPlaying = usePlaylistStore((s) => s.isPlaying);
  const togglePlay = usePlaylistStore((s) => s.togglePlay);
  const next = usePlaylistStore((s) => s.next);
  const queueLength = usePlaylistStore((s) => s.queue.length);
  const currentIndex = usePlaylistStore((s) => s.currentIndex);

  // Nie pokazuj MiniPlayera na ekranie pelnego playera — tam widac wszystko.
  if (!isActive || !currentPlace || pathname === "/player") return null;

  const imageUrl = getMainImageUrl(currentPlace);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.container}
      onPress={() => router.push("/player")}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {currentPlace.Name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {currentIndex + 1} / {queueLength}
          {currentPlace.Stadt ? ` · ${currentPlace.Stadt}` : ""}
        </Text>
      </View>

      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        style={styles.controlBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          next();
        }}
        style={styles.controlBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <NextIcon />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18222F",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  thumbPlaceholder: {
    backgroundColor: "#333",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  subtitle: {
    color: "#bbb",
    fontSize: 12,
    marginTop: 2,
    fontFamily: "FiraSansCondensed_400Regular",
  },
  controlBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "rgba(252,108,20,0.9)",
  },
});
