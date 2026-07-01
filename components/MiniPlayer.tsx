import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polygon, Rect } from "react-native-svg";
import {
  usePlaylistStore,
  selectCurrentPlace,
  selectIsPlaylistActive,
} from "@/stores/playlistStore";
import { getMainImageUrl } from "@/lib/mediaUrls";

// ─── Layout constants ───────────────────────────────────────────────────────
// Musi być zsynchronizowane z app/(tabs)/_layout.tsx:
//   height: 60 + Math.max(insets.bottom, 16)
// MiniPlayer siedzi NAD tab-barem, więc jego bottom = wysokość tab-bara.
const TAB_BAR_BASE_HEIGHT = 60;
const TAB_BAR_MIN_BOTTOM_PADDING = 16;

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

// MiniPlayer jest pokazywany TYLKO na ekranach tabów. Modalne ekrany
// (place/[id], player, custom-paywall, auth-modal) same się prezentują
// full-screen, MiniPlayer za ich modalem byłby niewidoczny i i tak nie
// można by go tapnąć.
const TAB_ROUTES = new Set([
  "/",
  "/karte",
  "/liste",
  "/tour",
  "/profil",
  "/(tabs)",
  "/(tabs)/karte",
  "/(tabs)/tour",
  "/(tabs)/profil",
]);

export default function MiniPlayer() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isActive = usePlaylistStore(selectIsPlaylistActive);
  const currentPlace = usePlaylistStore(selectCurrentPlace);
  const isPlaying = usePlaylistStore((s) => s.isPlaying);
  const togglePlay = usePlaylistStore((s) => s.togglePlay);
  const next = usePlaylistStore((s) => s.next);
  const queueLength = usePlaylistStore((s) => s.queue.length);
  const currentIndex = usePlaylistStore((s) => s.currentIndex);

  // Widoczny tylko na tabach — modalne ekrany zasłaniają MiniPlayera całkowicie.
  const showOnThisRoute = TAB_ROUTES.has(pathname);
  if (!isActive || !currentPlace || !showOnThisRoute) return null;

  // Wysokość tab-bara — musi zgadzać się z (tabs)/_layout.tsx:
  //   height: 60 + Math.max(insets.bottom, 16)
  // MiniPlayer siedzi tuż nad tab-barem.
  const tabBarHeight =
    TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_PADDING);

  const imageUrl = getMainImageUrl(currentPlace);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[
        styles.container,
        {
          bottom: tabBarHeight,
          // Na Androidzie dodać cień żeby MiniPlayer nie zlał się z tab-barem
          ...(Platform.OS === "android" ? { elevation: 8 } : {}),
        },
      ]}
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
    // Position absolute — nad tab-barem, nie wypycha go
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18222F",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    // iOS cień
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
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
