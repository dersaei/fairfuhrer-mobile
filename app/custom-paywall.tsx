import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { ENTITLEMENT_ID } from "@/lib/revenuecat";
import { useAuth } from "@/context/AuthContext";

const HERO_IMAGE = require("@/assets/images/engagement-unsplash.jpeg");

// Identyfikatory pakietów z RevenueCat Dashboard → Offerings → Packages
// Zaktualizuj jeśli użyłeś innych nazw w RC
const PACKAGE_META: Record<
  string,
  { label: string; sub: string; perMonth: string; popular?: boolean }
> = {
  fairfuehrer_small: {
    label: "Kleine Unterstützung",
    sub: "Ein Kaffee fürs Team",
    perMonth: "0,42 €/Monat",
  },
  fairfuehrer_fair: {
    label: "Faire Unterstützung",
    sub: "Empfohlen · deckt deinen Anteil",
    perMonth: "0,83 €/Monat",
    popular: true,
  },
  fairfuehrer_large: {
    label: "Große Unterstützung",
    sub: "Du machst den Unterschied",
    perMonth: "1,67 €/Monat",
  },
};

export default function PaywallScreen() {
  const router = useRouter();
  const { refreshPro } = useAuth();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selected, setSelected] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    Purchases.getOfferings()
      .then((offerings) => {
        const pkgs = offerings.current?.availablePackages ?? [];
        setPackages(pkgs);
        // Domyślnie zaznacz pakiet €9,99 (Faire Unterstützung)
        const medium = pkgs.find(
          (p) => p.product.priceString.includes("9,99") || p.product.priceString.includes("9.99"),
        );
        setSelected(medium ?? pkgs[0] ?? null);
      })
      .catch((e) => console.error("[Paywall] getOfferings error:", e))
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async () => {
    if (!selected) return;
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selected);
      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        await refreshPro();
        router.back();
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert("Fehler", "Kauf konnte nicht abgeschlossen werden.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    try {
      const info = await Purchases.restorePurchases();
      if (info.entitlements.active[ENTITLEMENT_ID]) {
        await refreshPro();
        router.back();
      } else {
        Alert.alert("Keine Käufe gefunden", "Es wurden keine früheren Käufe gefunden.");
      }
    } catch {
      Alert.alert("Fehler", "Wiederherstellung fehlgeschlagen.");
    }
  };

  const selectedPrice = selected?.product.priceString ?? "";

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero ── */}
        <ImageBackground source={HERO_IMAGE} style={s.hero} resizeMode="cover">
          <LinearGradient
            colors={["rgba(24,23,22,0.2)", "rgba(24,23,22,0.85)"]}
            style={StyleSheet.absoluteFill}
          />

          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()} hitSlop={12}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={s.heroContent}>
            <Text style={s.heroEyebrow}>FAIRFÜHRER+</Text>
            <Text style={s.heroHeadline}>{"WERDE\nFAIR-\nMACHER:IN."}</Text>
            <Text style={s.heroSubtitle}>
              Fairführer wird von einem kleinen Team gemacht. Mit deinem Beitrag bleiben wir frei
              und unabhängig — alle Funktionen gehören dazu.
            </Text>
          </View>
        </ImageBackground>

        {/* ── Features ── */}
        <View style={s.featuresSection}>
          {[
            "Alle Sehenswürdigkeiten — nicht nur 20 %",
            "Offline-Karten für unterwegs",
            "Eigene Orte vorschlagen & Pins erstellen",
            "Redaktionelle Prüfung deiner Pins",
          ].map((f) => (
            <View key={f} style={s.featureRow}>
              <Text style={s.featureCheck}>✓</Text>
              <Text style={s.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* ── Packages (Reich layout) ── */}
        {loading ? (
          <ActivityIndicator color="#fc6c14" style={{ marginVertical: 24 }} />
        ) : (
          <View style={s.packagesSection}>
            {packages.map((pkg) => {
              const isSelected = selected?.identifier === pkg.identifier;
              const price = pkg.product.priceString;
              const meta = PACKAGE_META[pkg.identifier];
              const label = meta?.label ?? pkg.product.title;
              const sub = meta?.sub ?? "Jährlich";
              const perMonth = meta?.perMonth ?? "";
              const isPopular = meta?.popular ?? false;

              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[s.packageCard, isSelected && s.packageCardSelected]}
                  onPress={() => setSelected(pkg)}
                  activeOpacity={0.85}
                >
                  <View style={[s.radioOuter, isSelected && s.radioOuterActive]}>
                    {isSelected && <View style={s.radioInner} />}
                  </View>

                  <View style={s.packageInfo}>
                    <Text style={s.packageTitle}>{label}</Text>
                    <Text style={s.packageDescription}>{sub}</Text>
                  </View>

                  <View style={s.packagePrice}>
                    <Text style={s.packagePriceValue}>{price}</Text>
                    {!!perMonth && <Text style={s.packagePerMonth}>{perMonth}</Text>}
                  </View>

                  {isPopular && (
                    <View style={s.popularBadge}>
                      <Text style={s.popularBadgeText}>BELIEBT</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── CTA ── */}
        <View style={s.ctaSection}>
          <TouchableOpacity
            style={[s.ctaBtn, (!selected || purchasing) && s.ctaBtnDisabled]}
            onPress={handlePurchase}
            disabled={!selected || purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#fc6c14" />
            ) : (
              <Text style={s.ctaBtnText}>Fairführer+ aktivieren · {selectedPrice}/Jahr</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleRestore} style={s.restoreBtn}>
            <Text style={s.restoreBtnText}>Käufe wiederherstellen</Text>
          </TouchableOpacity>

          {/* ── Legal (Voll) ── */}
          <View style={s.legalBlock}>
            <Text style={s.legalText}>
              <Text style={s.legalStrong}>Jahres-Abo · {selectedPrice}/Jahr.</Text> Zahlung wird
              nach Bestätigung des Kaufs deinem Apple-ID-Konto belastet. Das Abo verlängert sich
              automatisch um 12 Monate zum dann gültigen Preis, sofern es nicht mindestens 24
              Stunden vor Ablauf der laufenden Periode gekündigt wird.
            </Text>
            <Text style={s.legalText}>
              Du kannst dein Abo jederzeit in den Einstellungen deines App-Store-Kontos verwalten
              und kündigen — eine Erstattung des laufenden Zeitraums ist nicht möglich.
            </Text>
            <View style={s.legalLinks}>
              <Text style={s.legalLink} onPress={() => router.push("/(drawer)/agb")}>
                Nutzungsbedingungen
              </Text>
              <Text style={s.legalSep}> · </Text>
              <Text style={s.legalLink} onPress={() => router.push("/(drawer)/datenschutz")}>
                Datenschutz
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { flexGrow: 1 },

  // Hero
  hero: { minHeight: 380, justifyContent: "flex-end" },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "FiraSansCondensed_700Bold",
  },
  heroContent: { paddingHorizontal: 24, paddingBottom: 32, gap: 10 },
  heroEyebrow: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fc6c14",
    letterSpacing: 2.5,
  },
  heroHeadline: {
    fontFamily: "Anton_400Regular",
    fontSize: 52,
    color: "#fff",
    lineHeight: 54,
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 16,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "rgba(255,255,255,0.88)",
    lineHeight: 22,
  },

  // Features
  featuresSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e0",
  },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  featureCheck: {
    fontSize: 15,
    color: "#2D6A4F",
    fontFamily: "FiraSansCondensed_700Bold",
    lineHeight: 22,
    width: 18,
  },
  featureText: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#333",
    flex: 1,
    lineHeight: 22,
  },

  // Packages — Reich layout
  packagesSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 12,
  },
  packageCard: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    borderColor: "#e8e0d8",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: "#fafaf9",
  },
  packageCardSelected: {
    borderColor: "#fc6c14",
    backgroundColor: "#fff9f5",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#c7bdb3",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: "#fc6c14",
    backgroundColor: "#fc6c14",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  packageInfo: { flex: 1 },
  packageTitle: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
  },
  packageDescription: {
    fontSize: 12,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#888",
    marginTop: 2,
  },
  packagePrice: { alignItems: "flex-end" },
  packagePriceValue: {
    fontFamily: "Anton_400Regular",
    fontSize: 22,
    color: "#181716",
    letterSpacing: 0.5,
  },
  packagePerMonth: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 10,
    color: "#888",
  },
  popularBadge: {
    position: "absolute",
    top: -9,
    right: 14,
    backgroundColor: "#fc6c14",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  popularBadgeText: {
    fontSize: 10,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    letterSpacing: 1,
  },

  // CTA
  ctaSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 12,
  },
  ctaBtn: {
    backgroundColor: "#181716",
    paddingTop: 14,
    paddingBottom: 18,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaBtnText: {
    color: "#fc6c14",
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  restoreBtn: { alignItems: "center", paddingVertical: 8 },
  restoreBtnText: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#888",
  },

  // Legal — Voll
  legalBlock: { gap: 8, paddingHorizontal: 8, marginTop: 4 },
  legalText: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#9c948c",
    textAlign: "center",
    lineHeight: 16,
  },
  legalStrong: {
    color: "#6e665e",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  legalLinks: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 2,
  },
  legalLink: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#6e665e",
    textDecorationLine: "underline",
  },
  legalSep: { fontSize: 11, color: "#9c948c" },
});
