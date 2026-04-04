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
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={styles.gradientBottom}
        />
        <View style={styles.cardBottom}>
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

// ─── Ikony kategorii (emoji) ──────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<number, string> = {
  1: "🔭", // Erlebnisse
  2: "🍽️", // Gastronomie & Übernachten
  3: "🛒", // Einkaufen
  5: "🤝", // Engagement
  8: "🏢", // Unternehmen
};

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
            <Text style={styles.kategorieMenuIcon}>🗺️</Text>
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
                <Text style={styles.kategorieMenuIcon}>
                  {CATEGORY_EMOJI[cat.id] ?? "📍"}
                </Text>
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
      <TouchableOpacity
        style={styles.kategorieBar}
        onPress={openMenu}
        activeOpacity={0.85}
      >
        {selectedCat ? (
          <>
            <Text style={styles.kategorieBarText}>
              {CATEGORY_EMOJI[selectedCat.id] ?? "📍"} {selectedCat.Name}
            </Text>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              style={styles.kategorieClearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.kategorieClearText}>✕</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.kategorieBarText}>Kategorie wählen ›</Text>
        )}
      </TouchableOpacity>
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
        <Text style={styles.zurKarteText}>Zur Karte</Text>
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
    fontSize: 22,
    paddingVertical: 4,
    paddingHorizontal: 30,
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    justifyContent: "center",
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
    borderTopWidth: 1,
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
    backgroundColor: "rgba(252, 108, 20, 0.1)",
    borderTopWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
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
    borderTopWidth: 1,
    borderColor: "#000",
    zIndex: 10,
  },
  kategorieMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  kategorieMenuItemActive: {
    backgroundColor: "#000",
  },
  kategorieMenuIcon: {
    fontSize: 22,
    marginRight: 14,
    width: 30,
    textAlign: "center",
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
  categoryChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#000",
  },
  categoryChipText: {
    fontSize: 14,
    color: "#000",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
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
    fontSize: 45,
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
