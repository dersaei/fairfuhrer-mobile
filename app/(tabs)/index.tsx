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
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Keyboard,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Path } from "react-native-svg";
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

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = SCREEN_WIDTH;

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
  const [open, setOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const selectedCat = categories.find((c) => c.id === selectedId) ?? null;

  const openMenu = useCallback(() => {
    setOpen(true);
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
        setOpen(false);
        if (id !== "cancel") onSelect(id);
      });
    },
    [slideAnim, onSelect],
  );

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const menuOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.kategorieWrapper}>
      {/* Backdrop pokrywający cały ekran powyżej bottomSection */}
      {open && (
        <TouchableOpacity
          style={styles.kategorieBackdrop}
          activeOpacity={1}
          onPress={() => closeMenu("cancel")}
        />
      )}

      {/* Menu wyrasta ku górze */}
      {open && (
        <Animated.View
          style={[
            styles.kategorieMenu,
            { opacity: menuOpacity, transform: [{ translateY }] },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.kategorieMenuItem,
              selectedId === null && styles.kategorieMenuItemActive,
            ]}
            onPress={() => closeMenu(null)}
            activeOpacity={0.7}
          >
            <View style={styles.kategorieMenuIcon}>
              <CategoryIcon categoryId={null} color="#000" />
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
      )}

      {/* Trigger */}
      {(() => {
        const barColor = selectedCat
          ? (CATEGORY_COLORS[selectedCat.id] ?? "#fc6c14")
          : "#000";
        return (
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
        );
      })()}
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
  const [activeIndex, setActiveIndex] = useState(0);

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
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
          setActiveIndex(0);
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
    setActiveIndex(0);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const toggleCategory = useCallback((id: number | null) => {
    setSelectedCategoryId(id);
    setActiveIndex(0);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setActiveIndex(index);
    },
    [],
  );

  const scrollToPrev = useCallback(() => {
    const prev = activeIndex - 1;
    if (prev < 0) return;
    flatListRef.current?.scrollToIndex({ index: prev, animated: true });
    setActiveIndex(prev);
  }, [activeIndex]);

  const scrollToNext = useCallback(() => {
    const next = activeIndex + 1;
    if (next >= displayedPlaces.length) return;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  }, [activeIndex, displayedPlaces.length]);

  const renderPin = useCallback(
    ({ item }: { item: DirectusOrte }) => (
      <View style={styles.cardWrapper}>
        <PinCard place={item} />
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

      {/* Zur Karte */}
      <View style={styles.zurKarteBar}>
        <TouchableOpacity style={styles.zurKarteBtn} activeOpacity={0.7}>
          <Text style={styles.zurKarteText}>Zur Karte</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zurKarteBtn} activeOpacity={0.7}>
          <Text style={styles.zurKarteText}>Hilfe</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.zurKarteBtn} activeOpacity={0.7}>
          <Text style={styles.zurKarteText}>Anmelden</Text>
        </TouchableOpacity>
      </View>

      {/* Karty — przewijane poziomo */}
      <View style={styles.cardsArea}>
        {displayedPlaces.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Keine Ergebnisse gefunden.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayedPlaces}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderPin}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            maxToRenderPerBatch={4}
            windowSize={5}
            initialNumToRender={3}
          />
        )}

        {/* Strzałka lewa */}
        {activeIndex > 0 && (
          <TouchableOpacity
            style={styles.cardArrowLeft}
            onPress={scrollToPrev}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["rgba(0,0,0,0.45)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardArrowGradient}
            >
              <Text style={styles.cardArrowText}>‹</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Strzałka prawa */}
        {activeIndex < displayedPlaces.length - 1 && (
          <TouchableOpacity
            style={styles.cardArrowRight}
            onPress={scrollToNext}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.45)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cardArrowGradient}
            >
              <Text style={styles.cardArrowText}>›</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Dolna sekcja — kategorie + sugestie + wyszukiwarka */}
      <View style={styles.bottomSection}>
        {/* Pasek kategorii */}
        <KategorieBar
          categories={allCategories}
          selectedId={selectedCategoryId}
          onSelect={toggleCategory}
        />

        {/* Sugestie — absolutnie nad wyszukiwarką, nie wpływają na layout */}
        {showSuggestions && geoSuggestions.length > 0 && (
          <View style={styles.suggestionsBox}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.suggestionsScroll}
            >
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
            </ScrollView>
          </View>
        )}

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
      </View>
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
    position: "relative",
  },
  cardWrapper: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  // Strzałki kart
  cardArrowLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 72,
    zIndex: 10,
    justifyContent: "center",
  },
  cardArrowRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 72,
    zIndex: 10,
    justifyContent: "center",
  },
  cardArrowGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardArrowText: {
    fontSize: 48,
    color: "#fff",
    lineHeight: 52,
    includeFontPadding: false,
  },
  // Dolna sekcja
  bottomSection: {
    position: "relative",
    zIndex: 10,
  },
  // Zur Karte
  zurKarteBar: {
    backgroundColor: "#000",
    flexDirection: "row",
  },
  zurKarteBtn: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    alignItems: "center",
  },
  zurKarteText: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    letterSpacing: 1,
    textAlign: "center",
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
  // Sugestie
  suggestionsBox: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    backgroundColor: "#fff",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: "#000",
    maxHeight: 280,
    zIndex: 20,
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
  kategorieWrapper: {
    position: "relative",
  },
  // Menu
  kategorieBackdrop: {
    position: "absolute",
    top: -9999,
    left: -9999,
    right: -9999,
    bottom: 0,
    zIndex: 9,
  },
  kategorieMenu: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "100%",
    backgroundColor: "#fff",
    zIndex: 10,
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
    overflow: "hidden",
    width: CARD_WIDTH,
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
    fontSize: 40,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    textAlign: "center",
  },
  cardLocation: {
    fontSize: 25,
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
