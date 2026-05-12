import React, { memo, useCallback } from "react";
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { usePlacesStore } from "@/stores/placesStore";
import { CategoryIcon } from "./CategoryIcon";
import { getImageUrl, getCategoriesFromPlace } from "@/utils/placeHelpers";

export const PinCard = memo(function PinCard({ placeId }: { placeId: number }) {
  const router = useRouter();
  const place = usePlacesStore((s) => s.getPlaceById(placeId));
  const imageUrl = place ? getImageUrl(place) : null;
  const categories = place ? getCategoriesFromPlace(place) : [];
  const handlePress = useCallback(() => router.push(`/place/${placeId}`), [router, placeId]);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.95} onPress={handlePress}>
      <ImageBackground
        source={imageUrl ? { uri: imageUrl } : undefined}
        style={styles.cardImage}
        resizeMode="cover"
      >
        <LinearGradient colors={["rgba(0,0,0,0.5)", "transparent"]} style={styles.gradientTop} />
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
            {place?.Name}
          </Text>
          <Text style={styles.cardLocation} numberOfLines={1}>
            {[place?.Stadt, place?.Land].filter(Boolean).join(", ")}
          </Text>
        </View>
      </ImageBackground>
    </TouchableOpacity>
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
});
