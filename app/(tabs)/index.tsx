import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { readItems } from "@directus/sdk";
import { supabase } from "@/lib/supabase";
import { directus } from "@/lib/directus";
import type { DirectusOrte, DirectusKategorie } from "@/types";

const DIRECTUS_URL = process.env.EXPO_PUBLIC_DIRECTUS_URL ?? "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

function getImageUrl(place: DirectusOrte): string | null {
  if (place.Titelbild) return `${DIRECTUS_URL}/assets/${place.Titelbild}`;
  if (place.Hauptbild)
    return `${SUPABASE_URL}/storage/v1/object/public/media-files/places/images/main/${place.Hauptbild}`;
  return null;
}

function getCategoriesFromPlace(place: DirectusOrte): DirectusKategorie[] {
  if (!place.Kategorie) return [];
  return place.Kategorie.map((k) => k.Kategorie_id).filter(
    Boolean,
  ) as DirectusKategorie[];
}

// ─── PinCard ────────────────────────────────────────────────────────────────

function PinCard({ place }: { place: DirectusOrte }) {
  const imageUrl = getImageUrl(place);
  const categories = getCategoriesFromPlace(place);

  return (
    <View style={styles.card}>
      <ImageBackground
        source={imageUrl ? { uri: imageUrl } : undefined}
        style={styles.cardImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          style={styles.gradientTop}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.5)"]}
          style={styles.gradientBottom}
        />
        <View style={styles.cardTopRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chipScrollContent}
          >
            {categories.map((cat) => (
              <View
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: cat.Farbe ?? "#666" },
                ]}
              >
                <Text style={styles.categoryChipText}>{cat.Name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.cardName} numberOfLines={2}>
            {place.Name}
          </Text>
          <Text style={styles.cardLocation} numberOfLines={1}>
            {[place.Stadt, place.Land].filter(Boolean).join(", ")}
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}

// ─── KategorieModal ──────────────────────────────────────────────────────────

function KategorieModal({
  visible,
  categories,
  selectedIds,
  onToggle,
  onClose,
}: {
  visible: boolean;
  categories: DirectusKategorie[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClose: () => void;
}) {
  const allSelected = selectedIds.length === 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <Text style={styles.modalTitle}>Kategorie</Text>

        <FlatList
          data={categories}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const isSelected = allSelected || selectedIds.includes(item.id);
            return (
              <TouchableOpacity
                style={styles.modalRow}
                onPress={() => onToggle(item.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.modalBullet,
                    { backgroundColor: item.Farbe ?? "#000" },
                  ]}
                />
                <Text style={styles.modalCategoryName}>{item.Name}</Text>
                {isSelected && <Text style={styles.modalCheck}>✓</Text>}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
          contentContainerStyle={{ paddingBottom: 8 }}
        />

        <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
          <Text style={styles.modalCloseBtnText}>Fertig</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ListeScreen() {
  const [allPlaces, setAllPlaces] = useState<DirectusOrte[]>([]);
  const [allCategories, setAllCategories] = useState<DirectusKategorie[]>([]);
  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [searchLayout, setSearchLayout] = useState<{ top: number; left: number; width: number } | null>(null);
  const searchRowRef = useRef<View>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const [places, categories] = await Promise.all([
          directus.request(
            readItems("Orte" as never, {
              fields: [
                "id",
                "Name",
                "Adresse",
                "Stadt",
                "Land",
                "location",
                "Hauptbild",
                "Titelbild",
                "Kategorie.Kategorie_id.id",
                "Kategorie.Kategorie_id.Name",
                "Kategorie.Kategorie_id.Farbe",
                "Bearbeitungsstatus",
              ] as never[],
              limit: -1,
            }),
          ),
          directus.request(
            readItems("Kategorie" as never, {
              fields: ["id", "Name", "Farbe", "Reihenfolge"] as never[],
              sort: ["Reihenfolge"] as never[],
              limit: -1,
            }),
          ),
        ]);

        if (!mounted) return;
        setAllPlaces(places as unknown as DirectusOrte[]);
        setAllCategories(categories as unknown as DirectusKategorie[]);
      } catch {
        if (mounted) setError("Daten konnten nicht geladen werden.");
      }

      // Location + PostGIS sorting
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted" && mounted) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const { latitude: lat, longitude: lng } = pos.coords;
          const { data } = await supabase.rpc("nearby_orte", {
            user_lat: lat,
            user_lng: lng,
          });
          if (data && mounted) {
            setOrderedIds((data as { id: number }[]).map((r) => r.id));
          }
        }
      } catch {
        // Location unavailable — display without distance sorting
      }

      if (mounted) setIsLoading(false);
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  const suggestions = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    const seen = new Set<string>();
    const results: string[] = [];
    for (const p of allPlaces) {
      for (const val of [p.Stadt, p.Land]) {
        if (val && val.toLowerCase().includes(q) && !seen.has(val)) {
          seen.add(val);
          results.push(val);
        }
      }
      if (results.length >= 8) break;
    }
    return results;
  }, [query, allPlaces]);

  const displayedPlaces = useMemo(() => {
    let result = [...allPlaces];

    if (selectedCategoryIds.length > 0) {
      result = result.filter((p) =>
        p.Kategorie?.some(
          (k) =>
            k.Kategorie_id && selectedCategoryIds.includes(k.Kategorie_id.id),
        ),
      );
    }

    if (activeFilter) {
      const f = activeFilter.toLowerCase();
      result = result.filter(
        (p) =>
          p.Stadt?.toLowerCase().includes(f) ||
          p.Land?.toLowerCase().includes(f),
      );
    }

    if (orderedIds) {
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      result.sort(
        (a, b) => (indexMap.get(a.id) ?? 9999) - (indexMap.get(b.id) ?? 9999),
      );
    }

    return result;
  }, [allPlaces, selectedCategoryIds, activeFilter, orderedIds]);

  const selectSuggestion = useCallback((val: string) => {
    setQuery(val);
    setActiveFilter(val);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }, []);

  const clearFilter = useCallback(() => {
    setQuery("");
    setActiveFilter(null);
    setShowSuggestions(false);
  }, []);

  const toggleCategory = useCallback((id: number) => {
    setSelectedCategoryIds((prev) => {
      if (prev.length === 0) return [id];
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }, []);

  const selectedCategoryLabels = useMemo(() => {
    if (selectedCategoryIds.length === 0) return null;
    return allCategories.filter((c) => selectedCategoryIds.includes(c.id));
  }, [selectedCategoryIds, allCategories]);

  const renderPin = useCallback(
    ({ item }: { item: DirectusOrte }) => <PinCard place={item} />,
    [],
  );

  const ListHeader = (
    <View style={styles.listHeader}>
      <Text style={styles.logo}>FAIRFÜHRER</Text>
      <Text style={styles.tagline}>
        Der Audioguide für nachhaltiges Leben und Reisen
      </Text>

      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <View
            ref={searchRowRef}
            style={styles.searchRow}
            onLayout={() => {
              searchRowRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
                setSearchLayout({ top: pageY + height, left: pageX, width });
              });
            }}
          >
            <TextInput
              style={styles.searchInput}
              placeholder="Ort, Region oder Land suchen…"
              placeholderTextColor="#000"
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                setShowSuggestions(true);
                if (!t) setActiveFilter(null);
              }}
              onFocus={() => setShowSuggestions(true)}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (suggestions.length > 0) selectSuggestion(suggestions[0]);
                else setShowSuggestions(false);
              }}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={clearFilter} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.categoryFilterRow}
          onPress={() => setCategoryModalOpen(true)}
          activeOpacity={0.7}
        >
          {selectedCategoryLabels ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedCategoryLabels.map((c) => (
                <View
                  key={c.id}
                  style={[
                    styles.categoryChip,
                    { backgroundColor: c.Farbe ?? "#666" },
                  ]}
                >
                  <Text style={styles.categoryChipText}>{c.Name}</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.categoryFilterLabel}>Alle Kategorien ▾</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#fc6c14" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={displayedPlaces}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPin}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Keine Ergebnisse gefunden.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={6}
      />

      {showSuggestions && suggestions.length > 0 && searchLayout && (
        <View
          style={[
            styles.suggestionsBox,
            {
              position: "absolute",
              top: searchLayout.top,
              left: searchLayout.left,
              width: searchLayout.width,
            },
          ]}
        >
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.suggestionItem}
              onPress={() => selectSuggestion(s)}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <KategorieModal
        visible={categoryModalOpen}
        categories={allCategories}
        selectedIds={selectedCategoryIds}
        onToggle={toggleCategory}
        onClose={() => setCategoryModalOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  listHeader: {
    paddingTop: 8,
    paddingBottom: 12,
    gap: 5,
  },
  logo: {
    fontFamily: "Anton_400Regular",
    fontSize: 30,
    color: "#fc6c14",
    textAlign: "center",
    letterSpacing: 3,
  },
  tagline: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 18,
    color: "#000",
    textAlign: "center",
  },
  searchContainer: {
    backgroundColor: "#fc6c14",
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#000",
  },
  searchWrapper: {
    position: "relative",
    zIndex: 10,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000",
    borderRadius: 0,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
    color: "#000",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  clearBtn: {
    paddingLeft: 8,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 16,
    color: "#000",
  },
  suggestionsBox: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 4,
    zIndex: 999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: { elevation: 20 },
    }),
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  suggestionText: {
    fontSize: 15,
    color: "#333",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  categoryFilterRow: {
    borderWidth: 1,
    borderColor: "#000",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: "center",
  },
  categoryFilterLabel: {
    fontSize: 15,
    color: "#000",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  categoryChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "#000",
  },
  categoryChipText: {
    fontSize: 14,
    color: "#fff",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  card: {
    borderWidth: 4,
    borderColor: "#000",
    overflow: "hidden",
    width: 300,
    height: 300,
    alignSelf: "center",
  },
  cardImage: {
    width: "100%",
    height: "100%",
    justifyContent: "space-between",
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
    height: 80,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 10,
  },
  chipScroll: {
    flex: 1,
    marginRight: 8,
  },
  chipScrollContent: {
    alignItems: "flex-start",
  },
  cardBottom: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardName: {
    fontSize: 24,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
  },
  cardLocation: {
    fontSize: 13,
    color: "#ccc",
    fontFamily: "FiraSansCondensed_400Regular",
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalTitle: {
    fontSize: 30,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#000",
    textAlign: "center",
    paddingVertical: 12,
    borderBottomWidth: 10,
    borderBottomColor: "#fc6c14",
  },
  modalCloseBtn: {
    backgroundColor: "#fc6c14",
    paddingVertical: 5,
    alignItems: "center",
  },
  modalCloseBtnText: {
    color: "#fff",
    fontSize: 30,
    fontFamily: "FiraSansCondensed_700Bold",
  },
  modalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 16,
  },
  modalCategoryName: {
    flex: 1,
    fontSize: 30,
    color: "#000",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  modalCheck: {
    fontSize: 20,
    color: "#2D6A4F",
    fontWeight: "700",
  },
  modalSeparator: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginLeft: 52,
  },
  errorText: {
    fontSize: 15,
    color: "#c0392b",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: "#000",
    textAlign: "center",
    paddingTop: 40,
    fontFamily: "FiraSansCondensed_400Regular",
  },
});
