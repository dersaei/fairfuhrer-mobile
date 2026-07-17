import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryIcon, CATEGORY_COLORS } from "./CategoryIcon";
import { isSightsCategory } from "@/stores/placesStore";
import type { DirectusKategorie } from "@/types";

const DEFAULT_COLOR = "#fc6c14";
// Brand-Blau (von Tanja vorgeschlagen, 2026-06-25). Ersetzt schwarz für
// neutrale Leisten/Borders/Backgrounds — schwarz wirkt im UI zu hart.
const BRAND_BLUE = "#336BA2";
// Warmer Cremeton für die Kategorie-Leiste im Ausgangszustand (kein Filter
// aktiv). Dunkler Text darauf für Lesbarkeit.
const BAR_BG = "rgba(255, 242, 232, 0.9)";

export function KategorieBar({
  categories,
  selectedId,
  onSelect,
  isPro,
}: {
  categories: DirectusKategorie[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  isPro: boolean;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const selectedCat = selectedId ? categories.find((c) => c.id === selectedId) : null;
  const barColor = selectedCat ? (selectedCat.Farbe ?? DEFAULT_COLOR) : BAR_BG;

  const openMenu = useCallback(() => {
    slideAnim.setValue(0);
    setModalVisible(true);
  }, [slideAnim]);

  const handleModalShow = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closeMenu = useCallback(
    (id: number | null) => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
        onSelect(id);
      });
    },
    [slideAnim, onSelect],
  );

  const menuTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  return (
    <View>
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onShow={handleModalShow}
        onRequestClose={() => closeMenu(selectedId)}
        statusBarTranslucent
      >
        <Animated.View
          style={[styles.kategorieBackdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => closeMenu(selectedId)}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.kategorieMenu,
            {
              opacity: slideAnim,
              transform: [{ translateY: menuTranslateY }],
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.kategorieMenuItem,
              selectedId === null && styles.kategorieMenuItemActive,
            ]}
            onPress={() => closeMenu(null)}
            activeOpacity={0.7}
          >
            <View style={styles.kategorieMenuIcon}>
              <CategoryIcon categoryId={null} color={selectedId === null ? "#000" : "#000"} />
            </View>
            <Text
              style={[
                styles.kategorieMenuText,
                selectedId === null && styles.kategorieMenuTextActive,
              ]}
            >
              Alle
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => {
            const isActive = cat.id === selectedId;
            const showSightsHint = !isPro && isSightsCategory(cat);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.kategorieMenuItem,
                  isActive && { backgroundColor: cat.Farbe ?? DEFAULT_COLOR },
                ]}
                onPress={() => closeMenu(cat.id)}
                activeOpacity={0.7}
              >
                <View style={styles.kategorieMenuIcon}>
                  <CategoryIcon
                    categoryId={cat.id}
                    color={isActive ? "#fff" : (CATEGORY_COLORS[cat.id] ?? DEFAULT_COLOR)}
                    strokeColor={isActive ? (CATEGORY_COLORS[cat.id] ?? DEFAULT_COLOR) : "white"}
                  />
                </View>
                <View style={styles.kategorieMenuTextWrap}>
                  <Text
                    style={[styles.kategorieMenuText, isActive && styles.kategorieMenuTextActive]}
                  >
                    {cat.Name}
                  </Text>
                  {showSightsHint && (
                    <Text
                      style={[styles.kategorieMenuHint, isActive && styles.kategorieMenuHintActive]}
                    >
                      Basis-Nutzer sehen nur 50 % der Sehenswertes-Orte. Mit Fairführer+ sind alle
                      sichtbar.
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </Modal>

      <TouchableOpacity
        style={[styles.kategorieBar, { backgroundColor: barColor }]}
        onPress={openMenu}
        activeOpacity={0.85}
      >
        {selectedCat ? (
          <>
            <View style={styles.kategorieBarIcon}>
              <CategoryIcon
                categoryId={selectedCat.id}
                color="#fff"
                strokeColor={barColor}
                size={28}
              />
            </View>
            <Text style={[styles.kategorieBarText, { color: "#fff" }]}>{selectedCat.Name}</Text>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              style={styles.kategorieClearBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.kategorieClearText, { color: "#fff" }]}>✕</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={[styles.kategorieBarText, { color: BRAND_BLUE }]}>Kategorie wählen ›</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  kategorieBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
  },
  kategorieMenu: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  kategorieMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  kategorieMenuItemActive: { backgroundColor: BRAND_BLUE },
  kategorieMenuIcon: {
    marginRight: 14,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  kategorieMenuTextWrap: { flex: 1 },
  kategorieMenuText: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#000",
  },
  kategorieMenuTextActive: { color: "#fff" },
  kategorieMenuHint: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#5c2121",
    marginTop: 2,
    paddingRight: 8,
  },
  kategorieMenuHintActive: { color: "rgba(255,255,255,0.9)" },
  kategorieBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: BRAND_BLUE,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  kategorieBarIcon: { marginRight: 10 },
  kategorieBarText: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#000",
    flex: 1,
  },
  kategorieClearBtn: { paddingLeft: 10 },
  kategorieClearText: { fontSize: 16, color: "#000" },
});
