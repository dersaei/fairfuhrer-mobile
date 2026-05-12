import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { usePlacesStore, isSightsCategory } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { DirectusOrte, DirectusKategorie } from "@/types";
import MenuButton from "@/components/MenuButton";
import { CategoryIcon, CATEGORY_COLORS } from "@/components/CategoryIcon";
import { PinCard } from "@/components/PinCard";
import { getImageUrl, getCategoriesFromPlace } from "@/utils/placeHelpers";

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";
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

// Popularne miejscowości — chips do szybkiego filtrowania
const CITY_CHIPS = [
  { label: "Lindau", lat: 47.5461, lon: 9.6831 },
  { label: "St. Gallen", lat: 47.4239, lon: 9.3748 },
  { label: "Bregenz", lat: 47.503, lon: 9.7471 },
  { label: "Konstanz", lat: 47.6608, lon: 9.1756 },
  { label: "Überlingen", lat: 47.7704, lon: 9.1634 },
  { label: "Meersburg", lat: 47.6943, lon: 9.2726 },
  { label: "Friedrichshafen", lat: 47.6549, lon: 9.4769 },
];

// ─── KategorieBar z wbudowanym menu ──────────────────────────────────────────

function KategorieBar({
  categories,
  selectedIds,
  onToggle,
  isPro,
}: {
  categories: DirectusKategorie[];
  selectedIds: Set<number>;
  onToggle: (id: number | null) => void;
  isPro: boolean;
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
            style={[styles.kategorieMenuItem, !hasSelection && styles.kategorieMenuItemActive]}
            onPress={() => closeMenu("all")}
            activeOpacity={0.7}
          >
            <View style={styles.kategorieMenuIcon}>
              <CategoryIcon categoryId={null} color={!hasSelection ? "#fff" : "#000"} />
            </View>
            <Text
              style={[styles.kategorieMenuText, !hasSelection && styles.kategorieMenuTextActive]}
            >
              Alle
            </Text>
          </TouchableOpacity>

          {/* Kategorie — każda niezależnie toggleowana, menu nie zamyka się */}
          {categories.map((cat) => {
            const isActive = selectedIds.has(cat.id);
            const showSightsHint = !isPro && isSightsCategory(cat);
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
                    color={isActive ? "#fafafa" : (CATEGORY_COLORS[cat.id] ?? "#fc6c14")}
                  />
                </View>
                <View style={styles.kategorieMenuTextWrap}>
                  <Text
                    style={[styles.kategorieMenuText, isActive && styles.kategorieMenuTextActive]}
                  >
                    {cat.Name}
                  </Text>
                  {showSightsHint && (
                    <Text
                      style={[styles.kategorieMenuHint, isActive && styles.kategorieMenuHintActive]}
                    >
                      Basis-Nutzer sehen nur 20 % der Sehenswertes-Orte. Mit Fairführer+ sind alle
                      sichtbar.
                    </Text>
                  )}
                </View>
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
              color="#fff"
              strokeColor={barColor}
              size={28}
            />
          </View>
        )}
        <Text style={[styles.kategorieBarText, { color: "#fff" }]}>{barLabel}</Text>
        {hasSelection && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onToggle(null);
            }}
            style={styles.kategorieClearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.kategorieClearText, { color: "#fff" }]}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ListeScreen() {
  const {
    categories: allCategories,
    einstellungen,
    status,
    error,
    fetchAll,
    getVisiblePlaces,
  } = usePlacesStore();
  const { isPro } = useAuth();
  // Free users see ~20 % of Sehenswürdigkeiten pins; premium sees 100 %.
  const allPlaces = getVisiblePlaces(isPro);
  const isLoading = status === "loading" || status === "idle";

  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);

  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // geo suggestions from Mapbox
  const [geoSuggestions, setGeoSuggestions] = useState<
    { name: string; place_formatted: string; lat: number; lon: number }[]
  >([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gpsOrderedIdsRef = useRef<number[] | null>(null);
  const flatListRef = useRef<FlatList<number>>(null);
  const allPlacesRef = useRef(allPlaces);
  allPlacesRef.current = allPlaces;
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [bottomSectionHeight, setBottomSectionHeight] = useState(0);
  const [activeCityLabel, setActiveCityLabel] = useState<string | null>(null);
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
        p.Kategorie?.some((k) => k.Kategorie_id && selectedCategoryIds.has(k.Kategorie_id.id)),
      );
    }

    if (orderedIds) {
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      result.sort((a, b) => (indexMap.get(a.id) ?? 9999) - (indexMap.get(b.id) ?? 9999));
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
        const suggestions = (json.features ?? []).map((f: Record<string, unknown>) => {
          const props = f.properties as Record<string, unknown>;
          const geom = f.geometry as { coordinates: [number, number] };
          return {
            name: props.name as string,
            place_formatted: (props.place_formatted ?? "") as string,
            lat: geom.coordinates[1],
            lon: geom.coordinates[0],
          };
        });
        setGeoSuggestions(suggestions);
      } catch {
        setGeoSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300);
  }, []);

  const selectGeoSuggestion = useCallback(
    async (item: { name: string; place_formatted: string; lat: number; lon: number }) => {
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

  const selectCityChip = useCallback(
    async (city: { label: string; lat: number; lon: number } | null) => {
      if (!city) {
        setActiveCityLabel(null);
        setOrderedIds(gpsOrderedIdsRef.current);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        return;
      }
      setActiveCityLabel(city.label);
      const { data, error } = await supabase.rpc("nearby_orte", {
        user_lat: city.lat,
        user_lng: city.lon,
      });
      if (error || !data) return;
      const ids = (data as { id: number }[]).map((p) => p.id);
      setOrderedIds(ids);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [],
  );

  const toggleCategory = useCallback((id: number | null) => {
    if (id === null) {
      setSelectedCategoryIds(new Set());
      return;
    }
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
      if (cat.Name?.toLowerCase().includes(q)) results.push({ type: "category", cat });
    });

    // Miejsca — po nazwie i mieście
    allPlaces.forEach((p) => {
      if (p.Name?.toLowerCase().includes(q) || p.Stadt?.toLowerCase().includes(q))
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
          <Text style={styles.tagline}>Der Audioguide für nachhaltiges Leben und Reisen</Text>
        )}
      </View>

      {/* Przestrzeń nad kartą — GPS label wyśrodkowany pionowo */}
      <View style={styles.aboveCards}>
        {orderedIds && (
          <View style={styles.gpsLabel}>
            <Text style={styles.gpsLabelText}>Nach Entfernung sortiert</Text>
          </View>
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

      {/* Przestrzeń pod kartą — city chips wyśrodkowane pionowo */}
      {!searchFocused && (
        <View style={styles.belowCards}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cityChipRow}
            contentContainerStyle={styles.cityChipRowContent}
          >
            <TouchableOpacity
              style={[styles.cityChip, activeCityLabel === null && styles.cityChipActive]}
              onPress={() => selectCityChip(null)}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.cityChipText, activeCityLabel === null && styles.cityChipTextActive]}
              >
                Alle
              </Text>
            </TouchableOpacity>
            {CITY_CHIPS.map((city) => {
              const isActive = activeCityLabel === city.label;
              return (
                <TouchableOpacity
                  key={city.label}
                  style={[styles.cityChip, isActive && styles.cityChipActive]}
                  onPress={() => selectCityChip(city)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cityChipText, isActive && styles.cityChipTextActive]}>
                    {city.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Dolna sekcja — wyszukiwarka + kategorie */}
      <View
        style={styles.bottomSection}
        onLayout={(e) => setBottomSectionHeight(e.nativeEvent.layout.height)}
      >
        {/* Pasek wyszukiwania */}
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <TextInput
            style={[styles.searchInput, searchFocused && { color: "#181716" }]}
            placeholder="Orte, Städte, Kategorien…"
            placeholderTextColor={searchFocused ? "rgba(24,23,22,0.4)" : "rgba(255,255,255,0.7)"}
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
              if (geoSuggestions.length > 0) selectGeoSuggestion(geoSuggestions[0]);
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
              <Text style={[styles.clearBtnText, searchFocused && { color: "#888" }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Pasek kategorii — ukryty gdy panel wyszukiwania jest otwarty */}
        {!searchFocused && (
          <KategorieBar
            categories={allCategories}
            selectedIds={selectedCategoryIds}
            onToggle={toggleCategory}
            isPro={isPro}
          />
        )}
      </View>

      {/* Panel wyszukiwania — pojawia się nad bottomSection gdy searchFocused */}
      {searchFocused && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setSearchFocused(false);
              Keyboard.dismiss();
            }}
          />
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
                          <Text style={[styles.categoryChipText, isActive && { color: "#fff" }]}>
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
                          <Image source={{ uri: imageUrl }} style={styles.suggestionThumb} />
                        ) : (
                          <View style={[styles.suggestionThumb, { backgroundColor: "#f0e8e0" }]} />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.suggestionText} numberOfLines={1}>
                            {place.Name}
                          </Text>
                          <Text style={styles.suggestionSubtext} numberOfLines={1}>
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
                  {localResults.filter((r) => r.type === "category").length > 0 && (
                    <>
                      <Text style={styles.suggestionsHeader}>Kategorien</Text>
                      {localResults
                        .filter(
                          (
                            r,
                          ): r is {
                            type: "category";
                            cat: DirectusKategorie;
                          } => r.type === "category",
                        )
                        .map((r) => {
                          const color = CATEGORY_COLORS[r.cat.id] ?? "#fc6c14";
                          return (
                            <TouchableOpacity
                              key={r.cat.id}
                              style={[
                                styles.suggestionItem,
                                selectedCategoryIds.has(r.cat.id) && {
                                  backgroundColor: (CATEGORY_COLORS[r.cat.id] ?? "#fc6c14") + "18",
                                },
                              ]}
                              onPress={() => toggleCategory(r.cat.id)}
                            >
                              <View style={styles.suggestionCatIcon}>
                                <CategoryIcon categoryId={r.cat.id} color={color} size={32} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.suggestionText}>{r.cat.Name}</Text>
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
                                {selectedCategoryIds.has(r.cat.id) ? "✓" : "Kategorie"}
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
                          (r): r is { type: "place"; place: DirectusOrte } => r.type === "place",
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
                                <Image source={{ uri: imageUrl }} style={styles.suggestionThumb} />
                              ) : (
                                <View
                                  style={[styles.suggestionThumb, { backgroundColor: "#f0e8e0" }]}
                                />
                              )}
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.suggestionText} numberOfLines={1}>
                                  {r.place.Name}
                                </Text>
                                <Text style={styles.suggestionSubtext} numberOfLines={1}>
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
                            <Text style={styles.suggestionSubtext} numberOfLines={1}>
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
                        <Text style={styles.noResultsText}>Keine Ergebnisse.</Text>
                      </View>
                    )}
                </>
              )}
            </ScrollView>
          </View>
        </>
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
    height: 68,
  },
  logo: {
    fontFamily: "Anton_400Regular",
    fontSize: 30,
    color: "#fc6c14",
    textAlign: "center",
    letterSpacing: 3,
  },
  tagline: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 18,
    paddingVertical: 4,
    paddingHorizontal: 60,
    color: "#fc6c14",
    textAlign: "center",
  },
  // Przestrzeń nad kartami — GPS label wyśrodkowany pionowo
  aboveCards: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  // Karty — stała wysokość, nie rozciąga się
  cardsArea: {
    flexShrink: 0,
  },
  // Przestrzeń pod kartami — chips wyśrodkowane pionowo
  belowCards: {
    flex: 1,
    justifyContent: "center",
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
  kategorieMenuTextWrap: { flex: 1 },
  kategorieMenuText: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#000",
  },
  kategorieMenuTextActive: {
    color: "#fff",
  },
  kategorieMenuHint: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#5c2121",
    marginTop: 2,
    paddingRight: 8,
  },
  kategorieMenuHintActive: {
    color: "rgba(255,255,255,0.9)",
  },
  // GPS sort label — czarne tło, biały tekst
  gpsLabel: {
    backgroundColor: "#fafafa",
    paddingHorizontal: 10,
    borderRadius: 10,
    paddingVertical: 3,
    marginLeft: CARD_GAP,
  },
  gpsLabelText: {
    fontSize: 12,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#fc6c14",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  // City chips bar
  cityChipRow: {
    flexGrow: 0,
  },
  cityChipRowContent: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    gap: 6,
    flexDirection: "row",
  },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },
  cityChipActive: {
    backgroundColor: "#181716",
  },
  cityChipText: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#181716",
    letterSpacing: 0.3,
  },
  cityChipTextActive: {
    color: "#fc6c14",
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
