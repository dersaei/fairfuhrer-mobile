import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { CategoryIcon, CATEGORY_COLORS } from "./CategoryIcon";
import { getImageUrl, getCategoriesFromPlace } from "@/utils/placeHelpers";
import type { DirectusOrte, DirectusKategorie } from "@/types";

export type LocalResult =
  | {
      type: "place";
      place: DirectusOrte;
    }
  | {
      type: "category";
      cat: DirectusKategorie;
    }
  | {
      type: "geo";
      name: string;
      place_formatted: string;
      lat: number;
      lon: number;
    };

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

interface SearchSectionProps {
  query: string;
  setQuery: (q: string) => void;
  searchFocused: boolean;
  setSearchFocused: (f: boolean) => void;
  geoSuggestions: any[];
  setGeoSuggestions: (s: any[]) => void;
  isFetchingSuggestions: boolean;
  setIsFetchingSuggestions: (f: boolean) => void;
  localResults: any[];
  selectedCategoryIds: Set<number>;
  toggleCategory: (id: number | null) => void;
  allCategories: DirectusKategorie[];
  allPlaces: DirectusOrte[];
  displayedIds: number[];
  handleLocationSelect: (data: any) => void;
  clearSearch: () => void;
  bottomSectionHeight: number;
  setActiveCityLabel: (label: string | null) => void;
}

