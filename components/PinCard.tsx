import React, { memo, useCallback } from "react";
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import { CategoryIcon, CATEGORY_COLORS } from "./CategoryIcon";
import { getImageUrl, getCategoriesFromPlace } from "@/utils/placeHelpers";

const DEFAULT_LOCK_COLOR = "#fc6c14";

function LockIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={16} r={1.5} fill="#fff" />
    </Svg>
  );
}

export const PinCard = memo(function PinCard({ placeId }: { placeId: number }) {
  const router = useRouter();
  const { isPro } = useAuth();
  const place = usePlacesStore((s) => s.getPlaceById(placeId));
  const isLocked = usePlacesStore((s) => s.isLockedPlace(placeId, isPro));
  const imageUrl = place ? getImageUrl(place) : null;
  const categories = place ? getCategoriesFromPlace(place) : [];

  const handlePress = useCallback(async () => {
    if (isLocked) {
      // Direkt zum Paywall — auch ohne Konto. Login wird erst nach
      // Plan-Auswahl im Paywall verlangt.
      router.push("/custom-paywall");
      return;
    }
    router.push(`/place/${placeId}`);
  }, [isLocked, placeId, router]);

  return (
    <>
      <TouchableOpacity style={styles.card} activeOpacity={0.95} onPress={handlePress}>
        <ImageBackground
          source={imageUrl ? { uri: imageUrl } : undefined}
          style={styles.cardImage}
          resizeMode="cover"
          blurRadius={isLocked ? 8 : 0}
        >
          <LinearGradient colors={["rgba(0,0,0,0.5)", "transparent"]} style={styles.gradientTop} />
          <LinearGradient
            colors={["transparent", "rgb(252, 108, 20, 0.6)"]}
            style={styles.gradientBottom}
          />
          {isLocked && (
            <View style={styles.lockOverlay}>
              <View
                style={[
                  styles.lockBadge,
                  {
                    backgroundColor:
                      (categories[0] &&
                        (categories[0].Farbe ?? CATEGORY_COLORS[categories[0].id])) ||
                      DEFAULT_LOCK_COLOR,
                  },
                ]}
              >
                {categories[0] && (
                  <View style={styles.lockCategoryRow}>
                    <CategoryIcon
                      categoryId={categories[0].id}
                      color="#fff"
                      strokeColor={
                        (categories[0].Farbe ?? CATEGORY_COLORS[categories[0].id]) ||
                        DEFAULT_LOCK_COLOR
                      }
                      size={36}
                    />
                  </View>
                )}
                <LockIcon />
                <Text style={styles.lockLabel}>FAIRFÜHRER+</Text>
                <Text style={styles.lockHint}>Tippe zum Freischalten</Text>
              </View>
            </View>
          )}
          <View style={styles.cardBottom}>
            {!isLocked && (
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
            )}
            <Text
              style={[styles.cardName, isLocked && styles.cardNameLocked]}
              numberOfLines={isLocked ? 1 : 3}
            >
              {place?.Name}
            </Text>
            <Text
              style={[styles.cardLocation, isLocked && styles.cardLocationLocked]}
              numberOfLines={1}
            >
              {[place?.Stadt, place?.Land].filter(Boolean).join(", ")}
            </Text>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    </>
  );
});

const styles = StyleSheet.create({
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
  // Gesperrte Karten: Name + Location werden visuell zurückgenommen, damit
  // das Schloss + FAIRFÜHRER+ Badge die Aufmerksamkeit bekommen.
  cardNameLocked: {
    fontSize: 16,
    opacity: 0.75,
  },
  cardLocation: {
    fontSize: 20,
    color: "#fff",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 2,
    marginBottom: 4,
  },
  cardLocationLocked: {
    fontSize: 13,
    opacity: 0.65,
    marginTop: 0,
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    // Dunklerer Overlay (vorher 0.35) — der Hintergrund-Inhalt soll deutlich
    // zurücktreten, damit Schloss + Label sofort lesbar sind.
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  lockBadge: {
    alignItems: "center",
    gap: 8,
    // Hintergrundfarbe wird inline gesetzt — abhängig von der Kategorie
    // des Pins, damit der Nutzer sofort sieht, um welche Kategorie es geht.
    // Fallback auf Brand-Orange.
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    // Schatten für mehr "Pop"
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  // Kategorie-Icon oben in der Plakette — weißes Icon mit Hintergrund-
  // Stroke in der Kategoriefarbe, sodass die Form der Ikone gut lesbar bleibt.
  lockCategoryRow: {
    marginBottom: 2,
  },
  lockLabel: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 22,
    color: "#fff",
    letterSpacing: 1.5,
  },
  lockHint: {
    fontFamily: "FiraSansCondensed_500Medium",
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: 0.5,
    marginTop: -2,
  },
});
