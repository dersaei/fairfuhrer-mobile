import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, CustomerInfo, PURCHASES_ERROR_CODE } from "react-native-purchases";
import * as Sentry from "@sentry/react-native";
import { supabase } from "@/lib/supabase";

// ─── API keys ────────────────────────────────────────────────────────────────
// RevenueCat public SDK keys are safe to ship in the client, but we still
// load them from env (Doppler / Expo public env) so we never hard-code a
// production secret and so each platform / environment can use its own key.
//
// Order of resolution per platform:
//   1. Platform-specific public key  (EXPO_PUBLIC_RC_KEY_IOS / _ANDROID)
//   2. Generic test/dev key          (EXPO_PUBLIC_RC_KEY_TEST)
//   3. Hard-coded RC sandbox test key fallback (only for `expo start` /
//      detached dev clients without env wiring — RevenueCat's published
//      "test_" prefixed key is safe for development).
const FALLBACK_TEST_KEY = "test_xldOopxcqijWSVcxYwaAdxnykjl";

function resolveApiKey(): string {
  const iosKey = process.env.EXPO_PUBLIC_RC_KEY_IOS;
  const androidKey = process.env.EXPO_PUBLIC_RC_KEY_ANDROID;
  const testKey = process.env.EXPO_PUBLIC_RC_KEY_TEST;

  if (Platform.OS === "ios" && iosKey) return iosKey;
  if (Platform.OS === "android" && androidKey) return androidKey;
  if (testKey) return testKey;
  return FALLBACK_TEST_KEY;
}

// ─── Entitlement ────────────────────────────────────────────────────────────
// Stable ASCII identifier as the source of truth. Must match the entitlement
// configured in the RevenueCat dashboard. All 3 yearly products are mapped
// to this single entitlement on the dashboard side.
//
// Historically the codebase used the German label "Fairführer Pro" as the
// entitlement key. We keep both forms in `KNOWN_ENTITLEMENT_IDS` so an
// existing dashboard configuration with the legacy ID continues to grant
// premium until the dashboard is migrated to the canonical ASCII ID.
export const ENTITLEMENT_ID = "fairfuehrer_pro";
export const LEGACY_ENTITLEMENT_ID = "Fairführer Pro";
const KNOWN_ENTITLEMENT_IDS = [ENTITLEMENT_ID, LEGACY_ENTITLEMENT_ID];

// ─── Initialization ─────────────────────────────────────────────────────────

export function initializePurchases() {
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey: resolveApiKey() });
}

// ─── Identity ───────────────────────────────────────────────────────────────

/**
 * Verbindet den RevenueCat-Kunden mit der Supabase-user.id.
 *
 * WICHTIG: `logIn` überträgt einen anonym getätigten Kauf NICHT zuverlässig.
 * Ob der Kauf mitwandert, hängt vom Transfer-Behavior des RC-Projekts ab —
 * und laut RC-Doku unterbleibt die Übertragung ganz, wenn die Ziel-ID
 * bereits mit einem anonymen Alias existiert ("No merge or purchase
 * transfer occurs"). Dann bleibt der Beleg auf der anonymen ID liegen, die
 * `logIn` gleichzeitig unerreichbar macht: Der Store meldet beim erneuten
 * Kaufversuch "gehört dir bereits", die App zeigt aber "Kostenlos".
 *
 * Deshalb vergleichen wir den Entitlement-Status vor und nach dem Login und
 * holen den Kauf im Verlustfall per `restorePurchases()` zurück — das hängt
 * den Store-Beleg an die jetzt aktive App-User-ID.
 */