export function SearchSection({
  query,
  setQuery,
  searchFocused,
  setSearchFocused,
  geoSuggestions,
  setGeoSuggestions,
  isFetchingSuggestions,
  setIsFetchingSuggestions,
  localResults,
  selectedCategoryIds,
  toggleCategory,
  allCategories,
  allPlaces,
  displayedIds,
  handleLocationSelect,
  clearSearch,
  bottomSectionHeight,
  setActiveCityLabel,
}: SearchSectionProps) {
  const router = useRouter();
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGeoSuggestions = React.useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.trim().length < 2) {
        setGeoSuggestions([]);
        setIsFetchingSuggestions(false);
        return;
      }
      setIsFetchingSuggestions(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(text)}&language=de&limit=5&types=country,region,district,place&autocomplete=true&access_token=${MAPBOX_TOKEN}`;
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
        } catch {
          setGeoSuggestions([]);
        } finally {
          setIsFetchingSuggestions(false);
        }
      }, 300);
    },
    [setGeoSuggestions, setIsFetchingSuggestions],
  );

  return (
    <>
      {/* Pasek wyszukiwania */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Text style={[styles.searchIcon, searchFocused && { color: "#181716" }]}>🔍</Text>
          <TextInput
            style={[styles.searchInput, searchFocused && { color: "#181716" }]}
            placeholder="Orte, Städte, Kategorien…"
            placeholderTextColor={searchFocused ? "rgba(24,23,22,0.4)" : "rgba(255,255,255,0.7)"}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              fetchGeoSuggestions(t);
            }}
            onFocus={() => setSearchFocused(true)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (geoSuggestions.length > 0) {
                const s = geoSuggestions[0];
                handleLocationSelect({ name: s.name, lat: s.lat, lon: s.lon, fromSearch: true });
              }
            }}
          />
          {isFetchingSuggestions && (
            <ActivityIndicator
              size="small"
              color={searchFocused ? "#fc6c14" : "#fff"}
              style={{ marginLeft: 8 }}
            />
          )}
          {(query.length > 0 || searchFocused) && !isFetchingSuggestions && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Text style={[styles.clearBtnText, searchFocused && { color: "#888" }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Panel wyszukiwania — pojawia się nad bottomSection gdy searchFocused */}
      {searchFocused && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setSearchFocused(false);
              Keyboard.dismiss();
            }}
          />
          <View style={[styles.suggestionsBox, { bottom: bottomSectionHeight }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              style={styles.suggestionsScroll}
            >
              {query.trim().length < 2 ? (
                /* ── Pusty input: chipy kategorii + popularne miejsca ── */
                <>
                  <Text style={styles.suggestionsHeader}>Kategorien</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipRow}
                    contentContainerStyle={styles.chipRowContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    {allCategories.map((cat) => {
                      const color = CATEGORY_COLORS[cat.id] ?? "#fc6c14";
                      const isActive = selectedCategoryIds.has(cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryChip,
                            { borderColor: color },
                            isActive && { backgroundColor: color },
                          ]}
                          onPress={() => toggleCategory(cat.id)}
                        >
                          <CategoryIcon
                            categoryId={cat.id}
                            color={isActive ? "#fff" : color}
                            size={20}
                          />
                          <Text style={[styles.categoryChipText, isActive && { color: "#fff" }]}>
                            {cat.Name?.split(" ")[0]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={[styles.suggestionsHeader, { marginTop: 8 }]}>
                    Beliebt in deiner Nähe
                  </Text>
                  {displayedIds.slice(0, 5).map((id) => {
                    const place = allPlaces.find((p) => p.id === id);
                    if (!place) return null;
                    const cats = getCategoriesFromPlace(place);
                    const imageUrl = getImageUrl(place);
                    return (
                      <TouchableOpacity
                        key={id}
                        style={styles.suggestionItem}
                        onPress={() => {
                          clearSearch();
                          setActiveCityLabel(null);
                          router.push(`/place/${id}`);
                        }}
                      >
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={styles.suggestionThumb} />
                        ) : (
                          <View style={[styles.suggestionThumb, { backgroundColor: "#f0e8e0" }]} />
                        )}
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.suggestionText} numberOfLines={1}>
                            {place.Name}
                          </Text>
                          <Text style={styles.suggestionSubtext} numberOfLines={1}>
                            {place.Stadt}
                          </Text>
                        </View>
                        {cats[0] && (
                          <CategoryIcon
                            categoryId={cats[0].id}
                            color={CATEGORY_COLORS[cats[0].id] ?? "#fc6c14"}
                            size={28}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : (
                /* ── Jest query: wyniki lokalne + geo ── */
                <>
                  {/* Kategorie */}
                  {localResults.filter((r) => r.type === "category").length > 0 && (
                    <>
                      <Text style={styles.suggestionsHeader}>Kategorien</Text>
                      {localResults
                        .filter(
                          (r): r is { type: "category"; cat: DirectusKategorie } =>
                            r.type === "category",
                        )
                        .map((r) => {
                          const color = CATEGORY_COLORS[r.cat.id] ?? "#fc6c14";
                          return (
                            <TouchableOpacity
                              key={r.cat.id}
                              style={[
                                styles.suggestionItem,
                                selectedCategoryIds.has(r.cat.id) && {
                                  backgroundColor: (CATEGORY_COLORS[r.cat.id] ?? "#fc6c14") + "18",
                                },
                              ]}
                              onPress={() => toggleCategory(r.cat.id)}
                            >
                              <View style={styles.suggestionCatIcon}>
                                <CategoryIcon categoryId={r.cat.id} color={color} size={32} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.suggestionText}>{r.cat.Name}</Text>
                                <Text style={styles.suggestionSubtext}>
                                  {selectedCategoryIds.has(r.cat.id) ? "✓" : "Kategorie"}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                    </>
                  )}

                  {/* Audiopins (formerly Orte) */}
                  {localResults.filter((r) => r.type === "place").length > 0 && (
                    <>
                      <Text style={styles.suggestionsHeader}>Audiopin</Text>
                      {localResults
                        .filter(
                          (r): r is { type: "place"; place: DirectusOrte } => r.type === "place",
                        )
                        .map((r) => {
                          const cats = getCategoriesFromPlace(r.place);
                          const imageUrl = getImageUrl(r.place);
                          return (
                            <TouchableOpacity
                              key={r.place.id}
                              style={styles.suggestionItem}
                              onPress={() => {
                                clearSearch();
                                setActiveCityLabel(null);
                                router.push(`/place/${r.place.id}`);
                              }}
                            >
                              {imageUrl ? (
                                <Image source={{ uri: imageUrl }} style={styles.suggestionThumb} />
                              ) : (
                                <View
                                  style={[styles.suggestionThumb, { backgroundColor: "#f0e8e0" }]}
                                />
                              )}
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.suggestionText} numberOfLines={1}>
                                  {r.place.Name}
                                </Text>
                                <Text style={styles.suggestionSubtext} numberOfLines={1}>
                                  {r.place.Stadt}
                                </Text>
                              </View>
                              {cats[0] && (
                                <CategoryIcon
                                  categoryId={cats[0].id}
                                  color={CATEGORY_COLORS[cats[0].id] ?? "#fc6c14"}
                                  size={28}
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </>
                  )}

                  {/* Geo (Mapbox) */}
                  {geoSuggestions.length > 0 && (
                    <>
                      <Text style={styles.suggestionsHeader}>Städte</Text>
                      {geoSuggestions.map((s, i) => (
                        <TouchableOpacity
                          key={`geo-${i}`}
                          style={styles.suggestionItem}
                          onPress={() => {
                            handleLocationSelect({
                              name: s.name,
                              lat: s.lat,
                              lon: s.lon,
                              fromSearch: true,
                            });
                          }}
                        >
                          <View
                            style={[
                              styles.suggestionCatIcon,
                              { backgroundColor: "#f0e8e0", borderRadius: 8 },
                            ]}
                          >
                            <Text style={{ fontSize: 16 }}>📍</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.suggestionText}>{s.name}</Text>
                            <Text style={styles.suggestionSubtext} numberOfLines={1}>
                              {s.place_formatted}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </>
                  )}

                  {localResults.length === 0 &&
                    geoSuggestions.length === 0 &&
                    !isFetchingSuggestions && (
                      <View style={{ padding: 40, alignItems: "center" }}>
                        <Text style={styles.noResultsText}>
                          Keine Ergebnisse für &quot;{query}&quot;
                        </Text>
                      </View>
                    )}
                </>
              )}
            </ScrollView>
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  searchBarContainer: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  searchBoxFocused: {
    backgroundColor: "#fff",
    borderColor: "#fc6c14",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
    color: "#fff",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#fff",
    fontFamily: "FiraSansCondensed_400Regular",
    height: "100%",
  },
  clearBtn: {
    padding: 8,
  },
  clearBtnText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
  },
  suggestionsBox: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: "#fff",
    zIndex: 5,
  },
  suggestionsScroll: {
    flex: 1,
  },
  suggestionsHeader: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#999",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  suggestionThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  suggestionCatIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  suggestionText: {
    fontSize: 17,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#181716",
  },
  suggestionSubtext: {
    fontSize: 14,
    color: "#777",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  chipRow: {
    maxHeight: 50,
  },
  chipRowContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#181716",
  },
  noResultsText: {
    fontSize: 16,
    color: "#999",
    fontFamily: "FiraSansCondensed_400Regular",
  },
});
