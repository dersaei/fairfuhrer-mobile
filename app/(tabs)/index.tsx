import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { readItems } from "@directus/sdk";
import { supabase } from "@/lib/supabase";
import { directus } from "@/lib/directus";
import type {
  DirectusOrte,
  DirectusKategorie,
  DirectusEinstellungen,
} from "@/types";

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

function getImageUrl(place: DirectusOrte): string | null {
  if (place.Titelbild) return `${DIRECTUS_URL}/assets/${place.Titelbild}`;
  if (place.Hauptbild)
    return `${SUPABASE_URL}/storage/v1/object/public/media-files/places/images/main/${place.Hauptbild}`;
  return null;
}

function getCategoriesFromPlace(place: DirectusOrte): DirectusKategorie[] {
  if (!place.Kategorie) return [];
  return place.Kategorie.map((k) => k.Kategorie_id).filter(
    Boolean,
  ) as DirectusKategorie[];
}

// ─── PinCard ────────────────────────────────────────────────────────────────

const PinCard = memo(function PinCard({ place }: { place: DirectusOrte }) {
  const imageUrl = getImageUrl(place);
  const categories = getCategoriesFromPlace(place);

  return (
    <View style={styles.card}>
      <ImageBackground
        source={imageUrl ? { uri: imageUrl } : undefined}
        style={styles.cardImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          style={styles.gradientTop}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.5)"]}
          style={styles.gradientBottom}
        />
        <View style={styles.cardTopRow}>
          <View style={styles.chipWrap}>
            {categories.map((cat) => (
              <View
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: cat.Farbe ?? "#666" },
                ]}
              >
                <Text style={styles.categoryChipText}>{cat.Name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.cardName} numberOfLines={2}>
            {place.Name}
          </Text>
          <Text style={styles.cardLocation} numberOfLines={1}>
            {[place.Stadt, place.Land].filter(Boolean).join(", ")}
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
});

const ItemSeparator = () => <View style={{ height: 12 }} />;

// ─── KategorieBar ────────────────────────────────────────────────────────────

function KategorieBar({
  categories,
  selectedIds,
  onToggle,
}: {
  categories: DirectusKategorie[];
  selectedIds: number[];
  onToggle: (id: number | null) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);
  const scrollWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const allSelected = selectedIds.length === 0;

  const recalcArrows = useCallback(() => {
    const x = scrollXRef.current;
    const maxX = contentWidthRef.current - scrollWidthRef.current;
    setCanScrollLeft(x > 2);
    setCanScrollRight(maxX > 4 && x < maxX - 2);
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollXRef.current = e.nativeEvent.contentOffset.x;
      recalcArrows();
    },
    [recalcArrows],
  );

  const snapToStart = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (e.nativeEvent.contentOffset.x < 2) {
        scrollRef.current?.scrollTo({ x: 0, animated: false });
      }
    },
    [],
  );

  const handleContentSizeChange = useCallback(
    (w: number) => {
      contentWidthRef.current = w;
      recalcArrows();
    },
    [recalcArrows],
  );

  const handleLayout = useCallback(
    (w: number) => {
      scrollWidthRef.current = w;
      recalcArrows();
    },
    [recalcArrows],
  );

  const scrollLeft = useCallback(() => {
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  }, []);

  const scrollRight = useCallback(() => {
    const target = contentWidthRef.current - scrollWidthRef.current;
    scrollRef.current?.scrollTo({ x: Math.max(0, target), animated: true });
  }, []);

  return (
    <View style={styles.kategorieBar}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        overScrollMode="never"
        onScrollEndDrag={snapToStart}
        onMomentumScrollEnd={snapToStart}
        onContentSizeChange={(w) => handleContentSizeChange(w)}
        onLayout={(e) => handleLayout(e.nativeEvent.layout.width)}
        style={styles.kategorieScroll}
        contentContainerStyle={styles.kategorieScrollContent}
      >
        <TouchableOpacity
          style={[
            styles.kategorieTab,
            allSelected && styles.kategorieTabActive,
          ]}
          onPress={() => onToggle(null)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.kategorieTabText,
              allSelected && styles.kategorieTabTextActive,
            ]}
          >
            Alles
          </Text>
        </TouchableOpacity>

        {categories.map((cat) => {
          const isActive = selectedIds.includes(cat.id);
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.kategorieTab,
                isActive && {
                  backgroundColor: cat.Farbe ?? "#fc6c14",
                  borderColor: cat.Farbe ?? "#fc6c14",
                },
              ]}
              onPress={() => onToggle(cat.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.kategorieTabText,
                  isActive && styles.kategorieTabTextActive,
                ]}
              >
                {cat.Name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {canScrollLeft && (
        <TouchableOpacity
          style={styles.kategorieArrowLeft}
          onPress={scrollLeft}
          activeOpacity={0.7}
        >
          <Text style={styles.kategorieArrowText}>‹</Text>
        </TouchableOpacity>
      )}

      {canScrollRight && (
        <TouchableOpacity
          style={styles.kategorieArrowRight}
          onPress={scrollRight}
          activeOpacity={0.7}
        >
          <Text style={styles.kategorieArrowText}>›</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ListeScreen() {
  const [einstellungen, setEinstellungen] =
    useState<DirectusEinstellungen | null>(null);
  const [allPlaces, setAllPlaces] = useState<DirectusOrte[]>([]);
  const [allCategories, setAllCategories] = useState<DirectusKategorie[]>([]);
  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<
    {
      place_id: number;
      name: string;
      display_name: string;
      lat: string;
      lon: string;
    }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsOrderedIdsRef = useRef<number[] | null>(null);
  const flatListRef = useRef<FlatList<DirectusOrte>>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [settings, places, categories] = await Promise.all([
          directus.request(
            readItems("Einstellungen" as never, {
              fields: ["Logo", "Slogan"] as never[],
            }),
          ),
          directus.request(
            readItems("Orte" as never, {
              fields: [
                "id",
                "Name",
                "Adresse",
                "Stadt",
                "Land",
                "location",
                "Hauptbild",
                "Titelbild",
                "Kategorie.Kategorie_id.id",
                "Kategorie.Kategorie_id.Name",
                "Kategorie.Kategorie_id.Farbe",
                "Bearbeitungsstatus",
              ] as never[],
              limit: -1,
            }),
          ),
          directus.request(
            readItems("Kategorie" as never, {
              fields: ["id", "Name", "Farbe", "Reihenfolge"] as never[],
              sort: ["Reihenfolge"] as never[],
              limit: -1,
            }),
          ),
        ]);

        if (!mounted) return;
        setEinstellungen(settings as unknown as DirectusEinstellungen);
        setAllPlaces(places as unknown as DirectusOrte[]);
        setAllCategories(categories as unknown as DirectusKategorie[]);
      } catch {
        if (mounted) setError("Daten konnten nicht geladen werden.");
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted" && mounted) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude: lat, longitude: lng } = pos.coords;
          const { data } = await supabase.rpc("nearby_orte", {
            user_lat: lat,
            user_lng: lng,
          });
          if (data && mounted) {
            const ids = (data as { id: number }[]).map((r) => r.id);
            gpsOrderedIdsRef.current = ids;
            setOrderedIds(ids);
          }
        }
      } catch {
        // Location unavailable — display without distance sorting
      }

      if (mounted) setIsLoading(false);
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const displayedPlaces = useMemo(() => {
    let result = [...allPlaces];

    if (selectedCategoryIds.length > 0) {
      result = result.filter((p) =>
        p.Kategorie?.some(
          (k) =>
            k.Kategorie_id && selectedCategoryIds.includes(k.Kategorie_id.id),
        ),
      );
    }

    if (orderedIds) {
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      result.sort(
        (a, b) => (indexMap.get(a.id) ?? 9999) - (indexMap.get(b.id) ?? 9999),
      );
    }

    return result;
  }, [allPlaces, selectedCategoryIds, orderedIds]);

  const fetchGeoSuggestions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setGeoSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=7&addressdetails=0&accept-language=de&featuretype=city,town,village,county,state,country`;
        const res = await fetch(url, {
          headers: { "User-Agent": "FairFuehrer/1.0" },
        });
        const data = await res.json();
        setGeoSuggestions(data);
        setShowSuggestions(data.length > 0);
      } catch {
        setGeoSuggestions([]);
      }
    }, 400);
  }, []);

  const selectGeoSuggestion = useCallback(
    async (item: {
      place_id: number;
      name: string;
      display_name: string;
      lat: string;
      lon: string;
    }) => {
      setQuery(item.name || item.display_name);
      setShowSuggestions(false);
      setGeoSuggestions([]);
      Keyboard.dismiss();
      setIsGeocoding(true);
      try {
        const { data } = await supabase.rpc("nearby_orte", {
          user_lat: parseFloat(item.lat),
          user_lng: parseFloat(item.lon),
        });
        if (data) {
          setOrderedIds((data as { id: number }[]).map((r) => r.id));
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }
      } catch {
        // fallback — zostają GPS orderedIds
      }
      setIsGeocoding(false);
    },
    [],
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setGeoSuggestions([]);
    setShowSuggestions(false);
    setOrderedIds(gpsOrderedIdsRef.current);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const toggleCategory = useCallback((id: number | null) => {
    if (id === null) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
    }
  }, []);

  const renderPin = useCallback(
    ({ item }: { item: DirectusOrte }) => <PinCard place={item} />,
    [],
  );

  // Logo + slogan — statyczne, bezpiecznie w ListHeaderComponent
  const renderListHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        {einstellungen?.Logo ? (
          <Image
            source={{ uri: `${DIRECTUS_URL}/assets/${einstellungen.Logo}` }}
            style={styles.logoImage}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.logo}>FAIRFÜHRER</Text>
        )}
        {einstellungen?.Slogan ? (
          <Text style={styles.tagline}>{einstellungen.Slogan}</Text>
        ) : (
          <Text style={styles.tagline}>
            Der Audioguide für nachhaltiges Leben und Reisen
          </Text>
        )}
      </View>
    ),
    [einstellungen],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fc6c14" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Pasek wyszukiwania — poza FlatList, nie remontuje się przy wpisywaniu */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Suche…"
          placeholderTextColor="rgba(255,255,255,0.7)"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            fetchGeoSuggestions(t);
          }}
          onFocus={() => {
            if (query.length >= 2 && geoSuggestions.length > 0)
              setShowSuggestions(true);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (geoSuggestions.length > 0)
              selectGeoSuggestion(geoSuggestions[0]);
            else setShowSuggestions(false);
          }}
        />
        {isGeocoding && (
          <ActivityIndicator
            size="small"
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        )}
        {query.length > 0 && !isGeocoding && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sugestie */}
      {showSuggestions && geoSuggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {geoSuggestions.map((s) => (
            <TouchableOpacity
              key={String(s.place_id)}
              style={styles.suggestionItem}
              onPress={() => selectGeoSuggestion(s)}
            >
              <Text style={styles.suggestionText}>
                {s.name || s.display_name}
              </Text>
              <Text style={styles.suggestionSubtext} numberOfLines={1}>
                {s.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Pasek kategorii */}
      <KategorieBar
        categories={allCategories}
        selectedIds={selectedCategoryIds}
        onToggle={toggleCategory}
      />

      <FlatList
        ref={flatListRef}
        data={displayedPlaces}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPin}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Keine Ergebnisse gefunden.</Text>
          </View>
        }
        ItemSeparatorComponent={ItemSeparator}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={6}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 24,
  },
  listHeader: {
    paddingTop: 8,
  },
  logoImage: {
    width: "100%",
    height: 60,
  },
  logo: {
    fontFamily: "Anton_400Regular",
    fontSize: 30,
    color: "#fc6c14",
    textAlign: "center",
    letterSpacing: 3,
  },
  tagline: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 24,
    paddingVertical: 5,
    paddingHorizontal: 20,
    color: "#fc6c14",
    textAlign: "center",
  },
  // Pasek wyszukiwania
  searchBar: {
    backgroundColor: "#fc6c14",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  clearBtn: {
    paddingLeft: 8,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 18,
    color: "#fff",
  },
  // Sugestie
  suggestionsBox: {
    backgroundColor: "#fff",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  suggestionText: {
    fontSize: 16,
    color: "#000",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  suggestionSubtext: {
    fontSize: 12,
    color: "#555",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 1,
  },
  // Pasek kategorii
  kategorieBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(252, 108, 20, 0.1)",
    borderBottomWidth: 1,
    borderColor: "#000",
    position: "relative",
    marginBottom: 8,
  },
  kategorieScroll: {
    flex: 1,
  },
  kategorieScrollContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  kategorieTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderColor: "#000",
    backgroundColor: "transparent",
  },
  kategorieTabActive: {
    backgroundColor: "#000",
  },
  kategorieTabText: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#000",
  },
  kategorieTabTextActive: {
    color: "#fff",
  },
  // Strzałki jako overlay absolutny — nie wpływają na układ ScrollView
  kategorieArrowLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    width: 44,
  },
  kategorieArrowRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    width: 44,
  },
  kategorieArrowText: {
    fontSize: 24,
    color: "#fff",
    lineHeight: 24,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  // PinCard
  categoryChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#000",
  },
  categoryChipText: {
    fontSize: 14,
    color: "#000",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  card: {
    borderWidth: 4,
    borderColor: "#000",
    overflow: "hidden",
    width: 300,
    height: 300,
    alignSelf: "center",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    justifyContent: "space-between",
    backgroundColor: "#ddd",
  },
  gradientTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  gradientBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cardBottom: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardName: {
    fontSize: 24,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
  },
  cardLocation: {
    fontSize: 13,
    color: "#fff",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 2,
  },
  errorText: {
    fontSize: 15,
    color: "#c0392b",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: "#000",
    textAlign: "center",
    paddingTop: 40,
    fontFamily: "FiraSansCondensed_400Regular",
  },
});
