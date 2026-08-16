import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";
import MenuButton from "@/components/MenuButton";
import AuthScreen from "@/components/auth/AuthScreen";
import { useAuth } from "@/context/AuthContext";

/**
 * Angezeigt wenn der Nutzer FAIRFÜHRER+ gekauft hat, aber (noch) kein Konto
 * hat. RevenueCat verwaltet den Kauf über einen anonymen App-User-ID
 * ($RCAnonymousID). Sobald der Nutzer sich registriert / anmeldet, mergt
 * RevenueCat den anonymen Kauf automatisch mit der Supabase-user.id
 * (`Purchases.logIn` in identifyUser) — das Premium bleibt erhalten.
 *
 * Ziel: Nutzer klar informieren, dass Offline-Karten und Ort-Vorschläge
 * ein Konto erfordern, ohne den Kauf als Bedingung darzustellen.
 */
interface Props {
  /**
   * Öffnet direkt das Registrierungsformular statt der Zwischenseite.
   * Wird nach dem Kauf gesetzt (purchase-success → "Konto anlegen"): der
   * Nutzer hat seine Entscheidung dort schon getroffen und soll nicht
   * denselben Button noch einmal drücken müssen.
   */
  startWithRegister?: boolean;
}

export default function PremiumWithoutAccountScreen({ startWithRegister = false }: Props = {}) {
  const { refreshPro } = useAuth();
  const [showAuth, setShowAuth] = useState(startWithRegister);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await Purchases.restorePurchases();
      await refreshPro();
      Alert.alert("Erfolg", "Käufe wurden wiederhergestellt.");
    } catch {
      Alert.alert("Fehler", "Wiederherstellung fehlgeschlagen.");
    } finally {
      setRestoring(false);
    }
  };

  // Direkt ins Registrierungsformular — der Welcome-View würde hier
  // FAIRFÜHRER+ bewerben, das dieser Nutzer bereits gekauft hat.
  // "← Zurück" führt deshalb auch hierher zurück, nicht nach Welcome.
  if (showAuth) {
    return <AuthScreen initialView="register" onBack={() => setShowAuth(false)} />;
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Dein Konto</Text>
        <MenuButton />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.proBadge}>
          <Text style={s.proBadgeText}>★ FAIRFÜHRER+ aktiv</Text>
        </View>

        <Text style={s.headline}>Danke für deine Unterstützung!</Text>
        <Text style={s.lead}>
          Alle Sehenswürdigkeiten und Audio-Guides sind für dich freigeschaltet.
        </Text>

        <View style={s.card}>
          <Text style={s.cardTitle}>Konto anlegen für</Text>
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
          {/* Gleiche Bedingung wie auf dem Purchase-Success-Screen: ab dem
              Konto hängt FAIRFÜHRER+ an der Konto-ID, nicht mehr am Gerät. */}
          <Text style={s.hintStrong}>
            Wichtig: Danach ist FAIRFÜHRER+ nur noch im angemeldeten Zustand nutzbar. Meldest du
            dich ab, sind die Premium-Funktionen erst nach dem nächsten Anmelden wieder da.
          </Text>

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => setShowAuth(true)}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Konto anlegen</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Auf einem anderen Gerät gekauft?</Text>
          <Text style={s.cardBody}>
            Stelle deinen Kauf mit derselben Apple-ID oder Google-Konto wieder her.
          </Text>
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={handleRestore}
            disabled={restoring}
            activeOpacity={0.7}
          >
            {restoring ? (
              <ActivityIndicator color="#181716" size="small" />
            ) : (
              <Text style={s.secondaryBtnText}>Käufe wiederherstellen</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e0",
  },
  headerTitle: {
    fontFamily: "Anton_400Regular",
    fontSize: 24,
    color: "#181716",
    letterSpacing: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  proBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fc6c14",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  proBadgeText: {
    color: "#fff",
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
    letterSpacing: 1,
  },
  headline: {
    fontFamily: "Anton_400Regular",
    fontSize: 26,
    color: "#181716",
    letterSpacing: 0.5,
  },
  lead: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
  },
  card: {
    borderWidth: 1.5,
    borderColor: "#f0e8e0",
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  cardTitle: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
    color: "#fc6c14",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
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
    marginTop: 4,
    fontStyle: "italic",
  },
  hintStrong: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#181716",
    lineHeight: 21,
  },
  primaryBtn: {
    backgroundColor: "#181716",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#fc6c14",
    fontSize: 17,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: "#181716",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
    backgroundColor: "#fafafa",
  },
  secondaryBtnText: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 15,
    color: "#181716",
  },
});
