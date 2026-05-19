import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthFlowStore } from "@/stores/authFlowStore";

/**
 * Ziel der Deep Links aus Bestätigungs- und Reset-E-Mails
 * (fairfuhrer://auth/callback?code=...&type=...).
 *
 * Tauscht den PKCE-Code gegen eine Session und leitet weiter:
 * - type=recovery  -> Passwort-Reset-Bildschirm (über authFlowStore)
 * - sonst (signup, email_change) -> App, Nutzer ist eingeloggt
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; type?: string }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const code = typeof params.code === "string" ? params.code : null;
      const type = typeof params.type === "string" ? params.type : null;

      if (!code) {
        if (!cancelled) setFailed(true);
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (cancelled) return;

      if (error) {
        setFailed(true);
        return;
      }

      if (type === "recovery") {
        useAuthFlowStore.getState().setPendingPasswordReset(true);
        router.replace("/(tabs)/profil");
      } else {
        // Bestätigung der Registrierung oder E-Mail-Änderung: Session reicht.
        router.replace("/(tabs)");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [params.code, params.type, router]);

  if (failed) {
    return (
      <View style={s.container}>
        <Text style={s.title}>Link ungültig oder abgelaufen</Text>
        <Text style={s.text}>
          Bitte fordere einen neuen Link an oder versuche es erneut.
        </Text>
        <TouchableOpacity style={s.button} onPress={() => router.replace("/(tabs)/profil")}>
          <Text style={s.buttonText}>Zur Anmeldung</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ActivityIndicator color="#fc6c14" />
      <Text style={s.text}>Einen Moment …</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Anton_400Regular",
    color: "#111",
    textAlign: "center",
  },
  text: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "FiraSansCondensed_400Regular",
  },
  button: {
    backgroundColor: "#111",
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fc6c14",
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
  },
});
