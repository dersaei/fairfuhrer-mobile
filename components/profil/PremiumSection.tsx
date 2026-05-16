import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import Purchases from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { useRouter } from "expo-router";
import { type Profile } from "@/context/AuthContext";
import KontaktForm from "@/components/profil/KontaktForm";

const TABLE_ROWS = [
  { label: "Alle Kategorien auf der Karte", free: true, pro: true },
  { label: "20 % der Sehenswertes-Pins", free: true, pro: true },
  { label: "100 % der Sehenswertes-Pins", free: false, pro: true },
  { label: "Offline-Karten", free: false, pro: true },
  { label: "Orte vorschlagen", free: false, pro: true },
  { label: "Community-Funktionen", free: false, pro: true },
];

export default function PremiumSection({
  isPro,
  refreshPro,
  profile,
}: {
  isPro: boolean;
  refreshPro: () => Promise<void>;
  profile: Profile | null;
}) {
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = () => {
    router.push("/custom-paywall");
  };

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

  const handleCustomerCenter = async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch {
      Alert.alert("Fehler", "Kundencenter konnte nicht geöffnet werden.");
    }
  };

  const premiumUntil = profile?.premium_until ? new Date(profile.premium_until) : null;

  return (
    <View style={s.section}>
      <Text style={s.heading}>Fairführer+</Text>

      {isPro ? (
        <View style={s.proActiveBox}>
          <Text style={s.proActiveIcon}>★</Text>
          <Text style={s.proActiveTitle}>Fairführer+ aktiv</Text>
          {premiumUntil && (
            <Text style={s.proActiveDate}>
              {"Gültig bis: "}
              <Text style={s.proActiveDateBold}>
                {premiumUntil.toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </Text>
          )}
          <Text style={s.proActiveHint}>
            {`Dein Abonnement wird über den App Store (iOS) oder Google Play (Android) verwaltet. Um dein Abo zu kündigen oder zu ändern, gehe zu Profil → Premium → Abonnement verwalten.`}
          </Text>
        </View>
      ) : (
        <Text style={s.lead}>
          {"Mit "}
          <Text style={s.leadBold}>Fairführer+</Text>
          {
            " unterstützt du die Community und erhältst Zugang zu allen Pins und exklusiven Funktionen."
          }
        </Text>
      )}

      {/* Tabela porównawcza */}
      <View style={s.tableBlock}>
        <Text style={s.sectionLabel}>Kostenlos vs. Premium</Text>
        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.thCell, s.thFeature]}>Funktion</Text>
            <Text style={[s.thCell, s.thFree]}>Kostenlos</Text>
            <Text style={[s.thCell, s.thPro]}>Fairführer+</Text>
          </View>
          {TABLE_ROWS.map((row, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
              <Text style={s.tdFeature}>{row.label}</Text>
              <Text style={[s.tdCenter, row.free ? s.check : s.cross]}>{row.free ? "✓" : "—"}</Text>
              <Text style={[s.tdCenter, row.pro ? s.check : s.cross]}>{row.pro ? "✓" : "—"}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Zakup lub zarządzanie abonamentem */}
      {isPro ? (
        <>
          <View style={s.proInfoBox}>
            <Text style={s.proInfoTitle}>Abonnement-Informationen</Text>
            <Text style={s.proInfoText}>
              Dein Abo wird automatisch verlängert, sofern du es nicht mindestens 24 Stunden vor
              Ablauf kündigst. Die Abrechnung erfolgt über deinen App Store (iOS) oder Google Play
              (Android)-Account.
            </Text>
          </View>
          <TouchableOpacity style={s.btnOutline} onPress={handleCustomerCenter}>
            <Text style={s.btnOutlineText}>Abonnement verwalten</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={s.appBox}>
            <Text style={s.sectionLabel}>So kaufst du Fairführer+</Text>
            <TouchableOpacity style={s.btnPrimary} onPress={handlePurchase} activeOpacity={0.85}>
              <Text style={s.btnPrimaryText}>Fairführer+ aktivieren</Text>
              <Text style={s.btnPrimarySub}>{"Pläne & Preise im nächsten Schritt"}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[s.btnOutline, restoring && s.btnDisabled]}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={s.btnOutlineText}>Käufe wiederherstellen</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {/* Formularz kontaktowy */}
      <KontaktForm />
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 16, marginTop: 8 },
  heading: {
    fontFamily: "Anton_400Regular",
    fontSize: 32,
    color: "#fc6c14",
    textAlign: "center",
    letterSpacing: 1,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#111",
  },
  lead: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#18222f",
    lineHeight: 22,
  },
  leadBold: { fontFamily: "FiraSansCondensed_700Bold" },
  proActiveBox: {
    borderWidth: 1.5,
    borderColor: "#fc6c14",
    backgroundColor: "#fff5ef",
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  proActiveIcon: { fontSize: 28, color: "#fc6c14" },
  proActiveTitle: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 18,
    color: "#18222f",
  },
  proActiveDate: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 14,
    color: "#18222f",
  },
  proActiveDateBold: { fontFamily: "FiraSansCondensed_700Bold" },
  proActiveHint: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 13,
    color: "#555",
    lineHeight: 19,
    textAlign: "center",
    marginTop: 4,
  },
  tableBlock: { gap: 8 },
  sectionLabel: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#18222f",
  },
  table: { borderWidth: 1, borderColor: "#e0e0e0" },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  thCell: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  thFeature: { flex: 1, color: "#18222f" },
  thFree: { width: 72, textAlign: "center", color: "#666" },
  thPro: { width: 72, textAlign: "center", color: "#fc6c14" },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#fafafa" },
  tdFeature: {
    flex: 1,
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 14,
    color: "#18222f",
    paddingVertical: 9,
    paddingHorizontal: 10,
    lineHeight: 18,
  },
  tdCenter: {
    width: 72,
    textAlign: "center",
    fontSize: 15,
    fontFamily: "FiraSansCondensed_700Bold",
  },
  check: { color: "#18a34a" },
  cross: { color: "#bbb" },
  appBox: { gap: 10 },
  btnPrimary: {
    backgroundColor: "#fc6c14",
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 2,
  },
  btnPrimaryText: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 16,
    color: "#fff",
    letterSpacing: 0.5,
  },
  btnPrimarySub: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
  },
  proInfoBox: { backgroundColor: "#f9f5f2", padding: 16, gap: 8 },
  proInfoTitle: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
    color: "#555",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  proInfoText: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 14,
    alignItems: "center",
  },
  btnOutlineText: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 15,
    color: "#111",
  },
  btnDisabled: { opacity: 0.4 },
});
