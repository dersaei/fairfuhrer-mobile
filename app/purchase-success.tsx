import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function PurchaseSuccessScreen() {
  const router = useRouter();

  const handleCreateAccount = () => {
    // Profil-Tab öffnet AuthScreen im Registrierungs-Modus.
    // Nach erfolgreicher Anmeldung mergt RevenueCat den anonymen Kauf
    // automatisch mit der neuen Supabase-user.id (Purchases.logIn).
    router.replace("/(tabs)/profil");
  };

  const handleLater = () => {
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.emoji}>🎉</Text>
          <Text style={s.title}>FAIRFÜHRER+ ist aktiv!</Text>
          <Text style={s.subtitle}>Vielen Dank für deine Unterstützung.</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Sofort verfügbar</Text>
          <View style={s.featureRow}>
            <Text style={s.check}>✓</Text>
            <Text style={s.featureText}>Alle Sehenswürdigkeiten auf der Karte</Text>
          </View>
          <View style={s.featureRow}>
            <Text style={s.check}>✓</Text>
            <Text style={s.featureText}>Alle Audio-Guides ohne Einschränkungen</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Mit kostenlosem Konto zusätzlich</Text>
          <View style={s.featureRow}>
            <Text style={s.iconAdd}>+</Text>
            <Text style={s.featureText}>Offline-Karten für unterwegs</Text>
          </View>
          <View style={s.featureRow}>
            <Text style={s.iconAdd}>+</Text>
            <Text style={s.featureText}>Eigene Orte vorschlagen & Pins erstellen</Text>
          </View>
          <View style={s.featureRow}>
            <Text style={s.iconAdd}>+</Text>
            <Text style={s.featureText}>Zugriff auf allen deinen Geräten</Text>
          </View>
          <Text style={s.hint}>
            Dein Kauf bleibt erhalten. Er wird automatisch mit deinem neuen Konto verknüpft.
          </Text>
        </View>

        <View style={s.ctaSection}>
          <TouchableOpacity style={s.primaryBtn} onPress={handleCreateAccount} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Konto jetzt anlegen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={handleLater} activeOpacity={0.7}>
            <Text style={s.secondaryBtnText}>Später anlegen</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 24,
  },
  header: {
    alignItems: "center",
    gap: 10,
    paddingTop: 24,
  },
  emoji: {
    fontSize: 56,
  },
  title: {
    fontFamily: "Anton_400Regular",
    fontSize: 32,
    color: "#181716",
    letterSpacing: 1,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#666",
    textAlign: "center",
  },
  section: {
    borderWidth: 1.5,
    borderColor: "#f0e8e0",
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
    color: "#fc6c14",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  check: {
    fontSize: 15,
    color: "#2D6A4F",
    fontFamily: "FiraSansCondensed_700Bold",
    lineHeight: 22,
    width: 18,
  },
  iconAdd: {
    fontSize: 18,
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_700Bold",
    lineHeight: 22,
    width: 18,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#333",
    lineHeight: 22,
  },
  hint: {
    fontSize: 12,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#666",
    lineHeight: 17,
    marginTop: 6,
    fontStyle: "italic",
  },
  ctaSection: {
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: "#181716",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fc6c14",
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#666",
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
});
