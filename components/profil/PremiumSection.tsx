import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import Purchases from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { type Profile } from "@/context/AuthContext";
import { ENTITLEMENT_ID } from "@/lib/revenuecat";
import PlanCompareCard, { Feature } from "@/components/PlanCompareCard";

export default function PremiumSection({
  isPro,
  refreshPro,
  profile,
}: {
  isPro: boolean;
  refreshPro: () => Promise<void>;
  profile: Profile | null;
}) {
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID,
      });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refreshPro();
      }
    } catch {
      Alert.alert("Fehler", "Kauf konnte nicht abgeschlossen werden.");
    } finally {
      setPurchasing(false);
    }
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

  if (isPro) {
    const premiumUntil = profile?.premium_until
      ? new Date(profile.premium_until).toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null;

    return (
      <View style={s.section}>
        <View style={s.proActiveBox}>
          <Text style={s.proActiveIcon}>★</Text>
          <Text style={s.proActiveTitle}>Fairführer+ aktiv</Text>
          {premiumUntil && <Text style={s.proActiveDate}>Gültig bis: {premiumUntil}</Text>}
          <Text style={s.sectionHint}>
            Du hast Zugang zu allen Premium-Funktionen. Vielen Dank für deine Unterstützung!
          </Text>
        </View>

        <View style={s.proInfoBox}>
          <Text style={s.proInfoTitle}>Abonnement-Informationen</Text>
          <Text style={s.proInfoText}>
            Dein Abo wird automatisch verlängert, sofern du es nicht mindestens 24 Stunden vor
            Ablauf kündigst. Die Abrechnung erfolgt über deinen App Store (iOS) oder Google Play
            (Android)-Account.
          </Text>
          <Text style={s.proInfoText}>
            {`Zum Kündigen oder Ändern des Abos tippe auf „Abonnement verwalten“.`}
          </Text>
        </View>

        <TouchableOpacity style={s.buttonOutline} onPress={handleCustomerCenter}>
          <Text style={s.buttonOutlineText}>Abonnement verwalten</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const freeFeatures: Feature[] = [
    { text: "Audio-Guides zu allen Orten anhören" },
    { text: "Alle Kategorien entdecken" },
    { text: "20 % der Pins in „Sehenswertes“" },
    { text: "Karte & Ortsuche" },
    { text: "100 % der Pins in „Sehenswertes“", locked: true },
    { text: "Offline-Karten", locked: true },
    { text: "Orte vorschlagen & Pins erstellen", locked: true },
  ];

  const premiumFeatures: Feature[] = [
    { text: "Alles aus der kostenlosen Version" },
    { text: "100 % der Pins in „Sehenswertes“" },
    { text: "Offline-Karten für unterwegs" },
    { text: "Neue Orte vorschlagen & eigene Pins erstellen" },
    { text: "Redaktionelle Prüfung deiner Pins vor Veröffentlichung" },
  ];

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Dein aktueller Plan</Text>

      <PlanCompareCard title="Kostenlos" features={freeFeatures} />

      <PlanCompareCard
        title="Fairführer+"
        isPremium
        features={premiumFeatures}
        button={
          <View style={[s.plansContainer, { marginTop: 16 }]}>
            <TouchableOpacity
              style={[s.planButton, s.planButtonPopular]}
              onPress={handlePurchase}
              disabled={purchasing}
            >
              <View style={s.planButtonInner}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.planLabel, s.planLabelPopular]}>Fairführer+ aktivieren</Text>
                  {purchasing ? null : (
                    <Text style={[s.planPrice, s.planPricePopular]}>
                      Pläne & Preise im nächsten Schritt
                    </Text>
                  )}
                </View>
                {purchasing && <ActivityIndicator color="#fff" />}
              </View>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity
        style={[s.buttonOutline, restoring && s.buttonDisabled]}
        onPress={handleRestore}
        disabled={restoring}
      >
        {restoring ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={s.buttonOutlineText}>Käufe wiederherstellen</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 12, marginTop: 16 },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
    letterSpacing: 0.3,
  },
  sectionHint: {
    fontSize: 15,
    color: "#999",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 18,
    textAlign: "center",
  },
  proActiveBox: {
    backgroundColor: "#fff5ef",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  proActiveIcon: {
    fontSize: 32,
    color: "#fc6c14",
  },
  proActiveTitle: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
    letterSpacing: 0.3,
  },
  proActiveDate: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#111",
  },
  proInfoBox: {
    backgroundColor: "#f9f5f2",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  proInfoTitle: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#555",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  proInfoText: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#666",
    lineHeight: 18,
  },
  buttonOutline: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  buttonOutlineText: {
    color: "#111",
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  buttonDisabled: { opacity: 0.4 },
  plansContainer: { gap: 10, marginTop: 4 },
  planButton: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
  },
  planButtonPopular: {
    borderColor: "#fc6c14",
    backgroundColor: "#fff5ef",
  },
  planButtonInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planLabel: {
    fontSize: 16,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#111",
  },
  planLabelPopular: { color: "#fc6c14" },
  planPrice: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#666",
    marginTop: 2,
  },
  planPricePopular: { color: "#fc6c14" },
});
