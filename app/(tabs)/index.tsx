import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Dimensions,
  Keyboard,
  Animated,
  Easing,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Circle, G, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { DirectusOrte, DirectusKategorie } from "@/types";
import MenuButton from "@/components/MenuButton";

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

const SCREEN_WIDTH = Dimensions.get("window").width;

const CARD_GAP = 12; // odstęp między kartami i od lewej krawędzi
const CARD_PEEK = 44; // ile px następnej karty widać po prawej
const CARD_WIDTH = SCREEN_WIDTH - CARD_GAP * 2 - CARD_PEEK;
// Każda karta zajmuje swoją szerokość + gap po prawej
const CARD_STEP = CARD_WIDTH + CARD_GAP;

// Stałe poza komponentem — nie tworzą nowych obiektów przy każdym renderze
const FLATLIST_HEADER = <View style={{ width: CARD_GAP }} />;
const keyExtractor = (id: number) => String(id);
const getItemLayout = (_: unknown, index: number) => ({
  length: CARD_STEP,
  offset: CARD_GAP + CARD_STEP * index,
  index,
});

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

// ─── Ikony kategorii (SVG Lucide paths) ──────────────────────────────────────

const CATEGORY_COLORS: Record<number, string> = {
  1: "#E45858", // Erlebnisse
  2: "#6477E3", // Essen & Übernachten
  3: "#F0873D", // Einkaufen
  5: "#42D742", // Engagement
  8: "#E0D12E", // Unternehmen
};

// Lucide paths jako tablice stringów d="" — viewBox 0 0 24 24
const CATEGORY_ICON_PATHS: Record<number, string[]> = {
  1: [
    // Binoculars
    "M10 10h4",
    "M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3",
    "M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z",
    "M22 16L2 16",
    "M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z",
    "M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3",
  ],
  2: [
    // Utensils
    "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
    "M7 2v20",
    "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
  ],
  3: [
    // ShoppingCart
    "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12",
  ],
  5: [
    // HeartHandshake
    "M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762",
  ],
  8: [
    // Building2
    "M10 12h4",
    "M10 8h4",
    "M14 21v-3a2 2 0 0 0-4 0v3",
    "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
    "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",
  ],
};

const DEFAULT_ICON_PATHS = [
  "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
  "M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
];

const ALL_ICON_PATHS = [
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
  "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",
  "M2 12h20",
];

// Koła ShoppingCart jako osobne d-strings (circle nie ma d)
const SHOPPING_CART_CIRCLES = [
  { cx: "8", cy: "21", r: "1" },
  { cx: "19", cy: "21", r: "1" },
];

