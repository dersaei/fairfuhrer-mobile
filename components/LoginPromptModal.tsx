import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import Svg, { Path, Circle } from "react-native-svg";

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

  const handleLogin = () => {
    onClose();
    router.push("/(tabs)/profil");
  };

  const handleRegister = () => {
    onClose();
    router.push("/(tabs)/profil");
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

          <Text style={styles.title}>Fairführer+</Text>

          <Text style={styles.body}>
            Dieser Audiopin ist Teil unserer Premium-Kollektion. Um ihn
            freizuschalten, erstelle ein kostenloses Konto und upgrade auf{" "}
            <Text style={styles.highlight}>Fairführer+</Text> in der App.
          </Text>

          <Text style={styles.hint}>
            Du hast bereits ein Konto? Melde dich an und kaufe Fairführer+ im
            Bereich „Mein Konto".
          </Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleLogin}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>Zum Profil &amp; Anmelden</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeLink}>
            <Text style={styles.closeLinkText}>Vielleicht später</Text>
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
