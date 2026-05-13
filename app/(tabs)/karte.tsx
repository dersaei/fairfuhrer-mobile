import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import { ENTITLEMENT_ID } from "@/lib/revenuecat";
import { LoginPromptModal } from "@/components/LoginPromptModal";
import type { DirectusOrte } from "@/types";
import MenuButton from "@/components/MenuButton";
import { CATEGORY_COLORS } from "@/components/CategoryIcon";
import { KategorieBar } from "@/components/KategorieBar";
import { SearchSection } from "@/components/SearchSection";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";

Mapbox.setAccessToken(MAPBOX_TOKEN);
Mapbox.setTelemetryEnabled(false);

const DEFAULT_COLOR = "#fc6c14";

// ─── GeoJSON builder ──────────────────────────────────────────────────────────

function placesToGeoJSON(
  places: DirectusOrte[],
  lockedIds: Set<number>,
): GeoJSON.FeatureCollection {
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
            locked: lockedIds.has(p.id) ? 1 : 0,
            categoryColor:
              catId !== null ? (CATEGORY_COLORS[catId] ?? DEFAULT_COLOR) : DEFAULT_COLOR,
          },
        };
      }),
  };
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [10.0, 51.0];
const DEFAULT_ZOOM = 5;

export default function KarteScreen() {
  const router = useRouter();
  const {
    categories: allCategories,
    einstellungen,
    status,
    fetchAll,
    getAllPlacesWithLocked,
  } = usePlacesStore();
  const { session, isPro, refreshPro } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  // All Sehenswertes pins shown on map; locked ones open paywall on tap.
  const { places: allPlaces, lockedIds } = useMemo(
    () => getAllPlacesWithLocked(isPro),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAllPlacesWithLocked, isPro, status],
  );
  const isLoading = status === "loading" || status === "idle";

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [bottomSectionHeight, setBottomSectionHeight] = useState(0);
  const [cameraCenter, setCameraCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [cameraZoom, setCameraZoom] = useState(DEFAULT_ZOOM);
  const userLocationRef = useRef<[number, number] | null>(null);
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
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
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
    return placesToGeoJSON(filtered, lockedIds);
  }, [allPlaces, lockedIds, selectedCategoryId]);

  const handleSelectGeo = useCallback((item: { name: string; lat: number; lon: number }) => {
    cameraRef.current?.setCamera({
      centerCoordinate: [item.lon, item.lat],
      zoomLevel: 13,
      animationMode: "flyTo",
      animationDuration: 800,
    });
  }, []);

  const handleMapPress = useCallback(
    async (event: { features: GeoJSON.Feature[] }) => {
      const feature = event.features[0];
      if (!feature?.properties) return;

      const isCluster = feature.properties.cluster === true;

      if (isCluster) {
        // Zoom do poziomu rozwinięcia klastra
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        try {
          const zoom = await shapeSourceRef.current?.getClusterExpansionZoom(feature);
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

      // Pojedynczy pin — locked otwiera paywall, odblokowany otwiera szczegóły
      const placeId = feature.properties.placeId as number;
      const isLocked = feature.properties.locked === 1;
      if (!placeId) return;

      if (isLocked) {
        if (!session) {
          setShowLoginPrompt(true);
          return;
        }
        const result = await RevenueCatUI.presentPaywallIfNeeded({
          requiredEntitlementIdentifier: ENTITLEMENT_ID,
        });
        if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
          await refreshPro();
        }
        return;
      }

      router.push(`/place/${placeId}`);
    },
    [router, session, refreshPro],
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
          <Text style={styles.tagline}>Der Audioguide für nachhaltiges Leben und Reisen</Text>
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
                userLocationRef.current = [loc.coords.longitude, loc.coords.latitude];
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
                  circleRadius: ["step", ["get", "point_count"], 20, 10, 30, 30, 40],
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
        <SearchSection
          onSelectGeo={handleSelectGeo}
          onClear={() => {}}
          bottomSectionHeight={bottomSectionHeight}
        />
        {/* Pasek kategorii — pod wyszukiwarką */}
        <KategorieBar
          categories={allCategories}
          selectedId={selectedCategoryId}
          onSelect={setSelectedCategoryId}
          isPro={isPro}
        />
      </View>

      {/* Sugestie — absolute nad bottomSection, poza jego drzewem */}
      <LoginPromptModal visible={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />
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
  logoImage: { flex: 1, height: 68 },
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
  mapArea: { flex: 1 },
  map: { flex: 1 },
  bottomSection: { position: "relative", zIndex: 10 },
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
