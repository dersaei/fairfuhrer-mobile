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
import type { DirectusKategorie } from "@/types";
import { isSightsCategory } from "@/stores/placesStore";
import { CategoryIcon, CATEGORY_COLORS } from "./CategoryIcon";

export function KategorieBar({
  categories,
  selectedIds,
  onToggle,
  isPro,
}: {
  categories: DirectusKategorie[];
  selectedIds: Set<number>;
  onToggle: (id: number | null) => void;
  isPro: boolean;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const hasSelection = selectedIds.size > 0;
  const barColor = hasSelection ? "#fc6c14" : "#000";

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
    (action: number | "all" | "cancel") => {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setModalVisible(false);
        if (action === "cancel") return;
        if (action === "all") {
          onToggle(null);
          return;
        }
        onToggle(action);
      });
    },
    [slideAnim, onToggle],
  );

  const menuTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const backdropOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  const barLabel = hasSelection
    ? selectedIds.size === 1
      ? (categories.find((c) => selectedIds.has(c.id))?.Name ?? "")
      : `${selectedIds.size} Kategorien`
    : "Kategorie wählen ›";

  return (
    <View>
      {/* ── Modal z backdropem i menu ── */}
      <Modal
        transparent
        visible={modalVisible}
        animationType="none"
        onShow={handleModalShow}
        onRequestClose={() => closeMenu("cancel")}
        statusBarTranslucent
      >
        <Animated.View
          style={[styles.kategorieBackdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => closeMenu("cancel")}
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
          {/* "Alle" */}
          <TouchableOpacity
            style={[styles.kategorieMenuItem, !hasSelection && styles.kategorieMenuItemActive]}
            onPress={() => closeMenu("all")}
            activeOpacity={0.7}
          >
            <View style={styles.kategorieMenuIcon}>
              <CategoryIcon categoryId={null} color={!hasSelection ? "#fff" : "#000"} />
            </View>
            <Text
              style={[styles.kategorieMenuText, !hasSelection && styles.kategorieMenuTextActive]}
            >
              Alle
            </Text>
          </TouchableOpacity>

          {/* Kategorie — każda niezależnie toggleowana, menu nie zamyka się */}
          {categories.map((cat) => {
            const isActive = selectedIds.has(cat.id);
            const showSightsHint = !isPro && isSightsCategory(cat);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.kategorieMenuItem,
                  isActive && { backgroundColor: cat.Farbe ?? "#fc6c14" },
                ]}
                onPress={() => onToggle(cat.id)}
                activeOpacity={0.7}
              >
                <View style={styles.kategorieMenuIcon}>
                  <CategoryIcon
                    categoryId={cat.id}
                    color={isActive ? "#fafafa" : (CATEGORY_COLORS[cat.id] ?? "#fc6c14")}
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
                      Basis-Nutzer sehen nur 20 % der Sehenswertes-Orte. Mit Fairführer+ sind alle
                      sichtbar.
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </Modal>

      {/* ── Trigger bar ── */}
      <TouchableOpacity
        style={[styles.kategorieBar, { backgroundColor: barColor }]}
        onPress={openMenu}
        activeOpacity={0.85}
      >
        {hasSelection && selectedIds.size === 1 && (
          <View style={styles.kategorieBarIcon}>
            <CategoryIcon
              categoryId={[...selectedIds][0]}
              color="#fff"
              strokeColor={barColor}
              size={28}
            />
          </View>
        )}
        <Text style={[styles.kategorieBarText, { color: "#fff" }]}>{barLabel}</Text>
        {hasSelection && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onToggle(null);
            }}
            style={styles.kategorieClearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.kategorieClearText, { color: "#fff" }]}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  kategorieBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  kategorieBarIcon: {
    marginRight: 10,
  },
  kategorieBarText: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#000",
    flex: 1,
  },
  kategorieClearBtn: {
    paddingLeft: 10,
  },
  kategorieClearText: {
    fontSize: 16,
    color: "#000",
  },
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
  kategorieMenuItemActive: {
    backgroundColor: "#000",
  },
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
  kategorieMenuTextActive: {
    color: "#fff",
  },
  kategorieMenuHint: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#5c2121",
    marginTop: 2,
    paddingRight: 8,
  },
  kategorieMenuHintActive: {
    color: "rgba(255,255,255,0.9)",
  },
});