export async function identifyUser(userId: string) {
  try {
    const hadProBefore = hasPro(await Purchases.getCustomerInfo());
    const { customerInfo } = await Purchases.logIn(userId);
    if (!hadProBefore || hasPro(customerInfo)) return;
  } catch (e) {
    console.error("[RevenueCat] identifyUser error:", e);
    Sentry.captureException(e, { tags: { feature: "rc-identity" } });
    return;
  }

  console.warn("[RevenueCat] Entitlement nach logIn verloren — Restore wird versucht");
  Sentry.captureMessage("RC: entitlement lost on logIn, attempting restore", {
    level: "warning",
    tags: { feature: "rc-identity" },
  });

  try {
    const restored = await Purchases.restorePurchases();
    if (!hasPro(restored)) {
      // Kommt vor, wenn das RC-Projekt auf "Keep with original App User ID"
      // steht oder der Beleg einem anderen Store-Konto gehört. Dann hilft nur
      // noch Support / Dashboard — die App kann es nicht selbst reparieren.
      Sentry.captureMessage("RC: restore after logIn did not recover entitlement", {
        level: "error",
        tags: { feature: "rc-identity" },
      });
    }
  } catch (e) {
    console.error("[RevenueCat] restore after logIn error:", e);
    Sentry.captureException(e, { tags: { feature: "rc-identity" } });
  }
}

/**
 * Hängt vorhandene Store-Käufe an die aktuelle App-User-ID und meldet, ob
 * damit Premium aktiv ist. Wirft die RC-Fehler durch — Aufrufer entscheiden
 * über die Nutzermeldung.
 */
export async function restoreAndCheckPro(): Promise<boolean> {
  return hasPro(await Purchases.restorePurchases());
}

/**
 * Der Store kennt den Kauf schon, RevenueCat ordnet ihn aber der aktuellen
 * App-User-ID nicht zu. Genau der Fall, den ein Restore auflösen kann.
 */
export function isAlreadyOwnedError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  return (
    code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR ||
    code === PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR
  );
}

export async function setUserEmail(email: string | null | undefined) {
  if (!email) return;
  try {
    // Available since react-native-purchases 4.x; passes through to the
    // native SubscriberAttributes API.
    await Purchases.setEmail(email);
  } catch (e) {
    console.error("[RevenueCat] setUserEmail error:", e);
  }
}

export async function resetUser() {
  try {
    const info = await Purchases.getCustomerInfo();
    if (!info.originalAppUserId.startsWith("$RCAnonymous")) {
      await Purchases.logOut();
    }
  } catch (e) {
    console.error("[RevenueCat] resetUser error:", e);
  }
}

// ─── Customer info ──────────────────────────────────────────────────────────

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.error("[RevenueCat] getCustomerInfo error:", e);
    return null;
  }
}

export function hasPro(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return KNOWN_ENTITLEMENT_IDS.some((id) => id in customerInfo.entitlements.active);
}

export type CustomerInfoListener = (info: CustomerInfo) => void;

export function addCustomerInfoListener(listener: CustomerInfoListener): () => void {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    try {
      Purchases.removeCustomerInfoUpdateListener(listener);
    } catch (e) {
      console.error("[RevenueCat] removeCustomerInfoUpdateListener error:", e);
    }
  };
}

// ─── Web-Sync ───────────────────────────────────────────────────────────────
//
// Fordert die Supabase Edge Function `sync-my-premium` auf, den Premium-Status
// des eingeloggten Users mit RevenueCat abzugleichen und in
// `profiles.premium_until` zu schreiben. Notwendig, weil das rc-webhook
// KEIN Event für anonyme → identifizierte Merges bekommt: wenn ein Nutzer
// zuerst kauft und sich später registriert, würde die Web-App sonst nie
// erfahren, dass er Premium hat.
//
// Fire-and-forget: Fehler werden geloggt (Sentry), aber nicht dem Nutzer
// gezeigt — mobile funktioniert weiterhin dank lokalem RC-SDK.

export async function syncPremiumToWeb(): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("sync-my-premium", {
      method: "POST",
    });
    if (error) {
      Sentry.captureMessage("sync-my-premium invocation failed", {
        level: "warning",
        tags: { feature: "premium-sync" },
        extra: { message: error.message, context: (error as any).context },
      });
      return;
    }
    if (__DEV__) {
      console.log("[sync-my-premium] result:", data);
    }
  } catch (e) {
    Sentry.captureException(e, { tags: { feature: "premium-sync" } });
  }
}
