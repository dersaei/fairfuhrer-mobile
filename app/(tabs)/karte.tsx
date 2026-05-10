import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Keyboard,
  Animated,
  Easing,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import Mapbox, {
  Camera,
  MapView,
  UserLocation,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
} from "@rnmapbox/maps";
import type { ComponentRef } from "react";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import type { DirectusOrte, DirectusKategorie } from "@/types";
import MenuButton from "@/components/MenuButton";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";

Mapbox.setAccessToken(MAPBOX_TOKEN);
Mapbox.setTelemetryEnabled(false);

// ─── Kategorie helpers ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<number, string> = {
  1: "#E45858",
  2: "#6477E3",
  3: "#F0873D",
  5: "#42D742",
  8: "#E0D12E",
};

const DEFAULT_COLOR = "#fc6c14";

// ─── GeoJSON builder ──────────────────────────────────────────────────────────

function placesToGeoJSON(places: DirectusOrte[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: places
      .filter((p) => p.location?.coordinates)
      .map((p) => {
        const catId = p.Kategorie?.[0]?.Kategorie_id?.id ?? null;
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: p.location!.coordinates,
          },
          properties: {
            placeId: p.id,
            categoryColor:
              catId !== null
                ? (CATEGORY_COLORS[catId] ?? DEFAULT_COLOR)
                : DEFAULT_COLOR,
          },
        };
      }),
  };
}

