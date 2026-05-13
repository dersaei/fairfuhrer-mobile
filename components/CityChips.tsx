import React, { useEffect, useState } from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { supabase } from "@/lib/supabase";

export type Region = {
  label: string;
  name: string; // klucz dla RPC (angielski bez znaków diakr.)
  centerLat: number;
  centerLon: number;
};

export const REGIONS: Region[] = [
  { label: "Bodensee", name: "Bodensee", centerLat: 47.66, centerLon: 9.18 },
  { label: "Allgäu", name: "Allgäu", centerLat: 47.52, centerLon: 10.19 },
  { label: "Ostschweiz", name: "Ostschweiz", centerLat: 47.42, centerLon: 9.37 },
  { label: "Vorarlberg", name: "Vorarlberg", centerLat: 47.24, centerLon: 9.74 },
  { label: "Oberschwaben", name: "Oberschwaben", centerLat: 47.98, centerLon: 10.18 },
  { label: "Ostallgäu", name: "Ostallgäu", centerLat: 47.77, centerLon: 10.62 },
];

export function CityChips({
  activeRegionName,
  onSelectRegion,
}: {
  activeRegionName: string | null;
  onSelectRegion: (region: Region | null) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.rpc("region_audio_counts").then(({ data }) => {
      if (!data) return;
      const map: Record<string, number> = {};
      (data as { region: string; pin_count: number }[]).forEach((row) => {
        map[row.region] = row.pin_count;
      });
      setCounts(map);
    });
  }, []);

  // Wyświetlaj tylko regiony które mają przynajmniej 1 pin
  const visibleRegions = REGIONS.filter((r) => (counts[r.name] ?? 0) > 0);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipRow}
      contentContainerStyle={styles.chipRowContent}
    >
      {visibleRegions.map((region) => {
        const isActive = activeRegionName === region.name;
        const count = counts[region.name];
        return (
          <TouchableOpacity
            key={region.name}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => onSelectRegion(isActive ? null : region)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {region.label}
              {count ? ` (${count})` : ""}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    maxHeight: 40,
  },
  chipRowContent: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#fc6c14",
  },
  chipActive: {
    backgroundColor: "#181716",
    borderColor: "#181716",
  },
  chipText: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#181716",
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: "#fc6c14",
  },
});
