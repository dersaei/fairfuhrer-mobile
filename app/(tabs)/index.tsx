import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Linking,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import Svg, { Polygon, Circle } from "react-native-svg";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import { usePlaylistStore } from "@/stores/playlistStore";
import { getAudioUrl } from "@/lib/mediaUrls";
import HomeHeader from "@/components/HomeHeader";
import { PinCard } from "@/components/PinCard";
import { KategorieBar } from "@/components/KategorieBar";
import { SearchSection, type SearchSectionHandle } from "@/components/SearchSection";
import { CityChips, placesInRegion, type Region } from "@/components/CityChips";
import { supabase } from "@/lib/supabase";
import { useGpsSort } from "@/hooks/useGpsSort";

const CARD_GAP = 12; // odstęp między kartami i od lewej krawędzi
const CARD_PEEK = 44; // ile px następnej karty widać po prawej
const MAX_CARD_WIDTH = 420; // cap dla tabletów — karta nie szersza niż na większym telefonie

const keyExtractor = (id: number) => String(id);

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ListeScreen() {
  const {
    categories: allCategories,
    einstellungen,
    status,
    error,
    isOffline,
    fetchAll,
    getAllPlacesWithLocked,
  } = usePlacesStore();
  const { isPro } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchRef = useRef<SearchSectionHandle>(null);
  // Bei Rückkehr aus einem modal-Screen (Pin-Detail, Paywall) oder anderem
  // Tab die Such-Vorschläge ausblenden — ZACHOWUJEMY jednak wpisany tekst
  // (np. "Lindau"), zeby user widzial ze filtr jest nadal aktywny. Reset
  // nastepuje tylko przy jawnym klikanciu X w wyszukiwarce.
  useEffect(() => {
    if (pathname === "/" || pathname === "/(tabs)") {
      searchRef.current?.hideSuggestions();
    }
  }, [pathname]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Wymiary kart — capped dla tabletów, wycentrowane gdy ekran szerszy niż karta + peek.
  // Wysokość ograniczona wysokością ekranu, żeby chipsy/search/kategoryBar się mieściły.
  const { CARD_WIDTH, CARD_HEIGHT, CARD_STEP, LIST_HORIZONTAL_PADDING } = useMemo(() => {
    const naturalWidth = screenWidth - CARD_GAP * 2 - CARD_PEEK;
    const width = Math.min(naturalWidth, MAX_CARD_WIDTH);
    const step = width + CARD_GAP;
    // Pad po lewej, żeby na szerokich ekranach karta + peek były wycentrowane
    const padding = Math.max(CARD_GAP, (screenWidth - width - CARD_PEEK) / 2);
    // Wysokość: max ~38% ekranu — zostawia ~62% na header + GPS label + chipsy + search + kategorie.
    // Na telefonie portrait najczęściej ograniczy aspect ratio (1.1× szerokości), na tablecie height.
    const height = Math.min(width * 1.1, screenHeight * 0.38);
    return {
      CARD_WIDTH: width,
      CARD_HEIGHT: height,
      CARD_STEP: step,
      LIST_HORIZONTAL_PADDING: padding,
    };
  }, [screenWidth, screenHeight]);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: CARD_STEP,
      offset: LIST_HORIZONTAL_PADDING + CARD_STEP * index,
      index,
    }),
    [CARD_STEP, LIST_HORIZONTAL_PADDING],
  );

  const flatListHeader = useMemo(
    () => <View style={{ width: LIST_HORIZONTAL_PADDING }} />,
    [LIST_HORIZONTAL_PADDING],
  );

  // All places shown; locked ones open paywall on tap (same logic as map).
  const { places: allPlaces } = useMemo(
    () => getAllPlacesWithLocked(isPro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAllPlacesWithLocked, isPro, status],
  );
  const isLoading = status === "loading" || status === "idle";

  const {
    orderedIds,
    setOrderedIds,
    orderedIdsRef: gpsOrderedIdsRef,
    status: gpsStatus,
    sortByLocation,
  } = useGpsSort(status === "success");

  // Dauerhaft abgelehnte Berechtigung lässt sich in der App nicht mehr
  // erfragen — dann führt der Button in die Systemeinstellungen.
  const handleSortByLocation = useCallback(() => {
    if (gpsStatus === "blocked") {
      Linking.openSettings().catch(() => {});
      return;
    }
    sortByLocation();
  }, [gpsStatus, sortByLocation]);

  // Kurz halten: die Zeile teilt sich den Platz mit "Alle abspielen".
  const gpsButtonLabel =
    gpsStatus === "blocked"
      ? "Standort aktivieren"
      : gpsStatus === "error"
        ? "Standort erneut suchen"
        : "Nach Entfernung sortieren";
  const [regionFilterIds, setRegionFilterIds] = useState<Set<number> | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const flatListRef = useRef<FlatList<number>>(null);
  const allPlacesRef = useRef(allPlaces);
  allPlacesRef.current = allPlaces;
  const [bottomSectionHeight, setBottomSectionHeight] = useState(0);
  const [activeRegionName, setActiveRegionName] = useState<string | null>(null);

  // Fetch danych przy pierwszym montowaniu. isPro decyduje o tym, czy przy
  // braku sieci wolno użyć cache offline (funkcja premium). fetchAll ma
  // wewnętrzny guard — ponowne wywołanie po ustaleniu isPro jest bezpieczne.
  useEffect(() => {
    fetchAll(isPro);
  }, [fetchAll, isPro]);

  const categoryFilteredPlaces = useMemo(() => {
    if (selectedCategoryId === null) return allPlaces;
    return allPlaces.filter((p) =>
      p.Kategorie?.some((k) => k.Kategorie_id && k.Kategorie_id.id === selectedCategoryId),
    );
  }, [allPlaces, selectedCategoryId]);

  // Realne miejsca (nie tylko IDs) po wszystkich filtrach — potrzebne dla
  // Alle abspielen (musi mieć obiekty z audio, nie tylko id).
  const displayedPlaces = useMemo(() => {
    let result = [...allPlaces];

    // Filtruj do wybranego regionu (chip)
    if (regionFilterIds !== null) {
      result = result.filter((p) => regionFilterIds.has(p.id));
    }

    if (selectedCategoryId !== null) {
      result = result.filter((p) =>
        p.Kategorie?.some((k) => k.Kategorie_id && k.Kategorie_id.id === selectedCategoryId),
      );
    }

    if (orderedIds) {
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      result.sort((a, b) => (indexMap.get(a.id) ?? 9999) - (indexMap.get(b.id) ?? 9999));
    }

    return result;
  }, [allPlaces, regionFilterIds, selectedCategoryId, orderedIds]);

  const displayedIds = useMemo(() => displayedPlaces.map((p) => p.id), [displayedPlaces]);

  // ── Alle abspielen (Miriam's original vision): playlist z aktualnie
  // filtrowanych wynikow. Filter na piny z audio (playlisty bez audio nie ma sensu).
  const playablePlaces = useMemo(
    () => displayedPlaces.filter((p) => getAudioUrl(p) !== null),
    [displayedPlaces],
  );

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === null) return null;
    return allCategories.find((c) => c.id === selectedCategoryId)?.Name ?? null;
  }, [allCategories, selectedCategoryId]);

  // Label playlistow ktory pokaze sie w playerze (np. "Lindau · Sehenswertes").
  // Priorytet: region + kategoria > region > kategoria > "Aktuelle Auswahl".
  const alleAbspielenLabel = useMemo(() => {
    const parts: string[] = [];
    if (activeRegionName) parts.push(activeRegionName);
    if (selectedCategoryName) parts.push(selectedCategoryName);
    return parts.length > 0 ? parts.join(" · ") : "Aktuelle Auswahl";
  }, [activeRegionName, selectedCategoryName]);

  const startPlaylist = usePlaylistStore((s) => s.startPlaylist);
  const handleAlleAbspielen = useCallback(() => {
    if (playablePlaces.length === 0) return;
    // Zero capa — Miriam prosila o "all matching pins". User zatrzyma
    // playlist gdy zechce. Sehenswertes gating dla free (50% cap) i tak
    // ogranicza liczbe pinow po stronie storu.
    startPlaylist(playablePlaces, { kind: "aktuelle_liste", label: alleAbspielenLabel });
    router.push("/player");
  }, [playablePlaces, alleAbspielenLabel, startPlaylist, router]);

  // Widoczny gdy: sa piny do zagrania + user cos przefiltrowal (nie pokazujemy
  // przy 700 pinach w domysle bo to bez sensu jako "tour").
  const showAlleAbspielenBtn =
    playablePlaces.length > 0 && (activeRegionName !== null || selectedCategoryId !== null);

  const handleLocationSelect = useCallback(
    (
      cityData: {
        name: string;
        region?: Region;
        fromSearch?: boolean;
        lat?: number;
        lon?: number;
      } | null,
    ) => {
      if (!cityData) {
        setActiveRegionName(null);
        setRegionFilterIds(null);
        setOrderedIds(gpsOrderedIdsRef.current);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
        return;
      }

      setActiveRegionName(cityData.name);

      if (cityData.fromSearch) {
        Keyboard.dismiss();
      }

      if (cityData.region) {
        const ids = new Set(placesInRegion(allPlacesRef.current, cityData.region).map((p) => p.id));
        setRegionFilterIds(ids);
        setOrderedIds(null);
      } else if (cityData.fromSearch && cityData.lat && cityData.lon) {
        // user selected a Mapbox suggestion
        setRegionFilterIds(null);
        supabase
          .rpc("nearby_orte", {
            user_lat: cityData.lat,
            user_lng: cityData.lon,
          })
          .then(({ data, error }) => {
            if (!error && data) {
              const ids = (data as { id: number }[]).map((p) => p.id);
              setOrderedIds(ids);
            }
          });
      }

      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    },
    [gpsOrderedIdsRef, setOrderedIds],
  );

  const clearSearch = useCallback(() => {
    setActiveRegionName(null);
    setRegionFilterIds(null);
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      setOrderedIds(gpsOrderedIdsRef.current);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [gpsOrderedIdsRef, setOrderedIds]);

  const renderCard = useCallback(
    ({ item: placeId }: { item: number }) => (
      <View style={[styles.cardWrapperOuter, { width: CARD_STEP }]}>
        <View style={[styles.cardWrapper, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
          <PinCard placeId={placeId} />
        </View>
      </View>
    ),
    [CARD_WIDTH, CARD_HEIGHT, CARD_STEP],
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

      {/* Offline-Hinweis — sichtbar, wenn gespeicherte Daten verwendet werden.
          Identisch zur Karte, damit der Modus auf beiden Screens erkennbar ist. */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Offline-Modus – es werden gespeicherte Daten angezeigt. Fotos und Audioguides sind
            möglicherweise nicht verfügbar.
          </Text>
        </View>
      )}

      {/* Przestrzeń nad kartą — GPS label po lewej, Alle abspielen button po prawej */}
      <View style={styles.aboveCards}>
        {/* Sortiert → Status-Label. Nicht sortiert → Button, der es auslöst.
            Vorher gab es nur das Label: schlug die Ortung fehl oder wurde die
            Berechtigung abgelehnt, hatte der Nutzer keinerlei Möglichkeit,
            die Sortierung nachzuholen. */}
        {orderedIds ? (
          <View style={[styles.gpsLabel, { marginLeft: LIST_HORIZONTAL_PADDING }]}>
            <Text style={styles.gpsLabelText}>Nach Entfernung sortiert</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.gpsSortBtn, { marginLeft: LIST_HORIZONTAL_PADDING }]}
            onPress={handleSortByLocation}
            disabled={gpsStatus === "locating"}
            activeOpacity={0.7}
          >
            {gpsStatus === "locating" ? (
              <>
                <ActivityIndicator size="small" color="#fc6c14" />
                <Text style={styles.gpsSortBtnText}>Standort wird ermittelt …</Text>
              </>
            ) : (
              <>
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Circle cx="12" cy="12" r="9" fill="none" stroke="#fc6c14" strokeWidth={2} />
                  <Circle cx="12" cy="12" r="3.5" fill="#fc6c14" />
                </Svg>
                <Text style={styles.gpsSortBtnText}>{gpsButtonLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {showAlleAbspielenBtn && (
          <TouchableOpacity
            style={styles.alleAbspielenBtn}
            onPress={handleAlleAbspielen}
            activeOpacity={0.85}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Circle cx="12" cy="12" r="12" fill="#fff" />
              <Polygon points="10,7.5 16.5,12 10,16.5" fill="#fc6c14" />
            </Svg>
            <Text style={styles.alleAbspielenText}>Alle abspielen</Text>
          </TouchableOpacity>
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
            ListHeaderComponent={flatListHeader}
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

      {/* Dolna sekcja — wyszukiwarka + kategorie */}
      <View
        style={styles.bottomSection}
        onLayout={(e) => setBottomSectionHeight(e.nativeEvent.layout.height)}
      >
        <SearchSection
          ref={searchRef}
          selectedCategoryId={selectedCategoryId}
          onSelectGeo={(item) => {
            // Pin-Treffer → Detail-Screen (Paywall bei locked, direkt — auch
            // ohne Konto). Geo-Treffer (Stadt) → bisheriges Verhalten:
            // Liste auf nearby sortieren.
            if (item.placeId) {
              const isLocked = usePlacesStore.getState().isLockedPlace(item.placeId, isPro);
              if (isLocked) {
                router.push("/custom-paywall");
                return;
              }
              router.push(`/place/${item.placeId}`);
              return;
            }
            handleLocationSelect({
              name: item.name,
              lat: item.lat,
              lon: item.lon,
              fromSearch: true,
            });
          }}
          onClear={clearSearch}
          bottomSectionHeight={bottomSectionHeight}
        />

        <KategorieBar
          categories={allCategories}
          selectedId={selectedCategoryId}
          onSelect={(id) => {
            setSelectedCategoryId(id);
            requestAnimationFrame(() => {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
            });
          }}
          isPro={isPro}
        />
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
  // Przestrzeń nad kartami — GPS label po lewej, Alle abspielen button po prawej
  aboveCards: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 12,
  },
  // Karty — stała wysokość, nie rozciąga się
  cardsArea: {
    flexShrink: 0,
  },
  // Przestrzeń pod kartami — chips wyśrodkowane pionowo, z gwarantowanym oddechem
  belowCards: {
    flex: 1,
    minHeight: 64,
    justifyContent: "center",
    paddingVertical: 8,
  },
  flatList: {
    flexGrow: 0,
  },
  // Outer: karta + gap po prawej stronie (tworzy odstęp między kartami).
  // Wymiary (width) podawane inline — zależą od szerokości ekranu.
  cardWrapperOuter: {
    paddingRight: CARD_GAP,
  },
  // Wymiary (width/height) podawane inline.
  cardWrapper: {
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
  // GPS sort label — czarne tło, biały tekst.
  // marginLeft podawane inline (musi pasować do paddingu listy).
  gpsLabel: {
    backgroundColor: "#fafafa",
    paddingHorizontal: 10,
    borderRadius: 10,
    paddingVertical: 3,
  },
  gpsLabelText: {
    fontSize: 12,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#fc6c14",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  // Steht an derselben Stelle wie das Label — als Button erkennbar durch
  // Rahmen und Standort-Icon. marginLeft inline (Padding der Liste).
  gpsSortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff5ef",
    borderWidth: 1,
    borderColor: "#fc6c14",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 1,
  },
  gpsSortBtnText: {
    fontSize: 12,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#fc6c14",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  // Alle abspielen — button orange po prawej stronie nad kartami. Widoczny gdy
  // user cos przefiltrowal (miasto lub kategoria) i sa piny z audio.
  alleAbspielenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fc6c14",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginLeft: "auto",
  },
  alleAbspielenText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "FiraSansCondensed_600SemiBold",
    letterSpacing: 0.5,
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
  offlineBanner: {
    backgroundColor: "#fff5ef",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#fcd9c2",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  offlineBannerText: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 12,
    color: "#7a4a22",
    textAlign: "center",
    lineHeight: 16,
  },
});
