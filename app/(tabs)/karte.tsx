import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from "react-native";
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
import { useRouter } from "expo-router";
import { useTabGpsCenter } from "@/hooks/useTabGpsCenter";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
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

export default function KarteScreen() {
  const router = useRouter();
  const {
    categories: allCategories,
    einstellungen,
    status,
    isOffline,
    fetchAll,
    getAllPlacesWithLocked,
  } = usePlacesStore();
  const { session, isPro } = useAuth();
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
  const { center: cameraCenter, zoom: cameraZoom } = useTabGpsCenter(status === "success");
  const userLocationRef = useRef<[number, number] | null>(null);
  const shapeSourceRef = useRef<ComponentRef<typeof ShapeSource>>(null);
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    fetchAll(isPro);
  }, [fetchAll, isPro]);

  // GPS-Position kommt asynchron. Da die Kamera imperativ ist (defaultSettings
  // greift nur einmal beim Mount), muss die GPS-Position per setCamera
  // nachgereicht werden. useTabGpsCenter liefert center/zoom genau einmal —
  // nach dem ersten Wert ist gpsAppliedRef gesetzt, damit ein späterer
  // Suchergebnis-Sprung nicht überschrieben wird.
  const gpsAppliedRef = useRef(false);
  useEffect(() => {
    if (gpsAppliedRef.current) return;
    if (cameraCenter[0] === 10.0 && cameraCenter[1] === 51.0) return; // Default
    gpsAppliedRef.current = true;
    cameraRef.current?.setCamera({
      centerCoordinate: cameraCenter,
      zoomLevel: cameraZoom,
      animationMode: "flyTo",
      animationDuration: 800,
    });
  }, [cameraCenter, cameraZoom]);

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

  const handleSelectGeo = useCallback(
    (item: { name: string; lat: number; lon: number; isLocalPlace: boolean }) => {
      // Lokaler Ort (Offline-Suche) → nah heranzoomen, da es eine genaue
      // Pin-Position ist. Geografischer Treffer (Stadt/Region) → Stadt-Zoom.
      cameraRef.current?.setCamera({
        centerCoordinate: [item.lon, item.lat],
        zoomLevel: item.isLocalPlace ? 16 : 13,
        animationMode: "flyTo",
        animationDuration: 800,
      });
    },
    [],
  );

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
          cameraRef.current?.setCamera({
            centerCoordinate: coords,
            zoomLevel: Math.min(cameraZoom + 2, 20),
            animationMode: "flyTo",
            animationDuration: 300,
          });
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
        router.push("/custom-paywall");
        return;
      }

      router.push(`/place/${placeId}`);
    },
    [router, session, cameraZoom],
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

      {/* Offline-Hinweis — sichtbar, wenn gespeicherte Daten verwendet werden */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Offline-Modus – es werden gespeicherte Daten angezeigt. Fotos und
            Audioguides sind möglicherweise nicht verfügbar.
          </Text>
        </View>
      )}

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
            {/* Kamera imperatywna: defaultSettings ustawia tylko pozycję
                startową. Wszystkie ruchy (GPS, wybór z wyszukiwarki) idą przez
                cameraRef.setCamera — kontrolowane propsy centerCoordinate/
                zoomLevel ściągałyby widok z powrotem przy re-renderze. */}
            <Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: cameraCenter,
                zoomLevel: cameraZoom,
              }}
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
