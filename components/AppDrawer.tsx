import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";

const FF_ORANGE = "#fc6c14";
const FF_BLACK = "#181716";
const DRAWER_WIDTH = Dimensions.get("window").width * 0.78;

interface Props {
  visible: boolean;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <Svg width={42} height={42} viewBox="0 0 24 24" fill="none">
      <Path d="M18 6L6 18M6 6l12 12" stroke={FF_BLACK} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function ChevronIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke="#999"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface DrawerItemProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}

function DrawerItem({ label, icon, onPress }: DrawerItemProps) {
  return (
    <TouchableOpacity style={s.item} onPress={onPress} activeOpacity={0.7}>
      <View style={s.itemIcon}>{icon}</View>
      <Text style={s.itemLabel}>{label}</Text>
      <ChevronIcon />
    </TouchableOpacity>
  );
}

function HilfeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={FF_ORANGE} strokeWidth={1.8} />
      <Path
        d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"
        stroke={FF_ORANGE}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={17} r={0.5} fill={FF_ORANGE} stroke={FF_ORANGE} strokeWidth={1} />
    </Svg>
  );
}

function DatenschutzIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        stroke={FF_ORANGE}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AgbIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke={FF_ORANGE}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke={FF_ORANGE}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ImpressumIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={FF_ORANGE} strokeWidth={1.8} />
      <Path d="M12 16v-4M12 8h.01" stroke={FF_ORANGE} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function FeedbackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={FF_ORANGE}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AppDrawer({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible && (translateX as any)._value === DRAWER_WIDTH) return null;

  function navigate(path: string) {
    onClose();
    setTimeout(() => router.push(path as any), 250);
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? "auto" : "none"}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel — slides in from right */}
      <Animated.View
        style={[
          s.panel,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateX }] },
        ]}
      >
        {/* Header */}
        <View style={s.panelHeader}>
          <Text style={s.panelTitle}>FAIRFÜHRER</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <CloseIcon />
          </TouchableOpacity>
        </View>

        {/* Main items */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>SUPPORT</Text>
          <DrawerItem
            label="Hilfe & FAQ"
            icon={<HilfeIcon />}
            onPress={() => navigate("/(drawer)/hilfe")}
          />
          <DrawerItem
            label="Feedback senden"
            icon={<FeedbackIcon />}
            onPress={() => Linking.openURL("mailto:info@fairfuehrer.guide?subject=App-Feedback")}
          />
        </View>

        <View style={s.divider} />

        <View style={s.section}>
          <Text style={s.sectionLabel}>RECHTLICHES</Text>
          <DrawerItem
            label="Datenschutz"
            icon={<DatenschutzIcon />}
            onPress={() => navigate("/(drawer)/datenschutz")}
          />
          <DrawerItem
            label="Nutzungsbedingungen"
            icon={<AgbIcon />}
            onPress={() => navigate("/(drawer)/agb")}
          />
          <DrawerItem
            label="Impressum"
            icon={<ImpressumIcon />}
            onPress={() => navigate("/(drawer)/impressum")}
          />
        </View>

        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={s.footerText}>© 2025 Seenergien GmbH</Text>
          <Text style={s.footerText}>fairfuehrer.guide</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 16,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  panelTitle: {
    fontFamily: "Anton_400Regular",
    fontSize: 30,
    color: FF_ORANGE,
    letterSpacing: 1,
  },
  section: {
    paddingTop: 8,
  },
  sectionLabel: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 11,
    color: "#aaa",
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  itemIcon: {
    width: 24,
    alignItems: "center",
  },
  itemLabel: {
    fontFamily: "FiraSansCondensed_500Medium",
    fontSize: 16,
    color: FF_BLACK,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 20,
    marginTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    gap: 2,
  },
  footerText: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 12,
    color: "#ccc",
  },
});
