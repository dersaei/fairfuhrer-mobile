import React, { memo, useCallback, useState } from "react";
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";
import { ENTITLEMENT_ID } from "@/lib/revenuecat";
import { CategoryIcon } from "./CategoryIcon";
import { getImageUrl, getCategoriesFromPlace } from "@/utils/placeHelpers";
import { LoginPromptModal } from "./LoginPromptModal";

function LockIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
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
  const { session, isPro, refreshPro } = useAuth();
  const place = usePlacesStore((s) => s.getPlaceById(placeId));
  const isLocked = usePlacesStore((s) => s.isLockedPlace(placeId, isPro));
  const imageUrl = place ? getImageUrl(place) : null;
  const categories = place ? getCategoriesFromPlace(place) : [];
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const handlePress = useCallback(async () => {
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
  }, [isLocked, session, placeId, router, refreshPro]);

  return (
    <>
    <LoginPromptModal
      visible={showLoginPrompt}
      onClose={() => setShowLoginPrompt(false)}
    />
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
            <View style={styles.lockBadge}>
              <LockIcon />
              <Text style={styles.lockLabel}>Fairführer+</Text>
            </View>
          </View>
        )}
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
            {place?.Name}
          </Text>
          <Text style={styles.cardLocation} numberOfLines={1}>
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
  cardLocation: {
    fontSize: 20,
    color: "#fff",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 2,
    marginBottom: 4,
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  lockBadge: {
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
  },
  lockLabel: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 18,
    color: "#fff",
    letterSpacing: 1.5,
  },
});
