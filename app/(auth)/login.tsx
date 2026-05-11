import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import MenuButton from "@/components/MenuButton";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    setIsLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError("E-Mail oder Passwort ist falsch.");
    }
    setIsLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Górny pasek — tylko Zurück i hamburger */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <View style={styles.headerBtn}>
          <MenuButton />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <Text style={styles.title}>Anmelden</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder="E-Mail"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Passwort"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Anmelden</Text>
          )}
        </TouchableOpacity>

        <Link href="/(auth)/passwort-vergessen" style={styles.linkSecondary}>
          Passwort vergessen?
        </Link>

        <Link href="/(auth)/register" style={styles.link}>
          Noch kein Konto? Registrieren
        </Link>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 24,
    color: "#181716",
    lineHeight: 28,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 14,
  },
  title: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 26,
    color: "#181716",
    textAlign: "center",
    marginBottom: 4,
  },
  error: {
    color: "#c0392b",
    fontSize: 14,
    textAlign: "center",
    backgroundColor: "#fdecea",
    padding: 10,
    borderRadius: 8,
    fontFamily: "FiraSansCondensed_400Regular",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#181716",
    backgroundColor: "#fafafa",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  button: {
    backgroundColor: "#181716",
    paddingVertical: 15,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  link: {
    textAlign: "center",
    color: "#fc6c14",
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    marginTop: 4,
  },
  linkSecondary: {
    textAlign: "center",
    color: "#999",
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
  },
});
