import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { usePlacesStore } from "@/stores/placesStore";
import type { DirectusOrte } from "@/types";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

// Suche durchsucht parallel Pins (lokal aus placesStore) UND Städte/Regionen
// (Mapbox-API). Pin-Treffer landen zuerst in der Liste, dann geografische
// Treffer. Bei Offline werden nur lokale Pins angezeigt.

// `placeId` ist gesetzt, wenn das Suggestion ein konkreter Pin ist — der
// Parent (karte.tsx / index.tsx) entscheidet dann, ob er das Detail-Screen
// öffnet oder nur die Karte zoomt. `isLocalPlace` bleibt für die Zoom-Stufe.
export interface Suggestion {
  name: string;
  place_formatted: string;
  lat: number;
  lon: number;
  isLocalPlace: boolean;
  placeId?: number;
}

export interface SearchSectionHandle {
  clear: () => void;
  // Zamyka tylko dropdown z sugestiami, ale ZACHOWUJE tekst wpisany w polu.
  // Uzywane przy powrocie na tab z innego ekranu — user widzi ze wybor
  // (np. "Lindau") jest nadal aktywny, ale nie widzi wiszacego dropdownu.
  hideSuggestions: () => void;
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

function searchLocalPlaces(
  text: string,
  places: DirectusOrte[],
  selectedCategoryId: number | null,
): Suggestion[] {
  const q = normalizeSearch(text);
  if (!q) return [];
  return places
    .filter((p) => {
      if (!p.location?.coordinates) return false;
      if (selectedCategoryId !== null) {
        const matchesCategory = p.Kategorie?.some((k) => k.Kategorie_id?.id === selectedCategoryId);
        if (!matchesCategory) return false;
      }
      const haystack = normalizeSearch(`${p.Name ?? ""} ${p.Stadt ?? ""} ${p.Adresse ?? ""}`);
      return haystack.includes(q);
    })
    .map((p) => ({
      name: p.Name ?? "",
      place_formatted: [p.Stadt, p.Land].filter(Boolean).join(", "),
      lat: p.location!.coordinates[1],
      lon: p.location!.coordinates[0],
      isLocalPlace: true,
      placeId: p.id,
    }));
}

interface SearchSectionProps {
  onSelectGeo: (item: {
    name: string;
    lat: number;
    lon: number;
    isLocalPlace: boolean;
    placeId?: number;
  }) => void;
  onClear: () => void;
  bottomSectionHeight: number;
  selectedCategoryId?: number | null;
}

export const SearchSection = forwardRef<SearchSectionHandle, SearchSectionProps>(
  function SearchSection(
    { onSelectGeo, onClear, bottomSectionHeight, selectedCategoryId = null }: SearchSectionProps,
    ref,
  ) {
    const [query, setQuery] = useState("");
    const [geoSuggestions, setGeoSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Aktuelle Kategorie als Ref — verhindert stale closures in setTimeout,
    // wenn die Kategorie sich nach Tastenanschlag aber vor dem Fetch ändert.
    const categoryRef = useRef<number | null>(selectedCategoryId);
    useEffect(() => {
      categoryRef.current = selectedCategoryId;
    }, [selectedCategoryId]);

    // Eltern-Komponente (karte.tsx, index.tsx) kann das Search-Feld zurück-
    // setzen — etwa nachdem ein Pin-Detail oder Paywall geschlossen wurde.
    useImperativeHandle(ref, () => ({
      clear: () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setQuery("");
        setGeoSuggestions([]);
        setShowSuggestions(false);
        setIsFetchingSuggestions(false);
        Keyboard.dismiss();
      },
      hideSuggestions: () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setGeoSuggestions([]);
        setShowSuggestions(false);
        setIsFetchingSuggestions(false);
        Keyboard.dismiss();
        // Zachowujemy `query` — user widzi ze wybor jest aktywny.
      },
    }));

    const runSearch = (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.trim().length < 2) {
        setGeoSuggestions([]);
        setShowSuggestions(false);
        setIsFetchingSuggestions(false);
        return;
      }
      setIsFetchingSuggestions(true);
      debounceRef.current = setTimeout(async () => {
        // categoryRef immer aktuell lesen — stale-closure-sicher.
        const currentCategory = categoryRef.current;
        const localPins = searchLocalPlaces(
          text,
          usePlacesStore.getState().places,
          currentCategory,
        );

        let geoPlaces: Suggestion[] = [];
        try {
          const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(
            text,
          )}&language=de&limit=5&types=country,region,district,place&autocomplete=true&access_token=${MAPBOX_TOKEN}`;
          const res = await fetch(url);
          const json = await res.json();
          geoPlaces = (json.features ?? []).map((f: Record<string, unknown>) => {
            const props = f.properties as Record<string, unknown>;
            const geom = f.geometry as { coordinates: [number, number] };
            return {
              name: props.name as string,
              place_formatted: (props.place_formatted ?? "") as string,
              lat: geom.coordinates[1],
              lon: geom.coordinates[0],
              isLocalPlace: false,
            };
          });
        } catch {
          // Kein Internet → nur lokale Pins.
        }

        const combined = [...localPins, ...geoPlaces];
        setGeoSuggestions(combined);
        setShowSuggestions(combined.length > 0);
        setIsFetchingSuggestions(false);
      }, 300);
    };

    // Wenn der Nutzer die Kategorie wechselt, während der Such-Query bereits
    // gesetzt ist — sofort neu suchen, damit die Liste die neue Kategorie
    // widerspiegelt.
    useEffect(() => {
      if (query.trim().length >= 2) {
        runSearch(query);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategoryId]);

    const handleSelect = (item: Suggestion) => {
      setQuery(item.name);
      setShowSuggestions(false);
      setGeoSuggestions([]);
      Keyboard.dismiss();
      onSelectGeo({
        name: item.name,
        lat: item.lat,
        lon: item.lon,
        isLocalPlace: item.isLocalPlace,
        placeId: item.placeId,
      });
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
            // Voll deckendes Weiß auf dem orangenen Balken — wie auf der
            // Website. Vorher 70 % Deckkraft, was auf #fc6c14 ausgewaschen wirkte.
            placeholderTextColor="#fff"
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              runSearch(t);
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
          // ScrollView aus react-native-gesture-handler — fängt vertikalen
          // Drag zuverlässig ab, auch wenn darunter eine native Mapbox-MapView
          // liegt. Der Standard-RN-ScrollView verliert hier das Gesten-Battle.
          <View style={[styles.suggestionsBox, { bottom: bottomSectionHeight }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator
            >
              {geoSuggestions.map((s) => (
                <TouchableOpacity
                  key={s.placeId !== undefined ? `pin-${s.placeId}` : `geo-${s.lat}-${s.lon}`}
                  style={styles.suggestionItem}
                  onPress={() => handleSelect(s)}
                  activeOpacity={0.7}
                >
                  <View style={styles.suggestionRow}>
                    <View
                      style={[
                        styles.suggestionBadge,
                        s.placeId !== undefined
                          ? styles.suggestionBadgePin
                          : styles.suggestionBadgeGeo,
                      ]}
                    >
                      <Text style={styles.suggestionBadgeText}>
                        {s.placeId !== undefined ? "Pin" : "Ort"}
                      </Text>
                    </View>
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </View>
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
  },
);

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
    maxHeight: 420,
    zIndex: 100,
    elevation: 10,
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 32,
    alignItems: "center",
  },
  suggestionBadgePin: {
    backgroundColor: "#fc6c14",
  },
  suggestionBadgeGeo: {
    backgroundColor: "#888",
  },
  suggestionBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  suggestionText: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  suggestionSubtext: {
    fontSize: 12,
    color: "#555",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 1,
    marginLeft: 40,
  },
});
