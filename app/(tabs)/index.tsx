import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  Image,
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
import { supabase } from "@/lib/supabase";
import { usePlacesStore } from "@/stores/placesStore";
import PagerView from "react-native-pager-view";
import type { DirectusOrte, DirectusKategorie } from "@/types";

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

const SCREEN_WIDTH = Dimensions.get("window").width;

const CARD_PEEK = 44; // ile px sąsiedniej karty widać po bokach
const CARD_GAP = 10; // odstęp między kartami
const CARD_WIDTH = SCREEN_WIDTH - CARD_PEEK * 2 - CARD_GAP * 2;

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
  2: "#6477E3", // Gastronomie & Übernachten
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

// ─── KategorieBar z wbudowanym menu ──────────────────────────────────────────

function KategorieBar({
  categories,
  selectedId,
  onSelect,
}: {
  categories: DirectusKategorie[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const selectedCat = categories.find((c) => c.id === selectedId) ?? null;
  const barColor = selectedCat
    ? (CATEGORY_COLORS[selectedCat.id] ?? "#fc6c14")
    : "#000";

  const openMenu = useCallback(() => {
    slideAnim.setValue(0);
    setModalVisible(true);
  }, [slideAnim]);

  // Animacja startuje dopiero gdy Modal jest już wyrenderowany
  const handleModalShow = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closeMenu = useCallback(
    (id: number | null | "cancel") => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
        if (id !== "cancel") onSelect(id);
      });
    },
    [slideAnim, onSelect],
  );

  const menuTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

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
        {/* Backdrop — prawdziwy fullscreen, zamyka tapem */}
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

        {/* Menu — wyrasta od dołu ekranu */}
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
              selectedId === null && styles.kategorieMenuItemActive,
            ]}
            onPress={() => closeMenu(null)}
            activeOpacity={0.7}
          >
            <View style={styles.kategorieMenuIcon}>
              <CategoryIcon
                categoryId={null}
                color={selectedId === null ? "#fff" : "#000"}
              />
            </View>
            <Text
              style={[
                styles.kategorieMenuText,
                selectedId === null && styles.kategorieMenuTextActive,
              ]}
            >
              Alle
            </Text>
          </TouchableOpacity>

          {/* Kategorie */}
          {categories.map((cat) => {
            const isActive = cat.id === selectedId;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.kategorieMenuItem,
                  isActive && { backgroundColor: cat.Farbe ?? "#fc6c14" },
                ]}
                onPress={() => closeMenu(cat.id)}
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
        {selectedCat ? (
          <>
            <View style={styles.kategorieBarIcon}>
              <CategoryIcon
                categoryId={selectedCat.id}
                color={barColor}
                size={28}
              />
            </View>
            <Text style={[styles.kategorieBarText, { color: "#fff" }]}>
              {selectedCat.Name}
            </Text>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              style={styles.kategorieClearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.kategorieClearText, { color: "#fff" }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={[styles.kategorieBarText, { color: "#fff" }]}>
            Kategorie wählen ›
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ListeScreen() {
  const router = useRouter();
  const {
    places: allPlaces,
    categories: allCategories,
    einstellungen,
    status,
    error,
    fetchAll,
  } = usePlacesStore();
  const isLoading = status === "loading" || status === "idle";

  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);

  const [query, setQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<
    { name: string; place_formatted: string; lat: number; lon: number }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsOrderedIdsRef = useRef<number[] | null>(null);
  const allPlacesRef = useRef(allPlaces);
  allPlacesRef.current = allPlaces;
  const [bottomSectionHeight, setBottomSectionHeight] = useState(0);

  // Fetch danych przy pierwszym montowaniu
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Sortowanie GPS — odpala się tylko raz gdy status zmienia się na success
  useEffect(() => {
    if (status !== "success") return;

    let mounted = true;
    async function sortByGps() {
      try {
        const { status: locStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (locStatus !== "granted" || !mounted) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude: lat, longitude: lng } = pos.coords;
        const R = 6371;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dist = (pLat: number, pLng: number) => {
          const dLat = toRad(pLat - lat);
          const dLng = toRad(pLng - lng);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat)) *
              Math.cos(toRad(pLat)) *
              Math.sin(dLng / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };
        const sorted = [...allPlacesRef.current].sort((a, b) => {
          const [aLng, aLat] = a.location?.coordinates ?? [999, 999];
          const [bLng, bLat] = b.location?.coordinates ?? [999, 999];
          return dist(aLat, aLng) - dist(bLat, bLng);
        });
        const ids = sorted.map((p) => p.id);
        if (mounted) {
          gpsOrderedIdsRef.current = ids;
          setOrderedIds(ids);
        }
      } catch {
        // Location unavailable — display without sorting
      }
    }
    sortByGps();
    return () => {
      mounted = false;
    };
  }, [status]); // tylko status — nie allPlaces, żeby GPS nie nadpisywał wyboru z wyszukiwarki

  // Klucz PagerView — wymusza pełne remontowanie gdy zmienia się kolejność
  const pagerKey = orderedIds ? orderedIds.slice(0, 5).join(",") : "default";

  const displayedPlaces = useMemo(() => {
    let result = [...allPlaces];

    if (selectedCategoryId !== null) {
      result = result.filter((p) =>
        p.Kategorie?.some(
          (k) => k.Kategorie_id && k.Kategorie_id.id === selectedCategoryId,
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
  }, [allPlaces, selectedCategoryId, orderedIds]);

  const fetchGeoSuggestions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setGeoSuggestions([]);
      setShowSuggestions(false);
      setIsFetchingSuggestions(false);
      return;
    }
    setIsFetchingSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(text)}&language=de&limit=7&types=country,region,district,place&autocomplete=true&access_token=${MAPBOX_TOKEN}`;
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
        setShowSuggestions(suggestions.length > 0);
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
      setShowSuggestions(false);
      setGeoSuggestions([]);
      Keyboard.dismiss();
      setIsGeocoding(true);
      try {
        const { data } = await supabase.rpc("nearby_orte", {
          user_lat: item.lat,
          user_lng: item.lon,
        });
        if (data) {
          setOrderedIds((data as { id: number }[]).map((r) => r.id));
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
    setIsFetchingSuggestions(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Resetuj kolejność w następnej klatce, żeby UI nie blokował
    requestAnimationFrame(() => {
      setOrderedIds(gpsOrderedIdsRef.current);
    });
  }, []);

  const toggleCategory = useCallback((id: number | null) => {
    setSelectedCategoryId(id);
  }, []);

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
      {/* Logo + Slogan */}
      <View style={styles.header}>
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

      {/* Karty — przewijane poziomo */}
      <View style={styles.cardsArea}>
        {displayedPlaces.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Keine Ergebnisse gefunden.</Text>
          </View>
        ) : (
          <PagerView
            key={pagerKey}
            style={styles.pagerView}
            initialPage={0}
            overdrag
            pageMargin={CARD_GAP * 2}
          >
            {displayedPlaces.map((place) => (
              <View key={String(place.id)} style={styles.pagerPage}>
                <TouchableOpacity
                  style={styles.cardWrapper}
                  activeOpacity={0.95}
                  onPress={() => router.push(`/place/${place.id}`)}
                >
                  <PinCard place={place} />
                </TouchableOpacity>
              </View>
            ))}
          </PagerView>
        )}
      </View>

      {/* Dolna sekcja — kategorie + wyszukiwarka */}
      <View
        style={styles.bottomSection}
        onLayout={(e) => setBottomSectionHeight(e.nativeEvent.layout.height)}
      >
        {/* Pasek kategorii */}
        <KategorieBar
          categories={allCategories}
          selectedId={selectedCategoryId}
          onSelect={toggleCategory}
        />

        {/* Pasek wyszukiwania */}
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
          {(isGeocoding || isFetchingSuggestions) && (
            <ActivityIndicator
              size="small"
              color="#fff"
              style={{ marginLeft: 8 }}
            />
          )}
          {query.length > 0 && !isGeocoding && !isFetchingSuggestions && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sugestie — absolute nad bottomSection, poza jego drzewem */}
      {showSuggestions && geoSuggestions.length > 0 && (
        <View style={[styles.suggestionsBox, { bottom: bottomSectionHeight }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            bounces={false}
            style={styles.suggestionsScroll}
          >
            {geoSuggestions.map((s, i) => (
              <TouchableOpacity
                key={`${s.name}-${i}`}
                style={styles.suggestionItem}
                onPress={() => selectGeoSuggestion(s)}
              >
                <Text style={styles.suggestionText}>{s.name}</Text>
                <Text style={styles.suggestionSubtext} numberOfLines={1}>
                  {s.place_formatted}
                </Text>
              </TouchableOpacity>
            ))}
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
    fontSize: 21,
    paddingVertical: 4,
    paddingHorizontal: 40,
    color: "#fc6c14",
    textAlign: "center",
  },
  // Karty
  cardsArea: {
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
  pagerView: {
    flex: 1,
  },
  pagerPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: CARD_PEEK,
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
    overflow: "visible",
  },
  // Pasek wyszukiwania
  searchBar: {
    backgroundColor: "#fc6c14",
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
  // Sugestie — absolute nad bottomSection (bottom ustawiany dynamicznie)
  suggestionsBox: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#000",
    maxHeight: 360,
    zIndex: 100,
    elevation: 10,
  },
  suggestionsScroll: {
    flexGrow: 0,
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