// ─── KategorieBar ─────────────────────────────────────────────────────────────

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
    ? (CATEGORY_COLORS[selectedCat.id] ?? DEFAULT_COLOR)
    : "#000";

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

  // Ikona SVG dla paska kategorii
  const CatIcon = ({
    catId,
    color,
  }: {
    catId: number | null;
    color: string;
  }) => (
    <Svg width={28} height={28} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11" fill={color} />
    </Svg>
  );

  return (
    <View>
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
          <TouchableOpacity
            style={[
              styles.kategorieMenuItem,
              selectedId === null && styles.kategorieMenuItemActive,
            ]}
            onPress={() => closeMenu(null)}
            activeOpacity={0.7}
          >
            <View style={styles.kategorieMenuIcon}>
              <Svg width={36} height={36} viewBox="0 0 24 24">
                <Circle
                  cx="12"
                  cy="12"
                  r="11"
                  fill={selectedId === null ? "#fff" : "#000"}
                />
              </Svg>
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
                  isActive && { backgroundColor: cat.Farbe ?? DEFAULT_COLOR },
                ]}
                onPress={() => closeMenu(cat.id)}
                activeOpacity={0.7}
              >
                <View style={styles.kategorieMenuIcon}>
                  <Svg width={36} height={36} viewBox="0 0 24 24">
                    <Circle
                      cx="12"
                      cy="12"
                      r="11"
                      fill={
                        isActive
                          ? "#fff"
                          : (CATEGORY_COLORS[cat.id] ?? DEFAULT_COLOR)
                      }
                    />
                  </Svg>
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

      <TouchableOpacity
        style={[styles.kategorieBar, { backgroundColor: barColor }]}
        onPress={openMenu}
        activeOpacity={0.85}
      >
        {selectedCat ? (
          <>
            <View style={styles.kategorieBarIcon}>
              <CatIcon catId={selectedCat.id} color={barColor} />
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

const DEFAULT_CENTER: [number, number] = [10.0, 51.0];
const DEFAULT_ZOOM = 5;

export default function KarteScreen() {
  const router = useRouter();
  const {
    places: rawPlaces,
    categories: allCategories,
    einstellungen,
    status,
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

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<
    { name: string; place_formatted: string; lat: number; lon: number }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [bottomSectionHeight, setBottomSectionHeight] = useState(0);
  const [cameraCenter, setCameraCenter] =
    useState<[number, number]>(DEFAULT_CENTER);
  const [cameraZoom, setCameraZoom] = useState(DEFAULT_ZOOM);
  const userLocationRef = useRef<[number, number] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeSourceRef = useRef<ComponentRef<typeof ShapeSource>>(null);
  const cameraRef = useRef<Camera>(null);
  const isFocused = useIsFocused();
  const gpsLocatedRef = useRef(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // GPS tylko gdy tab jest aktywny i dane gotowe — nie przy starcie aplikacji
  useEffect(() => {
    if (status !== "success" || !isFocused || gpsLocatedRef.current) return;
    gpsLocatedRef.current = true;
    (async () => {
      try {
        const { status: locStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (locStatus === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCameraCenter([pos.coords.longitude, pos.coords.latitude]);
          setCameraZoom(10);
        }
      } catch {
        /* zostaje domyślne centrum */
      }
    })();
  }, [status, isFocused]);

  // GeoJSON — przeliczany tylko gdy zmienia się lista lub filtr
  const geoJSON = useMemo(() => {
    const filtered =
      selectedCategoryId === null
        ? allPlaces
        : allPlaces.filter((p) =>
            p.Kategorie?.some((k) => k.Kategorie_id?.id === selectedCategoryId),
          );
    return placesToGeoJSON(filtered);
  }, [allPlaces, selectedCategoryId]);

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
      setCameraCenter([item.lon, item.lat]);
      setCameraZoom(10);
    },
    [],
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setGeoSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const handleMapPress = useCallback(
    async (event: { features: GeoJSON.Feature[] }) => {
      const feature = event.features[0];
      if (!feature?.properties) return;

      const isCluster = feature.properties.cluster === true;

      if (isCluster) {
        // Zoom do poziomu rozwinięcia klastra
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [
          number,
          number,
        ];
        try {
          const zoom =
            await shapeSourceRef.current?.getClusterExpansionZoom(feature);
          if (zoom != null) {
            cameraRef.current?.setCamera({
              centerCoordinate: coords,
              zoomLevel: zoom,
              animationDuration: 500,
              animationMode: "flyTo",
            });
          }
        } catch {
          // fallback — zoom o 2 poziomy
          setCameraCenter(coords);
          setCameraZoom((z) => Math.min(z + 2, 20));
        }
        return;
      }

      // Pojedynczy pin — otwórz szczegóły
      const placeId = feature.properties.placeId as number;
      if (placeId) router.push(`/place/${placeId}`);
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
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

      {/* Mapa */}
      <View style={styles.mapArea}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#fc6c14" />
          </View>
        ) : (
          <MapView
            style={styles.map}
            styleURL={Mapbox.StyleURL.Street}
            localizeLabels={{ locale: "de" }}
            compassEnabled
          >
            <Camera
              ref={cameraRef}
              centerCoordinate={cameraCenter}
              zoomLevel={cameraZoom}
              animationMode="flyTo"
              animationDuration={800}
            />
            <UserLocation
              visible
              showsUserHeadingIndicator
              onUpdate={(loc) => {
                userLocationRef.current = [
                  loc.coords.longitude,
                  loc.coords.latitude,
                ];
              }}
            />

            {/* Jeden source dla wszystkich miejsc — klastry natywnie w GPU */}
            <ShapeSource
              ref={shapeSourceRef}
              id="places"
              shape={geoJSON}
              cluster
              clusterRadius={50}
              clusterMaxZoomLevel={14}
              onPress={handleMapPress}
            >
              {/* Klastry — koła */}
              <CircleLayer
                id="clusters"
                filter={["has", "point_count"]}
                style={{
                  circleColor: [
                    "step",
                    ["get", "point_count"],
                    "#51bbd6",
                    10,
                    "#f1f075",
                    30,
                    "#f28cb1",
                  ],
                  circleRadius: [
                    "step",
                    ["get", "point_count"],
                    20,
                    10,
                    30,
                    30,
                    40,
                  ],
                  circleStrokeWidth: 2,
                  circleStrokeColor: "#fff",
                }}
              />

              {/* Liczba w klastrze */}
              <SymbolLayer
                id="cluster-count"
                filter={["has", "point_count"]}
                style={{
                  textField: ["get", "point_count_abbreviated"],
                  textSize: 20,
                  textColor: "#fff",
                  textFont: ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                  textHaloColor: "#000",
                  textHaloWidth: 0.3,
                }}
              />

              {/* Pojedyncze piny */}
              <CircleLayer
                id="unclustered"
                filter={["!", ["has", "point_count"]]}
                style={{
                  circleColor: ["get", "categoryColor"],
                  circleRadius: 10,
                  circleStrokeWidth: 2,
                  circleStrokeColor: "#fff",
                }}
              />
            </ShapeSource>
          </MapView>
        )}
      </View>

      {/* Przycisk powrotu do lokalizacji */}
      <TouchableOpacity
        style={styles.gpsBtn}
        onPress={() => {
          if (userLocationRef.current) {
            cameraRef.current?.setCamera({
              centerCoordinate: userLocationRef.current,
              zoomLevel: 13,
              animationMode: "flyTo",
              animationDuration: 600,
            });
          }
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.gpsBtnText}>⊕</Text>
      </TouchableOpacity>

      {/* Dolna sekcja — tylko wyszukiwarka */}
      <View
        style={styles.bottomSection}
        onLayout={(e) => setBottomSectionHeight(e.nativeEvent.layout.height)}
      >
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
          {isFetchingSuggestions && (
            <ActivityIndicator
              size="small"
              color="#fff"
              style={{ marginLeft: 8 }}
            />
          )}
          {query.length > 0 && !isFetchingSuggestions && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Pasek kategorii — pod wyszukiwarką */}
        <KategorieBar
          categories={allCategories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
        />
      </View>

      {/* Sugestie — absolute nad bottomSection, poza jego drzewem */}
      {showSuggestions && geoSuggestions.length > 0 && (
        <View style={[styles.suggestionsBox, { bottom: bottomSectionHeight }]}>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
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
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingTop: 8, paddingBottom: 4 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  headerSpacer: { width: 36 },
  headerMenuSlot: { width: 36, alignItems: "flex-end" },
  logoImage: { flex: 1, height: 58 },
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
  mapArea: { flex: 1 },
  map: { flex: 1 },
  bottomSection: { position: "relative", zIndex: 10 },
  searchBar: {
    backgroundColor: "#fc6c14",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 25,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },
  clearBtn: { paddingLeft: 8, paddingVertical: 8 },
  clearBtnText: { fontSize: 18, color: "#fff" },
  suggestionsBox: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderColor: "#000",
    maxHeight: 260,
    zIndex: 100,
    elevation: 10,
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
  kategorieMenuItemActive: { backgroundColor: "#000" },
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
  kategorieMenuTextActive: { color: "#fff" },
  kategorieBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  kategorieBarIcon: { marginRight: 10 },
  kategorieBarText: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#000",
    flex: 1,
  },
  kategorieClearBtn: { paddingLeft: 10 },
  kategorieClearText: { fontSize: 16, color: "#000" },
  gpsBtn: {
    position: "absolute",
    right: 14,
    bottom: 120,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 20,
  },
  gpsBtnText: { fontSize: 26, color: "#fc6c14", lineHeight: 26 },
});
