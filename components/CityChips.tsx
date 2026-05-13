import React, { useMemo } from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import type { DirectusOrte } from "@/types";

export type Region = {
  label: string;
  name: string;
  land: string; // wartość pola Land w Directus
};

export const REGIONS: Region[] = [
  { label: "Deutschland", name: "Deutschland", land: "Deutschland" },
  { label: "Österreich", name: "Österreich", land: "Österreich" },
  { label: "Schweiz", name: "Schweiz", land: "Schweiz" },
];

export function placesInRegion(places: DirectusOrte[], region: Region): DirectusOrte[] {
  return places.filter((p) => p.Land === region.land);
}

export function CityChips({
  activeRegionName,
  onSelectRegion,
  allPlaces,
  filteredPlaces,
}: {
  activeRegionName: string | null;
  onSelectRegion: (region: Region | null) => void;
  allPlaces: DirectusOrte[];
  filteredPlaces: DirectusOrte[];
}) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const region of REGIONS) {
      map[region.name] = placesInRegion(filteredPlaces, region).length;
    }
    return map;
  }, [filteredPlaces]);

  const visibleRegions = useMemo(
    () => REGIONS.filter((r) => placesInRegion(allPlaces, r).length > 0),
    [allPlaces],
  );

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
              {count > 0 ? ` (${count})` : ""}
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
