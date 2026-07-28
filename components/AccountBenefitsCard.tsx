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
  cta_label: "Konto anlegen",
};

interface Props {
  /** Callback für Klick auf den CTA-Button. Nicht setzen → Button wird ausgeblendet. */
  onCtaPress?: () => void;
  /** Untermarge zur nächsten Sektion. Default 0. */
  marginBottom?: number;
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
export default function AccountBenefitsCard({ onCtaPress, marginBottom = 0 }: Props) {
  const [content, setContent] = useState<AccountBenefitsContent>(DEFAULTS);

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
    <View style={[s.card, marginBottom ? { marginBottom } : null]}>
      <Text style={s.eyebrow}>{content.eyebrow}</Text>
      <Text style={s.headline}>{content.headline}</Text>

      {content.intro ? <Text style={s.intro}>{content.intro}</Text> : null}

      <View style={s.benefitList}>
        {[content.benefit_1, content.benefit_2, content.benefit_3].map((benefit) => (
          <View key={benefit} style={s.benefitRow}>
            <Text style={s.check}>✓</Text>
            <Text style={s.benefitText}>{benefit}</Text>
          </View>
        ))}
      </View>

      {content.footnote ? <Text style={s.footnote}>{content.footnote}</Text> : null}

      {onCtaPress ? (
        <TouchableOpacity style={s.ctaBtn} onPress={onCtaPress} activeOpacity={0.85}>
          <Text style={s.ctaBtnText}>{content.cta_label}</Text>
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
  eyebrow: {
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
    letterSpacing: 2,
  },
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
  ctaBtn: {
    backgroundColor: "#fc6c14",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  ctaBtnText: {
    color: "#181716",
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 17,
    letterSpacing: 0.5,
  },
});