function CategoryIcon({
  categoryId,
  color,
  size = 36,
}: {
  categoryId: number | null;
  color: string;
  size?: number;
}) {
  const paths =
    categoryId !== null
      ? (CATEGORY_ICON_PATHS[categoryId] ?? DEFAULT_ICON_PATHS)
      : ALL_ICON_PATHS;
  const extraCircles = categoryId === 3 ? SHOPPING_CART_CIRCLES : [];

  // Skalujemy ikonę do ~60% rozmiaru i centrujemy ją w okręgu
  const scale = 0.6;
  const offset = 12 * (1 - scale); // = 4.8 — przesuwa punkt (0,0) → wycentrowanie

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11" fill={color} />
      <G
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${offset}, ${offset}) scale(${scale})`}
      >
        {paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
        {extraCircles.map((c, i) => (
          <Circle
            key={`c${i}`}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill="white"
            stroke="white"
          />
        ))}
      </G>
    </Svg>
  );
}

// ─── PinCard ────────────────────────────────────────────────────────────────

const PinCard = memo(function PinCard({ placeId }: { placeId: number }) {
  const router = useRouter();
  const place = usePlacesStore((s) => s.getPlaceById(placeId));
  const imageUrl = place ? getImageUrl(place) : null;
  const categories = place ? getCategoriesFromPlace(place) : [];
  const handlePress = useCallback(
    () => router.push(`/place/${placeId}`),
    [router, placeId],
  );

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.95}
      onPress={handlePress}
    >
      <ImageBackground
        source={imageUrl ? { uri: imageUrl } : undefined}
        style={styles.cardImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "transparent"]}
          style={styles.gradientTop}
        />
        <LinearGradient
          colors={["transparent", "rgb(252, 108, 20, 0.6)"]}
          style={styles.gradientBottom}
        />
        <View style={styles.cardBottom}>
          <View style={styles.chipWrap}>
            {categories.map((cat) => (
              <CategoryIcon
                key={cat.id}
                categoryId={cat.id}
                color={cat.Farbe ?? "#666"}
                size={40}
              />
            ))}
          </View>
          <Text style={styles.cardName} numberOfLines={3}>
            {place?.Name}
          </Text>
          <Text style={styles.cardLocation} numberOfLines={1}>
            {[place?.Stadt, place?.Land].filter(Boolean).join(", ")}
          </Text>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
});

// ─── KategorieBar z wbudowanym menu ──────────────────────────────────────────

function KategorieBar({
  categories,
  selectedIds,
  onToggle,
}: {
  categories: DirectusKategorie[];
  selectedIds: Set<number>;
  onToggle: (id: number | null) => void;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const hasSelection = selectedIds.size > 0;
  const barColor = hasSelection ? "#fc6c14" : "#000";

  const openMenu = useCallback(() => {
    slideAnim.setValue(0);
    setModalVisible(true);
  }, [slideAnim]);

  const handleModalShow = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closeMenu = useCallback(
    (action: number | "all" | "cancel") => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
        if (action === "cancel") return;
        if (action === "all") {
          onToggle(null);
          return;
        }
        onToggle(action);
      });
    },
    [slideAnim, onToggle],
  );

  const menuTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const barLabel = hasSelection
    ? selectedIds.size === 1
      ? (categories.find((c) => selectedIds.has(c.id))?.Name ?? "")
      : `${selectedIds.size} Kategorien`
    : "Kategorie wählen ›";

  return (
    <View>
      {/* ── Modal z backdropem i menu ── */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onShow={handleModalShow}
        onRequestClose={() => closeMenu("cancel")}
        statusBarTranslucent
      >
        <Animated.View
          style={[styles.kategorieBackdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => closeMenu("cancel")}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.kategorieMenu,
            {
              opacity: slideAnim,
              transform: [{ translateY: menuTranslateY }],
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* "Alle" */}
          <TouchableOpacity
            style={[
              styles.kategorieMenuItem,
              !hasSelection && styles.kategorieMenuItemActive,
            ]}
            onPress={() => closeMenu("all")}
            activeOpacity={0.7}
          >
            <View style={styles.kategorieMenuIcon}>
              <CategoryIcon
                categoryId={null}
                color={!hasSelection ? "#fff" : "#000"}
              />
            </View>
            <Text
              style={[
                styles.kategorieMenuText,
                !hasSelection && styles.kategorieMenuTextActive,
              ]}
            >
              Alle
            </Text>
          </TouchableOpacity>

          {/* Kategorie — każda niezależnie toggleowana, menu nie zamyka się */}
          {categories.map((cat) => {
            const isActive = selectedIds.has(cat.id);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.kategorieMenuItem,
                  isActive && { backgroundColor: cat.Farbe ?? "#fc6c14" },
                ]}
                onPress={() => onToggle(cat.id)}
                activeOpacity={0.7}
              >
                <View style={styles.kategorieMenuIcon}>
                  <CategoryIcon
                    categoryId={cat.id}
                    color={
                      isActive ? "#fff" : (CATEGORY_COLORS[cat.id] ?? "#fc6c14")
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.kategorieMenuText,
                    isActive && styles.kategorieMenuTextActive,
                  ]}
                >
                  {cat.Name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </Modal>

      {/* ── Trigger bar ── */}
      <TouchableOpacity
        style={[styles.kategorieBar, { backgroundColor: barColor }]}
        onPress={openMenu}
        activeOpacity={0.85}
      >
        {hasSelection && selectedIds.size === 1 && (
          <View style={styles.kategorieBarIcon}>
            <CategoryIcon
              categoryId={[...selectedIds][0]}
              color={barColor}
              size={28}
            />
          </View>
        )}
        <Text style={[styles.kategorieBarText, { color: "#fff" }]}>
          {barLabel}
        </Text>
        {hasSelection && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onToggle(null);
            }}
            style={styles.kategorieClearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.kategorieClearText, { color: "#fff" }]}>
              ✕
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ListeScreen() {
  const {
    places: rawPlaces,
    categories: allCategories,
    einstellungen,
    status,
    error,
    fetchAll,
    getVisiblePlaces,
  } = usePlacesStore();
  const { isPro } = useAuth();
  // Free users see ~20 % of Sehenswürdigkeiten pins; premium sees 100 %.
  const allPlaces = useMemo(
    () => getVisiblePlaces(isPro),
    [getVisiblePlaces, isPro, rawPlaces],
  );
  const isLoading = status === "loading" || status === "idle";

  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);

  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // geo suggestions from Mapbox
  const [geoSuggestions, setGeoSuggestions] = useState<
    { name: string; place_formatted: string; lat: number; lon: number }[]
  >([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(
    new Set(),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsOrderedIdsRef = useRef<number[] | null>(null);
  const flatListRef = useRef<FlatList<number>>(null);
  const allPlacesRef = useRef(allPlaces);
  allPlacesRef.current = allPlaces;
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [bottomSectionHeight, setBottomSectionHeight] = useState(0);
  const isFocused = useIsFocused();
  const gpsDoneRef = useRef(false);

  // Fetch danych przy pierwszym montowaniu
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Sortowanie GPS — tylko raz, gdy dane gotowe i ekran aktywny
  useEffect(() => {
    if (status !== "success" || !isFocused || gpsDoneRef.current) return;
    gpsDoneRef.current = true;

    let mounted = true;

    // requestForegroundPermissionsAsync uruchamiamy najpierw bez blokowania
    Location.requestForegroundPermissionsAsync()
      .then(({ status: locStatus }) => {
        if (locStatus !== "granted" || !mounted) return;
        Location.getLastKnownPositionAsync()
          .then((lastPos) => {
            if (lastPos && mounted) {
              const { latitude: lat, longitude: lng } = lastPos.coords;
              supabase
                .rpc("nearby_orte", { user_lat: lat, user_lng: lng })
                .then(({ data, error }) => {
                  if (error || !data || !mounted) return;
                  const ids = (data as { id: number }[]).map((p) => p.id);
                  gpsOrderedIdsRef.current = ids;
                  setOrderedIds(ids);
                });
            }
            // Odśwież z aktualną pozycją w tle
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            })
              .then((pos) => {
                if (!mounted) return;
                const { latitude: lat, longitude: lng } = pos.coords;
                supabase
                  .rpc("nearby_orte", { user_lat: lat, user_lng: lng })
                  .then(({ data, error }) => {
                    if (error || !data || !mounted) return;
                    const ids = (data as { id: number }[]).map((p) => p.id);
                    gpsOrderedIdsRef.current = ids;
                    setOrderedIds(ids);
                  });
              })
              .catch(() => {});
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [status, isFocused]);

  const displayedIds = useMemo(() => {
    let result = [...allPlaces];

    if (selectedCategoryIds.size > 0) {
      result = result.filter((p) =>
        p.Kategorie?.some(
          (k) => k.Kategorie_id && selectedCategoryIds.has(k.Kategorie_id.id),
        ),
      );
    }

    if (orderedIds) {
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      result.sort(
        (a, b) => (indexMap.get(a.id) ?? 9999) - (indexMap.get(b.id) ?? 9999),
      );
    }

    return result.map((p) => p.id);
  }, [allPlaces, selectedCategoryIds, orderedIds]);

  const fetchGeoSuggestions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setGeoSuggestions([]);
      setIsFetchingSuggestions(false);
      return;
    }
    setIsFetchingSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(text)}&language=de&limit=5&types=country,region,district,place&autocomplete=true&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const json = await res.json();
        const suggestions = (json.features ?? []).map(
          (f: Record<string, unknown>) => {
            const props = f.properties as Record<string, unknown>;
            const geom = f.geometry as { coordinates: [number, number] };
            return {
              name: props.name as string,
              place_formatted: (props.place_formatted ?? "") as string,
              lat: geom.coordinates[1],
              lon: geom.coordinates[0],
            };
          },
        );
        setGeoSuggestions(suggestions);
      } catch {
        setGeoSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300);
  }, []);

  const selectGeoSuggestion = useCallback(
    async (item: {
      name: string;
      place_formatted: string;
      lat: number;
      lon: number;
    }) => {
      setQuery(item.name);
      setSearchFocused(false);
      setGeoSuggestions([]);
      Keyboard.dismiss();
      const { data, error } = await supabase.rpc("nearby_orte", {
        user_lat: item.lat,
        user_lng: item.lon,
      });
      if (error || !data) return;
      const ids = (data as { id: number }[]).map((p) => p.id);
      setOrderedIds(ids);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [],
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setSearchFocused(false);
    setGeoSuggestions([]);
    setIsFetchingSuggestions(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      setOrderedIds(gpsOrderedIdsRef.current);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, []);

  const toggleCategory = useCallback((id: number | null) => {
    if (id === null) {
      setSelectedCategoryIds(new Set());
      return;
    }
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Lokalne wyniki wyszukiwania — miejsca + kategorie dopasowane do query
  type LocalResult =
    | { type: "place"; place: DirectusOrte }
    | { type: "category"; cat: DirectusKategorie }
    | {
        type: "geo";
        name: string;
        place_formatted: string;
        lat: number;
        lon: number;
      };

  const localResults = useMemo((): LocalResult[] => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const results: LocalResult[] = [];

    // Kategorie
    allCategories.forEach((cat) => {
      if (cat.Name?.toLowerCase().includes(q))
        results.push({ type: "category", cat });
    });

    // Miejsca — po nazwie i mieście
    allPlaces.forEach((p) => {
      if (
        p.Name?.toLowerCase().includes(q) ||
        p.Stadt?.toLowerCase().includes(q)
      )
        results.push({ type: "place", place: p });
    });

    return results.slice(0, 12);
  }, [query, allPlaces, allCategories]);

  const renderCard = useCallback(
    ({ item: placeId }: { item: number }) => (
      <View style={styles.cardWrapperOuter}>
        <View style={styles.cardWrapper}>
          <PinCard placeId={placeId} />
        </View>
      </View>
    ),
    [],
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
      {/* Logo + Menu */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          {einstellungen?.Logo ? (
            <Image
              source={{ uri: `${DIRECTUS_URL}/assets/${einstellungen.Logo}` }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.logo}>FAIRFÜHRER</Text>
          )}
          <View style={styles.headerMenuSlot}>
            <MenuButton />
          </View>
        </View>
        {einstellungen?.Slogan ? (
          <Text style={styles.tagline}>{einstellungen.Slogan}</Text>
        ) : (
          <Text style={styles.tagline}>
            Der Audioguide für nachhaltiges Leben und Reisen
          </Text>
        )}
      </View>

      {/* Karty — przewijane poziomo */}
      <View style={styles.cardsArea}>
        {displayedIds.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Keine Ergebnisse gefunden.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayedIds}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_STEP}
            snapToAlignment="start"
            decelerationRate="fast"
            style={styles.flatList}
            ListHeaderComponent={FLATLIST_HEADER}
            initialNumToRender={3}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            keyExtractor={keyExtractor}
            getItemLayout={getItemLayout}
            renderItem={renderCard}
          />
        )}
      </View>

      {/* Dolna sekcja — wyszukiwarka + kategorie */}
      <View
        style={styles.bottomSection}
        onLayout={(e) => setBottomSectionHeight(e.nativeEvent.layout.height)}
      >
        {/* Pasek wyszukiwania */}
        <View
          style={[styles.searchBar, searchFocused && styles.searchBarFocused]}
        >
          <TextInput
            style={[styles.searchInput, searchFocused && { color: "#181716" }]}
            placeholder="Orte, Städte, Kategorien…"
            placeholderTextColor={
              searchFocused ? "rgba(24,23,22,0.4)" : "rgba(255,255,255,0.7)"
            }
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              fetchGeoSuggestions(t);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (geoSuggestions.length > 0)
                selectGeoSuggestion(geoSuggestions[0]);
            }}
          />
          {isFetchingSuggestions && (
            <ActivityIndicator
              size="small"
              color={searchFocused ? "#fc6c14" : "#fff"}
              style={{ marginLeft: 8 }}
            />
          )}
          {(query.length > 0 || searchFocused) && !isFetchingSuggestions && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text
                style={[
                  styles.clearBtnText,
                  searchFocused && { color: "#888" },
                ]}
              >
                ✕
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Pasek kategorii — ukryty gdy panel wyszukiwania jest otwarty */}
        {!searchFocused && (
          <KategorieBar
            categories={allCategories}
            selectedIds={selectedCategoryIds}
            onToggle={toggleCategory}
          />
        )}
      </View>

      {/* Panel wyszukiwania — pojawia się nad bottomSection gdy searchFocused */}
      {searchFocused && (
        <View style={[styles.suggestionsBox, { bottom: bottomSectionHeight }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            style={styles.suggestionsScroll}
          >
            {query.trim().length < 2 ? (
              /* ── Pusty input: chipy kategorii + popularne miejsca ── */
              <>
                <Text style={styles.suggestionsHeader}>Kategorien</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipRow}
                  contentContainerStyle={styles.chipRowContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {allCategories.map((cat) => {
                    const color = CATEGORY_COLORS[cat.id] ?? "#fc6c14";
                    const isActive = selectedCategoryIds.has(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryChip,
                          { borderColor: color },
                          isActive && { backgroundColor: color },
                        ]}
                        onPress={() => toggleCategory(cat.id)}
                      >
                        <CategoryIcon
                          categoryId={cat.id}
                          color={isActive ? "#fff" : color}
                          size={20}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            isActive && { color: "#fff" },
                          ]}
                        >
                          {cat.Name?.split(" ")[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.suggestionsHeader, { marginTop: 8 }]}>
                  Beliebt in deiner Nähe
                </Text>
                {displayedIds.slice(0, 5).map((id) => {
                  const place = allPlaces.find((p) => p.id === id);
                  if (!place) return null;
                  const cats = getCategoriesFromPlace(place);
                  const imageUrl = getImageUrl(place);
                  return (
                    <TouchableOpacity
                      key={id}
                      style={styles.suggestionItem}
                      onPress={() => {
                        clearSearch();
                        routerRef.current?.push(`/place/${id}`);
                      }}
                    >
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.suggestionThumb}
                        />
                      ) : (
                        <View
                          style={[
                            styles.suggestionThumb,
                            { backgroundColor: "#f0e8e0" },
                          ]}
                        />
                      )}
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.suggestionText} numberOfLines={1}>
                          {place.Name}
                        </Text>
                        <Text
                          style={styles.suggestionSubtext}
                          numberOfLines={1}
                        >
                          {place.Stadt}
                        </Text>
                      </View>
                      {cats[0] && (
                        <CategoryIcon
                          categoryId={cats[0].id}
                          color={CATEGORY_COLORS[cats[0].id] ?? "#fc6c14"}
                          size={28}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            ) : (
              /* ── Jest query: wyniki lokalne + geo ── */
              <>
                {/* Kategorie */}
                {localResults.filter((r) => r.type === "category").length >
                  0 && (
                  <>
                    <Text style={styles.suggestionsHeader}>Kategorien</Text>
                    {localResults
                      .filter(
                        (
                          r,
                        ): r is { type: "category"; cat: DirectusKategorie } =>
                          r.type === "category",
                      )
                      .map((r) => {
                        const color = CATEGORY_COLORS[r.cat.id] ?? "#fc6c14";
                        return (
                          <TouchableOpacity
                            key={r.cat.id}
                            style={[
                              styles.suggestionItem,
                              selectedCategoryIds.has(r.cat.id) && {
                                backgroundColor:
                                  (CATEGORY_COLORS[r.cat.id] ?? "#fc6c14") +
                                  "18",
                              },
                            ]}
                            onPress={() => toggleCategory(r.cat.id)}
                          >
                            <View style={styles.suggestionCatIcon}>
                              <CategoryIcon
                                categoryId={r.cat.id}
                                color={color}
                                size={32}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.suggestionText}>
                                {r.cat.Name}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.suggestionMeta,
                                selectedCategoryIds.has(r.cat.id) && {
                                  color: "#fc6c14",
                                  fontFamily: "FiraSansCondensed_700Bold",
                                },
                              ]}
                            >
                              {selectedCategoryIds.has(r.cat.id)
                                ? "✓"
                                : "Kategorie"}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                  </>
                )}

                {/* Miejsca */}
                {localResults.filter((r) => r.type === "place").length > 0 && (
                  <>
                    <Text style={styles.suggestionsHeader}>Orte</Text>
                    {localResults
                      .filter(
                        (r): r is { type: "place"; place: DirectusOrte } =>
                          r.type === "place",
                      )
                      .map((r) => {
                        const cats = getCategoriesFromPlace(r.place);
                        const imageUrl = getImageUrl(r.place);
                        return (
                          <TouchableOpacity
                            key={r.place.id}
                            style={styles.suggestionItem}
                            onPress={() => {
                              clearSearch();
                              // push do /place/:id — używamy RouterPushRef poniżej
                              routerRef.current?.push(`/place/${r.place.id}`);
                            }}
                          >
                            {imageUrl ? (
                              <Image
                                source={{ uri: imageUrl }}
                                style={styles.suggestionThumb}
                              />
                            ) : (
                              <View
                                style={[
                                  styles.suggestionThumb,
                                  { backgroundColor: "#f0e8e0" },
                                ]}
                              />
                            )}
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={styles.suggestionText}
                                numberOfLines={1}
                              >
                                {r.place.Name}
                              </Text>
                              <Text
                                style={styles.suggestionSubtext}
                                numberOfLines={1}
                              >
                                {r.place.Stadt}
                              </Text>
                            </View>
                            {cats[0] && (
                              <CategoryIcon
                                categoryId={cats[0].id}
                                color={CATEGORY_COLORS[cats[0].id] ?? "#fc6c14"}
                                size={28}
                              />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </>
                )}

                {/* Geo (Mapbox) */}
                {geoSuggestions.length > 0 && (
                  <>
                    <Text style={styles.suggestionsHeader}>Städte</Text>
                    {geoSuggestions.map((s, i) => (
                      <TouchableOpacity
                        key={`geo-${i}`}
                        style={styles.suggestionItem}
                        onPress={() => selectGeoSuggestion(s)}
                      >
                        <View
                          style={[
                            styles.suggestionCatIcon,
                            { backgroundColor: "#f0e8e0", borderRadius: 8 },
                          ]}
                        >
                          <Text style={{ fontSize: 16 }}>📍</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.suggestionText}>{s.name}</Text>
                          <Text
                            style={styles.suggestionSubtext}
                            numberOfLines={1}
                          >
                            {s.place_formatted}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Brak wyników */}
                {localResults.length === 0 &&
                  geoSuggestions.length === 0 &&
                  !isFetchingSuggestions && (
                    <View style={styles.noResults}>
                      <Text style={styles.noResultsText}>
                        Keine Ergebnisse.
                      </Text>
                    </View>
                  )}
              </>
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Header
  header: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerSpacer: {
    width: 36,
  },
  headerMenuSlot: {
    width: 36,
    alignItems: "flex-end",
  },
  logoImage: {
    flex: 1,
    height: 58,
  },
  logo: {
    fontFamily: "Anton_400Regular",
    fontSize: 30,
    color: "#fc6c14",
    textAlign: "center",
    letterSpacing: 3,
  },
  tagline: {
    fontFamily: "Anton_400Regular",
    fontSize: 16,
    paddingVertical: 4,
    paddingHorizontal: 20,
    color: "#fc6c14",
    textAlign: "center",
  },
  // Karty
  cardsArea: {
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  flatList: {
    flexGrow: 0,
  },
  // Outer: karta + gap po prawej stronie (tworzy odstęp między kartami)
  cardWrapperOuter: {
    width: CARD_STEP,
    paddingRight: CARD_GAP,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  // Dolna sekcja
  bottomSection: {
    position: "relative",
    zIndex: 10,
    elevation: 10,
    overflow: "visible",
  },
  // Pasek wyszukiwania
  searchBar: {
    backgroundColor: "#fc6c14",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchBarFocused: {
    backgroundColor: "#fff",
    borderTopWidth: 1.5,
    borderTopColor: "#fc6c14",
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 20,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  clearBtn: {
    paddingLeft: 8,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 18,
    color: "#fff",
  },
  // Panel sugestii — absolute nad bottomSection (bottom ustawiany dynamicznie)
  suggestionsBox: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#fafafa",
    borderTopWidth: 1,
    borderColor: "#eee",
    maxHeight: 420,
    zIndex: 200,
    elevation: 20,
  },
  suggestionsScroll: {
    flexGrow: 0,
  },
  suggestionsHeader: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fc6c14",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  // Chipy kategorii (poziome przewijanie)
  chipRow: {
    flexGrow: 0,
  },
  chipRowContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
    flexDirection: "row",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1.5,
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#181716",
  },
  // Wiersze sugestii
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 12,
    backgroundColor: "#fff",
  },
  suggestionThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    flexShrink: 0,
  },
  suggestionCatIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  suggestionText: {
    fontSize: 16,
    color: "#181716",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  suggestionSubtext: {
    fontSize: 13,
    color: "#666",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 1,
  },
  suggestionMeta: {
    fontSize: 13,
    color: "#999",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  noResults: {
    padding: 40,
    alignItems: "center",
  },
  noResultsText: {
    fontSize: 16,
    color: "#999",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  // Pasek kategorii — trigger
  kategorieBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  kategorieBarIcon: {
    marginRight: 10,
  },
  kategorieBarText: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#000",
    flex: 1,
  },
  kategorieClearBtn: {
    paddingLeft: 10,
  },
  kategorieClearText: {
    fontSize: 16,
    color: "#000",
  },
  // Wrapper dla triggera + menu
  // Menu (Modal)
  kategorieBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
  kategorieMenu: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  kategorieMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  kategorieMenuItemActive: {
    backgroundColor: "#000",
  },
  kategorieMenuIcon: {
    marginRight: 14,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  kategorieMenuText: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#000",
  },
  kategorieMenuTextActive: {
    color: "#fff",
  },
  // PinCard
  card: {
    flex: 1,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    justifyContent: "flex-end",
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
    height: 200,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: 6,
  },
  cardBottom: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  cardName: {
    fontSize: 30,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  cardLocation: {
    fontSize: 20,
    color: "#fff",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 2,
    marginBottom: 4,
    textAlign: "center",
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
