import { useState } from "react";
import { Platform, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "@/lib/supabase";

/**
 * Sign in with Apple – plattformspezifisch:
 *
 * - iOS: nativ über AppleAuthentication.signInAsync(), das einen identityToken
 *   liefert. Dieser wird via signInWithIdToken bei Supabase eingelöst.
 *   Vorteil: kein Browser-Wechsel, sicherer Nonce-Check, Apple-Standardbutton.
 *
 * - Android: Apple stellt kein natives SDK bereit. Wir starten den OAuth-Flow
 *   über signInWithOAuth(); Supabase leitet auf die Apple-Consent-Seite weiter,
 *   die wiederum auf die Web-Domain zurückkehrt. Damit der Token nicht doppelt
 *   verbraucht wird, läuft der Rückweg nicht direkt über fairfuhrer://, sondern
 *   über die Web-Bridge wie bei Reset-Passwort (sobald implementiert).
 *
 * Hinweis zu fullName: Apple liefert den vollen Namen NUR beim ersten Login.
 * Wir speichern ihn dann via updateUser ins user_metadata.
 */
export default function AppleSignInButton({ onError }: { onError?: (message: string) => void }) {
  const [isLoading, setIsLoading] = useState(false);

  // --- iOS: nativer Flow ---
  if (Platform.OS === "ios") {
    return (
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={6}
        style={styles.appleNativeButton}
        onPress={async () => {
          try {
            const credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });

            if (!credential.identityToken) {
              onError?.("Anmeldung mit Apple fehlgeschlagen. Bitte erneut versuchen.");
              return;
            }

            const { error } = await supabase.auth.signInWithIdToken({
              provider: "apple",
              token: credential.identityToken,
            });

            if (error) {
              onError?.("Anmeldung mit Apple fehlgeschlagen. Bitte erneut versuchen.");
              return;
            }

            // fullName kommt nur beim ALLERERSTEN Login – wenn vorhanden,
            // ins user_metadata speichern. Bei späteren Logins ist es null.
            if (credential.fullName) {
              const { givenName, familyName } = credential.fullName;
              const fullName = [givenName, familyName].filter(Boolean).join(" ");
              if (fullName) {
                await supabase.auth.updateUser({
                  data: {
                    full_name: fullName,
                    given_name: givenName ?? undefined,
                    family_name: familyName ?? undefined,
                  },
                });
              }
            }
          } catch (e) {
            // ERR_REQUEST_CANCELED = Nutzer hat den Dialog abgebrochen, kein Fehler.
            const code = (e as { code?: string })?.code;
            if (code !== "ERR_REQUEST_CANCELED") {
              onError?.("Anmeldung mit Apple fehlgeschlagen. Bitte erneut versuchen.");
            }
          }
        }}
      />
    );
  }

  // --- Android: OAuth-Flow im Browser ---
  const handlePress = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}/callback?next=/konto`,
        },
      });
      if (error) {
        onError?.("Anmeldung mit Apple fehlgeschlagen. Bitte erneut versuchen.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.androidButton, isLoading && styles.androidButtonDisabled]}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <AppleIcon />
          <Text style={styles.androidButtonText}>Mit Apple fortfahren</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function AppleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        fill="#fff"
        d="M14.04 13.84c-.23.53-.5 1.03-.81 1.48-.43.62-.78 1.05-1.05 1.29-.41.38-.86.58-1.34.59-.34 0-.76-.1-1.24-.29-.49-.2-.94-.29-1.35-.29-.43 0-.89.1-1.39.29-.5.2-.9.3-1.21.31-.46.02-.92-.18-1.37-.6-.29-.26-.66-.7-1.1-1.34-.48-.68-.87-1.46-1.18-2.36-.33-.97-.5-1.91-.5-2.82 0-1.04.22-1.94.67-2.69.36-.6.83-1.08 1.43-1.43.59-.35 1.23-.53 1.92-.54.36 0 .84.11 1.43.33.59.22.97.34 1.14.34.13 0 .55-.13 1.27-.4.68-.25 1.25-.35 1.71-.31 1.25.1 2.2.6 2.82 1.5-1.12.68-1.67 1.63-1.66 2.85.01.95.36 1.74 1.04 2.37.31.29.65.52 1.03.68-.08.24-.17.47-.26.69ZM11.62 1.27c0 .77-.28 1.5-.85 2.16-.68.79-1.51 1.25-2.41 1.18-.01-.09-.02-.19-.02-.29 0-.74.32-1.54.9-2.18.29-.32.65-.59 1.1-.81.44-.21.86-.33 1.26-.35.01.1.02.2.02.3Z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  appleNativeButton: {
    width: "100%",
    height: 52,
  },
  androidButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    height: 52,
    backgroundColor: "#000",
    borderRadius: 6,
    paddingHorizontal: 14,
  },
  androidButtonDisabled: {
    opacity: 0.5,
  },
  androidButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
});
