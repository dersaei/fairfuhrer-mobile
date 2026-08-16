import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { getAccountBenefitsContent, type AccountBenefitsContent } from "@/lib/directus";

// Fallback-Texte, falls Directus (noch) leer ist oder das Netzwerk versagt.
// Muss inhaltlich mit `account_benefits_content` synchron gehalten werden.
const DEFAULTS: AccountBenefitsContent = {
  eyebrow: "KONTO ANLEGEN",
  headline: "Dein volles Fairführer-Erlebnis",
  intro:
    "Ein kostenloses Konto schaltet die Funktionen frei, für die wir dich verlässlich zuordnen müssen — z. B. deine Offline-Karten und die Pins, die du selbst vorschlägst.",
  benefit_1: "Offline-Karten für unterwegs (mit FAIRFÜHRER+)",
  benefit_2: "Eigene Orte vorschlagen & Pins erstellen (mit FAIRFÜHRER+)",
  benefit_3: "Synchronisation zwischen deinen Geräten",
  footnote:
    "Kostenlos. Optional. Auch nach dem FAIRFÜHRER+ Kauf jederzeit möglich — dein Kauf bleibt erhalten.",
  footnote_post_purchase:
    "Wichtig: Sobald du ein Konto hast, gehört FAIRFÜHRER+ zu diesem Konto. " +
    "Bleib angemeldet — abgemeldet stehen die Premium-Funktionen nicht zur Verfügung. " +
    "Nach dem nächsten Anmelden sind sie sofort wieder da.",
  cta_label: "Konto anlegen",
};

interface Props {
  /** Callback für Klick auf den CTA-Button. Nicht setzen → Button wird ausgeblendet. */
  onCtaPress?: () => void;
  /** Untermarge zur nächsten Sektion. Default 0. */
  marginBottom?: number;
  /**
   * Farbgebung. "dark" (Default) = schwarzer Container mit orangem Button.
   * "brand" dreht das um: oranger Container, schwarzer Button mit orangem
   * Text. Auf Orange sind Texte schwarz — Weiß käme auf #fc6c14 nur auf
   * 2,9:1 Kontrast und wäre selbst als Headline unlesbar.
   *
   * "brand" hebt zusätzlich die Fußnote hervor (größer, ohne Kursiv und
   * ohne Transparenz). Beides gehört zusammen: die Variante wird dort
   * eingesetzt, wo die Fußnote eine Bedingung transportiert, die der Nutzer
   * nicht überlesen darf — nicht bloß eine Randnotiz.
   */
  tone?: "dark" | "brand";
  /**
   * Welche Fußnote aus Directus gezeigt wird. "post_purchase" nutzt
   * `footnote_post_purchase` — den Hinweis, der nur direkt nach dem Kauf
   * gilt. Fällt auf `footnote` zurück, wenn das Feld im CMS leer ist.
   */
  footnoteVariant?: "default" | "post_purchase";
}

/**
 * Prominenter dunkler Container, der die Vorteile eines kostenlosen Kontos
 * erklärt. Nutzer sollen sofort verstehen: Offline-Karten und
 * Ort-Vorschläge erfordern ein Konto (nicht nur den FAIRFÜHRER+ Kauf).
 *
 * Wird an mehreren Stellen der App gerendert:
 * - Paywall (statt der bisherigen kleinen Grau-Kursiv-Note)
 * - Purchase-Success (verstärkt die dortige CTA)
 * - PremiumSection (für Free-Nutzer neben dem Paywall-CTA)
 * - AuthScreen welcome view (ohne CTA — dort gibt's schon primäre Buttons)
 *
 * Content kommt aus Directus (`account_benefits_content`) — mit
 * Fallback im Code, damit die App auch offline / bei CMS-Ausfall
 * konsistent aussieht.
 */
export default function AccountBenefitsCard({
  onCtaPress,
  marginBottom = 0,
  tone = "dark",
  footnoteVariant = "default",
}: Props) {
  const [content, setContent] = useState<AccountBenefitsContent>(DEFAULTS);
  const isBrand = tone === "brand";
  const footnoteText =
    footnoteVariant === "post_purchase"
      ? (content.footnote_post_purchase ?? DEFAULTS.footnote_post_purchase ?? content.footnote)
      : content.footnote;

  useEffect(() => {
    let active = true;
    getAccountBenefitsContent().then((c) => {
      if (active && c) setContent(c);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={[s.card, isBrand && s.cardBrand, marginBottom ? { marginBottom } : null]}>
      <Text style={[s.eyebrow, isBrand && s.eyebrowBrand]}>{content.eyebrow}</Text>
      <Text style={[s.headline, isBrand && s.onBrand]}>{content.headline}</Text>

      {content.intro ? (
        <Text style={[s.intro, isBrand && s.introBrand]}>{content.intro}</Text>
      ) : null}

      <View style={s.benefitList}>
        {[content.benefit_1, content.benefit_2, content.benefit_3].map((benefit) => (
          <View key={benefit} style={s.benefitRow}>
            <Text style={[s.check, isBrand && s.checkBrand]}>✓</Text>
            <Text style={[s.benefitText, isBrand && s.onBrand]}>{benefit}</Text>
          </View>
        ))}
      </View>

      {footnoteText ? (
        <Text style={[s.footnote, isBrand && s.footnoteBrand]}>{footnoteText}</Text>
      ) : null}

      {onCtaPress ? (
        <TouchableOpacity
          style={[s.ctaBtn, isBrand && s.ctaBtnBrand]}
          onPress={onCtaPress}
          activeOpacity={0.85}
        >
          <Text style={[s.ctaBtnText, isBrand && s.ctaBtnTextBrand]}>{content.cta_label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#181716",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  // 90 % Deckkraft statt Vollton: der Container wirkt auf dem weißen Screen
  // weicher. Als Hintergrundfarbe, nicht als `opacity` auf der View — sonst
  // würden Text und Button mit ausgeblichen.
  cardBrand: { backgroundColor: "rgba(252, 108, 20, 0.9)" },
  /** Schrift auf orangem Grund — Weiß hat dort zu wenig Kontrast. */
  onBrand: { color: "#181716" },
  eyebrow: {
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
    letterSpacing: 2,
  },
  eyebrowBrand: { color: "#181716" },
  headline: {
    color: "#fff",
    fontFamily: "Anton_400Regular",
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0.5,
  },
  intro: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  introBrand: { color: "rgba(24,23,22,0.85)" },
  benefitList: {
    gap: 8,
    marginTop: 4,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  check: {
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 16,
    lineHeight: 22,
    width: 18,
  },
  checkBrand: { color: "#181716" },
  benefitText: {
    flex: 1,
    color: "#fff",
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  footnote: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
    marginTop: 4,
  },
  // Bedingung statt Randnotiz: größer als der übrige Text, volle Deckkraft,
  // aufrecht statt kursiv — der Nutzer soll sie nicht überlesen.
  footnoteBrand: {
    color: "#181716",
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 16,
    lineHeight: 23,
    fontStyle: "normal",
    marginTop: 6,
  },
  ctaBtn: {
    backgroundColor: "#fc6c14",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  ctaBtnBrand: { backgroundColor: "#181716" },
  ctaBtnText: {
    color: "#181716",
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 17,
    letterSpacing: 0.5,
  },
  ctaBtnTextBrand: { color: "#fc6c14" },
});
