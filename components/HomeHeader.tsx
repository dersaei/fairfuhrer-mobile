import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import MenuButton from "./MenuButton";
import type { DirectusEinstellungen } from "@/types";

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";

interface HomeHeaderProps {
  einstellungen: DirectusEinstellungen | null;
}

export default function HomeHeader({ einstellungen }: HomeHeaderProps) {
  return (
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
  );
}

const styles = StyleSheet.create({
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
});
