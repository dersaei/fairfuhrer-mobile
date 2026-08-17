import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import MenuButton from "@/components/MenuButton";
import AuthScreen from "@/components/auth/AuthScreen";
import PremiumWithoutAccountScreen from "@/components/auth/PremiumWithoutAccountScreen";
import ProfilSection from "@/components/profil/ProfilSection";
import EinstellungenSection from "@/components/profil/EinstellungenSection";
import PremiumSection from "@/components/profil/PremiumSection";
import RedaktionSection from "@/components/profil/RedaktionSection";
import OfflineKartenSection from "@/components/profil/OfflineKartenSection";

type AccountSection = "profil" | "einstellungen" | "offline-karten" | "premium" | "redaktion";

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
          ["profil", "einstellungen", "offline-karten", "redaktion", "premium"] as AccountSection[]
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
                      : "Redaktion"}
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
        {activeSection === "profil" && <ProfilSection user={user} signOut={signOut} />}
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
        {activeSection === "redaktion" && <RedaktionSection user={user} />}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProfilScreen() {
  const { user, isPro, isLoading } = useAuth();
  // `?register=1` — gesetzt von Screens, deren CTA schon "Konto anlegen"
  // heißt (purchase-success). Der Nutzer landet dann sofort im Formular
  // statt auf einer weiteren Zwischenseite mit demselben Button.
  const { register } = useLocalSearchParams<{ register?: string }>();
  const router = useRouter();
  // Der Wunsch "direkt zur Registrierung" gilt genau EINMAL. Ihn nur über den
  // Param zu steuern hat nicht gereicht: `setParams({ register: undefined })`
  // räumt ihn am Tab nicht zuverlässig ab, er klebte dort weiter — und nach
  // dem Abmelden landete der Nutzer wieder im Registrierungsformular statt
  // im Welcome-View, das der Profil-Tab dann zeigen soll.
  const consumedRef = useRef(false);
  const wantsRegister = register === "1" && !consumedRef.current;

  useEffect(() => {
    // Erst wenn der Auth-Status steht — solange geladen wird, ist noch kein
    // Kind gerendert, das den Startzustand übernehmen könnte.
    if (isLoading) return;
    if (register === "1") {
      // Die Kind-Komponenten haben den Startzustand in diesem Render bereits
      // übernommen; ab jetzt darf der Param nichts mehr auslösen. Zusätzlich
      // überschreiben wir ihn — anders als `undefined` wird ein leerer String
      // zuverlässig übernommen, und ein späterer Kauf kann den Wunsch dann
      // erneut setzen.
      consumedRef.current = true;
      router.setParams({ register: "" });
    } else {
      consumedRef.current = false;
    }
  }, [isLoading, register, router]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centerContent}>
          <ActivityIndicator color="#fc6c14" />
        </View>
      </SafeAreaView>
    );
  }

  // Zalogowany → pełny AccountScreen (z premium sekcjami)
  if (user) return <AccountScreen />;
  // Bez konta ale z premium (kupił anonimowo) → dedykowany ekran z zachętą
  // do założenia konta dla Offline-Karten i Ort-Vorschläge
  if (isPro) return <PremiumWithoutAccountScreen startWithRegister={wantsRegister} />;
  // Bez konta i bez premium → standardowy welcome/login
  return <AuthScreen initialView={wantsRegister ? "register" : "welcome"} />;
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
