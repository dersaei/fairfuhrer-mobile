import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { usePlacesStore } from "@/stores/placesStore";
import type { DirectusOrte } from "@/types";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Offline-Fallback ────────────────────────────────────────────────────────
// Wenn die Mapbox-Geocoding-API nicht erreichbar ist (kein Internet), durchsucht
// die Suche stattdessen die lokal vorhandenen Orte aus dem placesStore. So
// funktioniert die Suche auch mit heruntergeladener Offline-Karte.

// Eine Suchvorschlag-Zeile. `isLocalPlace` unterscheidet einen konkreten Ort
// (Offline-Fallback) von einem geografischen Treffer der Mapbox-API (Stadt /
// Region). Davon hängt die Zoom-Stufe beim Auswählen ab.
export interface Suggestion {
  name: string;
  place_formatted: string;
  lat: number;
  lon: number;
  isLocalPlace: boolean;
}

function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .trim();
}

function searchLocalPlaces(text: string, places: DirectusOrte[]): Suggestion[] {
  const q = normalizeSearch(text);
  if (!q) return [];
  return places
    .filter((p) => {
      if (!p.location?.coordinates) return false;
      const haystack = normalizeSearch(
        `${p.Name ?? ""} ${p.Stadt ?? ""} ${p.Adresse ?? ""}`,
      );
      return haystack.includes(q);
    })
    .slice(0, 7)
    .map((p) => ({
      name: p.Name ?? "",
      place_formatted: [p.Stadt, p.Land].filter(Boolean).join(", "),
      lat: p.location!.coordinates[1],
      lon: p.location!.coordinates[0],
      isLocalPlace: true,
    }));
}

interface SearchSectionProps {
  onSelectGeo: (item: {
    name: string;
    lat: number;
    lon: number;
    isLocalPlace: boolean;
  }) => void;
  onClear: () => void;
  bottomSectionHeight: number;
}

export function SearchSection({ onSelectGeo, onClear, bottomSectionHeight }: SearchSectionProps) {
  const [query, setQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(
          text,
        )}&language=de&limit=7&types=country,region,district,place&autocomplete=true&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const json = await res.json();
        const suggestions: Suggestion[] = (json.features ?? []).map(
          (f: Record<string, unknown>) => {
            const props = f.properties as Record<string, unknown>;
            const geom = f.geometry as { coordinates: [number, number] };
            return {
              name: props.name as string,
              place_formatted: (props.place_formatted ?? "") as string,
              lat: geom.coordinates[1],
              lon: geom.coordinates[0],
              isLocalPlace: false,
            };
          },
        );
        setGeoSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch {
        // Kein Internet → Offline-Fallback: lokale Orte durchsuchen.
        const local = searchLocalPlaces(text, usePlacesStore.getState().places);
        setGeoSuggestions(local);
        setShowSuggestions(local.length > 0);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300);
  }, []);

  const handleSelect = (item: Suggestion) => {
    setQuery(item.name);
    setShowSuggestions(false);
    setGeoSuggestions([]);
    Keyboard.dismiss();
    onSelectGeo(item);
  };

  const handleClear = () => {
    setQuery("");
    setGeoSuggestions([]);
    setShowSuggestions(false);
    onClear();
  };

  return (
    <>
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
            if (query.length >= 2 && geoSuggestions.length > 0) setShowSuggestions(true);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (geoSuggestions.length > 0) handleSelect(geoSuggestions[0]);
            else setShowSuggestions(false);
          }}
        />
        {isFetchingSuggestions && (
          <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 8 }} />
        )}
        {query.length > 0 && !isFetchingSuggestions && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && geoSuggestions.length > 0 && (
        <View style={[styles.suggestionsBox, { bottom: bottomSectionHeight }]}>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            {geoSuggestions.map((s, i) => (
              <TouchableOpacity
                key={`${s.name}-${i}`}
                style={styles.suggestionItem}
                onPress={() => handleSelect(s)}
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
    </>
  );
}

const styles = StyleSheet.create({
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
});
