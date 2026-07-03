import { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import Svg, { Polygon, Circle } from "react-native-svg";

import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import { usePlaylistStore } from "@/stores/playlistStore";
import { getAudioUrl } from "@/lib/mediaUrls";
import { supabase } from "@/lib/supabase";
import type { DirectusOrte, DirectusKategorie } from "@/types";

// ─── Utils ──────────────────────────────────────────────────────────────────

function PlayIcon({ size = 22, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="12" fill="rgba(252,108,20,1)" />
      <Polygon points="10,7.5 17,12 10,16.5" fill={color} />
    </Svg>
  );
}

/**
 * Wybiera tylko piny które faktycznie mają URL audio.
 * Playlista bez audio nie ma sensu — pominięcie na etapie budowania kolejki.
 */
function withAudioOnly(places: DirectusOrte[]): DirectusOrte[] {
  return places.filter((p) => getAudioUrl(p) !== null);
}

// ─── Tour Screen ────────────────────────────────────────────────────────────

export default function TourScreen() {
  const router = useRouter();
  const { isPro } = useAuth();
  // BUG-FIX (2026-07-02, v1.1.1): wcześniej robiłem
  //   const { getVisiblePlaces } = usePlacesStore()
  //   const visible = useMemo(() => getVisiblePlaces(isPro), [getVisiblePlaces, isPro])
  // `getVisiblePlaces` to zwykły getter w store — referencja stała.
  // useMemo cache'ował wynik z PIERWSZEGO wywołania. Gdy `places` ładowały się
  // async po pierwszym renderze Tour (lazy=false → Tour montuje się przed
  // dataReady), useMemo NIE odświeżał się → cityStats/categoryStats puste →
  // biała ściana w prod (na dev/reload dane były już w cache przy pierwszym
  // renderze, więc bug był niewidoczny).
  //
  // Fix: subskrybuj `places` i `categories` bezpośrednio, wywołuj
  // getVisiblePlaces w renderze (nie w useMemo dependencies) — teraz każda
  // zmiana `places` powoduje re-render i getter zwraca aktualne dane.
  const places = usePlacesStore((s) => s.places);
  const categories = usePlacesStore((s) => s.categories);
  const status = usePlacesStore((s) => s.status);
  const getVisiblePlaces = usePlacesStore((s) => s.getVisiblePlaces);
  const startPlaylist = usePlaylistStore((s) => s.startPlaylist);

  const [umgebungLoading, setUmgebungLoading] = useState(false);

  // useMemo teraz zależy od `places` i `categories` — real dane. getVisiblePlaces
  // dostajemy przez subskrypcję (choć jego referencja jest stała, jego wynik
  // się zmienia razem z `places`).
  const visiblePlaces = useMemo(
    () => getVisiblePlaces(isPro),
    // Świadomie zależymy od `places` i `categories` — getVisiblePlaces jest
    // czystym gettterem tych wartości. Bez tych zależności useMemo zostałby
    // przy staje wartości = biała ściana bug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [places, categories, isPro, getVisiblePlaces],
  );
  const playablePlaces = useMemo(() => withAudioOnly(visiblePlaces), [visiblePlaces]);

  // ── Sekcja "Nach Stadt": zliczanie pinów per Stadt, sort desc ──
  const cityStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of playablePlaces) {
      if (!p.Stadt) continue;
      map.set(p.Stadt, (map.get(p.Stadt) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]) // desc by count
      .map(([stadt, count]) => ({ stadt, count }));
  }, [playablePlaces]);

  // ── Sekcja "Nach Kategorie": zliczanie pinów per kategoria ──
  const categoryStats = useMemo(() => {
    const map = new Map<number, { cat: DirectusKategorie; count: number }>();
    for (const cat of categories) {
      map.set(cat.id, { cat, count: 0 });
    }
    for (const p of playablePlaces) {
      const catIds = new Set<number>();
      for (const oc of p.Kategorie ?? []) {
        if (oc.Kategorie_id) catIds.add(oc.Kategorie_id.id);
      }
      for (const id of catIds) {
        const entry = map.get(id);
        if (entry) entry.count += 1;
      }
    }
    return Array.from(map.values())
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [categories, playablePlaces]);

  // ── Start playlisty z sekcji "Umgebung" (GPS-sorted) ──
  const startUmgebung = useCallback(async () => {
    if (playablePlaces.length === 0) return;
    setUmgebungLoading(true);
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== "granted") {
        Alert.alert(
          "Standort benötigt",
          "Für eine Tour in deiner Umgebung wird dein Standort benötigt.",
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { data, error } = await supabase.rpc("nearby_orte", {
        user_lat: pos.coords.latitude,
        user_lng: pos.coords.longitude,
      });

      if (error) throw error;

      const orderedIds = (data as { id: number }[]).map((r) => r.id);
      const byId = new Map(playablePlaces.map((p) => [p.id, p]));
      const queue: DirectusOrte[] = [];
      for (const id of orderedIds) {
        const p = byId.get(id);
        if (p) queue.push(p);
      }
      // Bez capa — user zatrzyma playlist gdy zechce. Sehenswertes gating
      // (20% dla free) i tak ogranicza liczbe pinow po stronie storu.
      if (queue.length === 0) {
        Alert.alert("Keine Pins", "In deiner Umgebung wurden keine Pins gefunden.");
        return;
      }
      startPlaylist(queue, { kind: "umgebung" });
      router.push("/player");
    } catch {
      Alert.alert("Fehler", "Standort konnte nicht ermittelt werden.");
    } finally {
      setUmgebungLoading(false);
    }
  }, [playablePlaces, startPlaylist, router]);

  // ── Start playlisty dla miasta ──
  const startStadt = useCallback(
    (stadt: string) => {
      const queue = playablePlaces.filter((p) => p.Stadt === stadt);
      if (queue.length === 0) return;
      startPlaylist(queue, { kind: "stadt", stadt });
      router.push("/player");
    },
    [playablePlaces, startPlaylist, router],
  );

  // ── Start playlisty dla kategorii ──
  const startKategorie = useCallback(
    (kategorieId: number, kategorieName: string) => {
      const queue = playablePlaces.filter((p) =>
        (p.Kategorie ?? []).some((oc) => oc.Kategorie_id?.id === kategorieId),
      );
      if (queue.length === 0) return;
      startPlaylist(queue, { kind: "kategorie", kategorieId, kategorieName });
      router.push("/player");
    },
    [playablePlaces, startPlaylist, router],
  );

  if (status === "loading" || status === "idle") {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color="#fc6c14" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Tour</Text>
          <Text style={s.headerSubtitle}>Alle Audios in einer Playlist abspielen</Text>
        </View>

        {/* ── Sekcja: Nach Umgebung (GPS) ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Nach Umgebung</Text>
          <TouchableOpacity
            style={s.umgebungCard}
            onPress={startUmgebung}
            disabled={umgebungLoading}
            activeOpacity={0.85}
          >
            <View style={s.umgebungText}>
              <Text style={s.umgebungTitle}>Meine Umgebung</Text>
              <Text style={s.umgebungHint}>Alle Pins ab deinem Standort</Text>
            </View>
            {umgebungLoading ? <ActivityIndicator color="#fff" /> : <PlayIcon size={40} />}
          </TouchableOpacity>
        </View>

        {/* ── Sekcja: Nach Stadt (sort desc by count) ── */}
        {cityStats.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Nach Stadt</Text>
            {cityStats.map(({ stadt, count }) => (
              <TouchableOpacity
                key={stadt}
                style={s.row}
                onPress={() => startStadt(stadt)}
                activeOpacity={0.7}
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>{stadt}</Text>
                  <Text style={s.rowSubtitle}>
                    {count} {count === 1 ? "Pin" : "Pins"}
                  </Text>
                </View>
                <PlayIcon size={30} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Sekcja: Nach Kategorie ── */}
        {categoryStats.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Nach Kategorie</Text>
            {categoryStats.map(({ cat, count }) => (
              <TouchableOpacity
                key={cat.id}
                style={s.row}
                onPress={() => startKategorie(cat.id, cat.Name)}
                activeOpacity={0.7}
              >
                <View style={s.rowText}>
                  <Text style={s.rowTitle}>{cat.Name}</Text>
                  <Text style={s.rowSubtitle}>
                    {count} {count === 1 ? "Pin" : "Pins"}
                  </Text>
                </View>
                <PlayIcon size={30} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 40 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Anton_400Regular",
    color: "#18222F",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 4,
  },

  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#18222F",
    marginBottom: 12,
  },

  umgebungCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18222F",
    padding: 20,
    borderRadius: 12,
    gap: 16,
  },
  umgebungText: { flex: 1 },
  umgebungTitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  umgebungHint: {
    color: "#bbb",
    fontSize: 13,
    marginTop: 4,
    fontFamily: "FiraSansCondensed_400Regular",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
    gap: 12,
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontSize: 16,
    color: "#18222F",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  rowSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
    fontFamily: "FiraSansCondensed_400Regular",
  },
});
