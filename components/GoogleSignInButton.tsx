import { useEffect, useState } from "react";
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import Svg, { Path } from "react-native-svg";
import { supabase } from "@/lib/supabase";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Auf iOS rendern wir den Button nicht: das native @react-native-google-signin
// SDK kollidiert mit Mapbox dynamic-framework + Expo SDK 55 precompiled
// modules (AppCheckCore Pod-Konflikt). Apple-Nutzer haben "Sign in with Apple"
// (Apple App Store erfordert es ohnehin) plus E-Mail/Passwort.
// Auf Android läuft der Flow unverändert.
const GOOGLE_SIGN_IN_SUPPORTED = Platform.OS === "android";

// WICHTIG: keinen statischen Import von @react-native-google-signin/google-signin
// — auf iOS wäre das Modul über expo.autolinking.ios.exclude vom Native-Link
// ausgeschlossen, der JS-Import würde aber trotzdem zum Crash beim Rendern
// führen (statusCodes etc. greifen auf fehlende Native-Bindings zu).
// Stattdessen dynamischer require() innerhalb der Android-only Code-Pfade.

/**
 * Nativer Google-Login (Android only) via Credential Manager.
 * Holt einen ID-Token von Google und tauscht ihn bei Supabase gegen eine Session
 * (signInWithIdToken). Anders als im Web gibt es hier KEINEN Redirect.
 *
 * webClientId MUSS die Web-OAuth-Client-ID sein – nicht die Android-ID.
 */
export default function GoogleSignInButton({
  onError,
  onSuccess,
}: {
  /** Wird mit einer benutzerlesbaren Fehlermeldung aufgerufen. */
  onError?: (message: string) => void;
  /** Wird nach erfolgreicher Supabase-Anmeldung aufgerufen. */
  onSuccess?: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  // configure() lokal im Effekt – nie auf Modulebene, damit ein fehlender
  // oder fehlerhafter nativer Modul-Zustand den Screen nicht zum Absturz bringt.
  useEffect(() => {
    if (!GOOGLE_SIGN_IN_SUPPORTED) return;
    if (!WEB_CLIENT_ID) {
      console.warn("GoogleSignInButton: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID fehlt.");
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleSignin } = require("@react-native-google-signin/google-signin");
      GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    } catch (e) {
      console.warn("GoogleSignInButton: configure() fehlgeschlagen.", e);
    }
  }, []);

  if (!GOOGLE_SIGN_IN_SUPPORTED) {
    return null;
  }

  const handlePress = async () => {
    if (!WEB_CLIENT_ID) {
      onError?.("Google-Anmeldung ist derzeit nicht verfügbar.");
      return;
    }
    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const gsi = require("@react-native-google-signin/google-signin");
      const { GoogleSignin, statusCodes, isErrorWithCode, isSuccessResponse } = gsi;

      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (!isSuccessResponse(response)) {
        // Nutzer hat den Dialog abgebrochen – keine Fehlermeldung nötig.
        return;
      }

      const idToken = response.data.idToken;
      if (!idToken) {
        onError?.("Kein Token von Google erhalten. Bitte erneut versuchen.");
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        onError?.("Anmeldung mit Google fehlgeschlagen. Bitte erneut versuchen.");
      } else {
        // Die Session wird global vom onAuthStateChange-Listener übernommen.
        onSuccess?.();
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const gsi = require("@react-native-google-signin/google-signin");
      const { statusCodes, isErrorWithCode } = gsi;
      const e = error as { code?: string };
      if (isErrorWithCode(error)) {
        if (e.code === statusCodes.IN_PROGRESS) {
          return; // Anmeldung läuft bereits.
        }
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          onError?.("Google Play-Dienste sind nicht verfügbar oder veraltet.");
          return;
        }
      }
      onError?.("Anmeldung mit Google fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, isLoading && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#181716" />
      ) : (
        <>
          <GoogleIcon />
          <Text style={styles.buttonText}>Mit Google fortfahren</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <Path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <Path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <Path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#181716",
    fontSize: 16,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
});
