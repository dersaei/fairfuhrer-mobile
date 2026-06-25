import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import MenuButton from "@/components/MenuButton";
import AuthScreen from "@/components/auth/AuthScreen";
import ProfilSection from "@/components/profil/ProfilSection";
import EinstellungenSection from "@/components/profil/EinstellungenSection";
import PremiumSection from "@/components/profil/PremiumSection";
import OrtVorschlagenSection from "@/components/profil/OrtVorschlagenSection";
import OfflineKartenSection from "@/components/profil/OfflineKartenSection";

type AccountSection = "profil" | "einstellungen" | "offline-karten" | "premium" | "ort-vorschlagen";

function AccountScreen() {
  const { user, profile, isPro, signOut, deleteAccount, refreshProfile, refreshPro } = useAuth();
  const [activeSection, setActiveSection] = useState<AccountSection>("profil");

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header — minimalna identyfikacja konta: email + plan. Avatar/username
          świadomie pominięte, dopóki nie ma realnych community-features. */}
      <View style={s.accountHeader}>
        <View style={s.accountHeaderInfo}>
          <Text style={s.accountEmail}>{user?.email}</Text>
          <View style={[s.planBadge, isPro && s.planBadgePro]}>
            <Text style={[s.planBadgeText, isPro && s.planBadgeTextPro]}>
              {isPro ? "★ FAIRFÜHRER+" : "Kostenlos"}
            </Text>
          </View>
        </View>
        <MenuButton />
      </View>

      {/* Nav */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.navScroll}
        contentContainerStyle={s.navContent}
      >
        {(
          [
            "profil",
            "einstellungen",
            "offline-karten",
            "ort-vorschlagen",
            "premium",
          ] as AccountSection[]
        ).map((sec) => (
          <TouchableOpacity
            key={sec}
            style={[s.navItem, activeSection === sec && s.navItemActive]}
            onPress={() => setActiveSection(sec)}
          >
            <Text style={[s.navItemText, activeSection === sec && s.navItemTextActive]}>
              {sec === "profil"
                ? "Profil"
                : sec === "einstellungen"
                  ? "Einstellungen"
                  : sec === "offline-karten"
                    ? "Offline-Karten"
                    : sec === "premium"
                      ? "Premium"
                      : "Ort vorschlagen"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.sectionContent}
        keyboardShouldPersistTaps="handled"
      >
        {activeSection === "profil" && (
          <ProfilSection user={user} signOut={signOut} />
        )}
        {activeSection === "einstellungen" && (
          <EinstellungenSection
            user={user}
            profile={profile}
            signOut={signOut}
            deleteAccount={deleteAccount}
            refreshProfile={refreshProfile}
          />
        )}
        {activeSection === "offline-karten" && <OfflineKartenSection isPro={isPro} />}
        {activeSection === "premium" && (
          <PremiumSection isPro={isPro} refreshPro={refreshPro} profile={profile} />
        )}
        {activeSection === "ort-vorschlagen" && (
          <OrtVorschlagenSection user={user} isPremium={isPro} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProfilScreen() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centerContent}>
          <ActivityIndicator color="#fc6c14" />
        </View>
      </SafeAreaView>
    );
  }

  return user ? <AccountScreen /> : <AuthScreen />;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centerContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e0",
  },
  accountHeaderInfo: { flex: 1, gap: 6 },
  accountEmail: {
    fontSize: 15,
    color: "#111",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  planBadge: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#fc6c14",
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  planBadgePro: {
    backgroundColor: "#fc6c14",
  },
  planBadgeText: {
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
  },
  planBadgeTextPro: {
    color: "#fff",
  },
  navScroll: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e0",
    flexGrow: 0,
  },
  navContent: {
    paddingHorizontal: 16,
    gap: 4,
    flexDirection: "row",
    paddingVertical: 4,
  },
  navItem: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  navItemActive: { backgroundColor: "#fff5ef" },
  navItemText: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#999",
  },
  navItemTextActive: { color: "#fc6c14" },
  sectionContent: { paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
});
