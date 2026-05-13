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

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

interface SearchSectionProps {
  onSelectGeo: (item: { name: string; lat: number; lon: number }) => void;
  onClear: () => void;
  bottomSectionHeight: number;
}

export function SearchSection({ onSelectGeo, onClear, bottomSectionHeight }: SearchSectionProps) {
  const [query, setQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<
    { name: string; place_formatted: string; lat: number; lon: number }[]
  >([]);
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
        const suggestions = (json.features ?? []).map((f: Record<string, unknown>) => {
          const props = f.properties as Record<string, unknown>;
          const geom = f.geometry as { coordinates: [number, number] };
          return {
            name: props.name as string,
            place_formatted: (props.place_formatted ?? "") as string,
            lat: geom.coordinates[1],
            lon: geom.coordinates[0],
          };
        });
        setGeoSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch {
        setGeoSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    }, 300);
  }, []);

  const handleSelect = (item: {
    name: string;
    place_formatted: string;
    lat: number;
    lon: number;
  }) => {
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
