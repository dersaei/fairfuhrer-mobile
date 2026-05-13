import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import type { DirectusOrte, DirectusKategorie } from "@/types";
import HomeHeader from "@/components/HomeHeader";
import { PinCard } from "@/components/PinCard";
import { KategorieBar } from "@/components/KategorieBar";
import { SearchSection } from "@/components/SearchSection";
import { CityChips, placesInRegion, type Region } from "@/components/CityChips";
import { supabase } from "@/lib/supabase";

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

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ListeScreen() {
  const {
    categories: allCategories,
    einstellungen,
    status,
    error,
    fetchAll,
    getAllPlacesWithLocked,
  } = usePlacesStore();
  const { isPro } = useAuth();
  // All places shown; locked ones open paywall on tap (same logic as map).
  const { places: allPlaces } = useMemo(
    () => getAllPlacesWithLocked(isPro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAllPlacesWithLocked, isPro, status],
  );
  const isLoading = status === "loading" || status === "idle";

  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);
  const [regionFilterIds, setRegionFilterIds] = useState<Set<number> | null>(null);

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
  const [activeRegionName, setActiveRegionName] = useState<string | null>(null);
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

  const categoryFilteredPlaces = useMemo(() => {
    if (selectedCategoryIds.size === 0) return allPlaces;
    return allPlaces.filter((p) =>
      p.Kategorie?.some((k) => k.Kategorie_id && selectedCategoryIds.has(k.Kategorie_id.id)),
    );
  }, [allPlaces, selectedCategoryIds]);

  const displayedIds = useMemo(() => {
    let result = [...allPlaces];

    // Filtruj do wybranego regionu (chip)
    if (regionFilterIds !== null) {
      result = result.filter((p) => regionFilterIds.has(p.id));
    }

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
  }, [allPlaces, regionFilterIds, selectedCategoryIds, orderedIds]);

  const handleLocationSelect = useCallback(
    (cityData: { name: string; region?: Region; fromSearch?: boolean; lat?: number; lon?: number } | null) => {
      if (!cityData) {
        setActiveRegionName(null);
        setRegionFilterIds(null);
        setOrderedIds(gpsOrderedIdsRef.current);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        return;
      }

      setActiveRegionName(cityData.name);

      if (cityData.fromSearch) {
        setQuery(cityData.name);
        setSearchFocused(false);
        setGeoSuggestions([]);
        Keyboard.dismiss();
      }

      if (cityData.region) {
        const ids = new Set(
          placesInRegion(allPlacesRef.current, cityData.region).map((p) => p.id),
        );
        setRegionFilterIds(ids);
        setOrderedIds(null);
      }

      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [],
  );

  const clearSearch = useCallback(() => {
    setActiveRegionName(null);
    setRegionFilterIds(null);
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
      <HomeHeader einstellungen={einstellungen} />

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
          <CityChips
            activeRegionName={activeRegionName}
            allPlaces={allPlaces}
            filteredPlaces={categoryFilteredPlaces}
            onSelectRegion={(region: Region | null) =>
              handleLocationSelect(region ? { name: region.name, region } : null)
            }
          />
        </View>
      )}

      {/* Dolna sekcja — wyszukiwarka + kategorie */}
      <View
        style={styles.bottomSection}
        onLayout={(e) => setBottomSectionHeight(e.nativeEvent.layout.height)}
      >
        <SearchSection
          query={query}
          setQuery={setQuery}
          searchFocused={searchFocused}
          setSearchFocused={setSearchFocused}
          geoSuggestions={geoSuggestions}
          setGeoSuggestions={setGeoSuggestions}
          isFetchingSuggestions={isFetchingSuggestions}
          setIsFetchingSuggestions={setIsFetchingSuggestions}
          localResults={localResults}
          selectedCategoryIds={selectedCategoryIds}
          toggleCategory={toggleCategory}
          allCategories={allCategories}
          allPlaces={allPlaces}
          displayedIds={displayedIds}
          handleLocationSelect={handleLocationSelect}
          clearSearch={clearSearch}
          bottomSectionHeight={bottomSectionHeight}
          setActiveCityLabel={setActiveRegionName}
        />

        {/* Pasek kategorii — ukryty gdy panel wyszukiwania jest otwarty */}
        <View style={{ display: searchFocused ? "none" : "flex" }}>
          <KategorieBar
            categories={allCategories}
            selectedIds={selectedCategoryIds}
            onToggle={toggleCategory}
            isPro={isPro}
          />
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
