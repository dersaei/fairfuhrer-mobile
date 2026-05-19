import * as Linking from "expo-linking";

/**
 * Deep-Link-URL, an die Supabase nach E-Mail-Bestätigung oder Passwort-Reset
 * weiterleitet. In einem nativen Build ergibt das `fairfuhrer://auth/callback`
 * (Scheme aus app.json). Dieser Pfad wird in `app/_layout.tsx` abgefangen.
 *
 * Muss in der Supabase-Redirect-URL-Allowlist eingetragen sein (fairfuhrer://**).
 */
export function getAuthRedirectUrl(): string {
  return Linking.createURL("/auth/callback");
}
