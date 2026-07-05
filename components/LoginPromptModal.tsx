import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";
import { getLoginPromptContent, type LoginPromptContent } from "@/lib/directus";

// Fallback-Texte, falls Directus nichts liefert. Spiegeln den aktuellen
// Use-Case wider: das Modal erscheint NACH der Plan-Auswahl auf dem Paywall,
// wenn der Nutzer noch kein Konto hat. body_highlight/body_suffix bleiben
// leer, weil der Text als ein Satz besser klingt — das Komponent rendert
// die optionalen Teile nur, wenn nicht leer.
const DEFAULTS = {
  title: "FAIRFÜHRER+",
  body_prefix:
    "Dein Plan ist ausgewählt — du brauchst nur noch ein Konto, damit dein Abo auf allen Geräten funktioniert und du es jederzeit wiederherstellen kannst.",
  body_highlight: "",
  body_suffix: "",
  hint: "Es dauert weniger als eine Minute.",
  btn_primary: "Konto erstellen oder anmelden",
  close_link: "Abbrechen",
};

function LockIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke="#fc6c14"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"
        stroke="#fc6c14"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={16} r={1.5} fill="#fc6c14" />
    </Svg>
  );
}

interface LoginPromptModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LoginPromptModal({ visible, onClose }: LoginPromptModalProps) {
  const router = useRouter();
  const [content, setContent] = useState<LoginPromptContent | null>(null);

  useEffect(() => {
    let active = true;
    getLoginPromptContent().then((c) => {
      if (active) setContent(c);
    });
    return () => {
      active = false;
    };
  }, []);

  const t = {
    title: content?.title || DEFAULTS.title,
    body_prefix: content?.body_prefix || DEFAULTS.body_prefix,
    body_highlight: content?.body_highlight || DEFAULTS.body_highlight,
    body_suffix: content?.body_suffix || DEFAULTS.body_suffix,
    hint: content?.hint || DEFAULTS.hint,
    btn_primary: content?.btn_primary || DEFAULTS.btn_primary,
    close_link: content?.close_link || DEFAULTS.close_link,
  };

  const handleLogin = () => {
    onClose();
    // /auth-modal ist eine Modal-Route: liegt VOR dem aktuellen Screen
    // (z. B. Paywall) im Stack. Nach erfolgreicher Anmeldung schließt sich
    // der AuthScreen automatisch und der Paywall darunter kann den Kauf
    // direkt fortsetzen — ohne den State (gewähltes Paket) zu verlieren.
    router.push("/auth-modal");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <LockIcon />

          <Text style={styles.title}>{t.title}</Text>

          <Text style={styles.body}>
            {t.body_prefix}
            {t.body_highlight ? (
              <>
                {" "}
                <Text style={styles.highlight}>{t.body_highlight}</Text>
              </>
            ) : null}
            {t.body_suffix ? <> {t.body_suffix}</> : null}
          </Text>

          <Text style={styles.hint}>{t.hint}</Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>{t.btn_primary}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeLink}>
            <Text style={styles.closeLinkText}>{t.close_link}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
    gap: 14,
  },
  title: {
    fontFamily: "Anton_400Regular",
    fontSize: 28,
    color: "#181716",
    letterSpacing: 1,
    marginTop: 4,
  },
  body: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#333",
    textAlign: "center",
    lineHeight: 22,
  },
  highlight: {
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fc6c14",
  },
  hint: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    lineHeight: 19,
  },
  buttons: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor: "#fc6c14",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 17,
    color: "#fff",
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  btnSecondaryText: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 17,
    color: "#181716",
    letterSpacing: 0.5,
  },
  closeLink: {
    paddingVertical: 4,
  },
  closeLinkText: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 13,
    color: "#aaa",
  },
});
