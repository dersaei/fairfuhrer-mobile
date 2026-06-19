import { createDirectus, rest, staticToken, readSingleton, readItems } from "@directus/sdk";

const directusUrl = process.env.EXPO_PUBLIC_DIRECTUS_URL!;
const directusToken = process.env.EXPO_PUBLIC_DIRECTUS_TOKEN!;

export const directus = createDirectus(directusUrl).with(staticToken(directusToken)).with(rest());

// ─── DEBUG: CMS-Inhalt vs. Fallback ──────────────────────────────────────────
// Temporäre Logs zum Prüfen, ob Texte aus Directus geladen werden oder auf den
// Code-Fallback zurückfallen. TODO: nach dem Verifizieren wieder entfernen.
const DEBUG_CMS = __DEV__;

function logCms(name: string, ok: boolean, extra?: unknown) {
  if (!DEBUG_CMS) return;
  if (ok) {
    console.log(`[CMS] ✅ ${name}: aus Directus geladen`, extra ?? "");
  } else {
    console.warn(`[CMS] ⚠️ ${name}: FALLBACK (kein Directus-Inhalt)`, extra ?? "");
  }
}

// Einmaliger Hinweis, ob die Directus-Env-Variablen überhaupt im Bundle sind.
if (DEBUG_CMS) {
  console.log(
    `[CMS] ENV → URL: ${directusUrl ? "gesetzt" : "FEHLT"} · Token: ${directusToken ? "gesetzt" : "FEHLT"}`,
  );
}

// ========================================
// Premium-Seite / Kontaktformular (gemeinsame Inhalte mit der Web-App)
// ========================================

export interface PremiumPageContent {
  title?: string;
  lead_text?: string;
  pro_active_title?: string;
  pro_active_date_label?: string;
  pro_active_hint?: string;
  comparison_title?: string;
  comparison_th_feature?: string;
  comparison_th_free?: string;
  comparison_th_pro?: string;
  app_box_title?: string;
}

export interface PremiumComparisonFeature {
  id: number;
  feature: string;
  free: boolean;
  pro: boolean;
}

export interface AccountContactFormContent {
  title?: string;
  lead_text?: string;
  label_absender?: string;
  label_betreff?: string;
  label_nachricht?: string;
  button_text?: string;
  success_message?: string;
  error_message?: string;
  validation_message?: string;
}

export async function getPremiumPageContent(): Promise<PremiumPageContent | null> {
  try {
    const data = await directus.request(
      readSingleton("premium_page_content" as any, { fields: ["*"] }),
    );
    logCms("premium_page_content", !!data);
    return (data as PremiumPageContent) ?? null;
  } catch (e) {
    logCms("premium_page_content", false, e);
    return null;
  }
}

export async function getPremiumComparisonFeatures(): Promise<PremiumComparisonFeature[]> {
  try {
    const data = await directus.request(
      readItems("premium_comparison_features" as any, {
        filter: { status: { _eq: "published" } },
        sort: ["sort"],
        fields: ["id", "feature", "free", "pro"],
      }),
    );
    logCms(
      "premium_comparison_features",
      Array.isArray(data) && data.length > 0,
      `${(data as unknown[])?.length ?? 0} Einträge`,
    );
    return (data as PremiumComparisonFeature[]) ?? [];
  } catch (e) {
    logCms("premium_comparison_features", false, e);
    return [];
  }
}

export async function getAccountContactFormContent(): Promise<AccountContactFormContent | null> {
  try {
    const data = await directus.request(
      readSingleton("account_contact_form_content" as any, { fields: ["*"] }),
    );
    logCms("account_contact_form_content", !!data);
    return (data as AccountContactFormContent) ?? null;
  } catch (e) {
    logCms("account_contact_form_content", false, e);
    return null;
  }
}

export interface OrtVorschlagenContent {
  intro?: string;
  premium_info?: string;
  label_name?: string;
  label_adresse?: string;
  label_beschreibung?: string;
  button_text?: string;
  hint_intro?: string;
  hint_with_name?: string;
  hint_without_name?: string;
  success_message?: string;
}

export async function getOrtVorschlagenContent(): Promise<OrtVorschlagenContent | null> {
  try {
    const data = await directus.request(
      readSingleton("ort_vorschlagen_content" as any, { fields: ["*"] }),
    );
    logCms("ort_vorschlagen_content", !!data);
    return (data as OrtVorschlagenContent) ?? null;
  } catch (e) {
    logCms("ort_vorschlagen_content", false, e);
    return null;
  }
}

// ========================================
// Offline-Karten-Sektion (nur Mobile)
// ========================================

export interface OfflineKartenContent {
  section_title?: string;
  section_hint?: string;
  premium_info_title?: string;
  premium_info_text1?: string;
  premium_info_text2?: string;
  premium_info_bullets?: string;
  premium_info_text3?: string;
  pack_badge_available?: string;
  pack_meta_region?: string;
  pack_note?: string;
  pack_size_info?: string;
  btn_download?: string;
  btn_refresh?: string;
  btn_delete?: string;
  warn_outdated?: string;
  medien_title?: string;
  medien_meta?: string;
  medien_label_fotos?: string;
  medien_label_audio?: string;
}

export async function getOfflineKartenContent(): Promise<OfflineKartenContent | null> {
  try {
    const data = await directus.request(
      readSingleton("offline_karten_content" as any, { fields: ["*"] }),
    );
    logCms("offline_karten_content", !!data);
    return (data as OfflineKartenContent) ?? null;
  } catch (e) {
    logCms("offline_karten_content", false, e);
    return null;
  }
}

// ========================================
// Paywall-/Premium-Kaufbildschirm (nur Mobile)
// ========================================

export interface PaywallContent {
  hero_eyebrow?: string;
  hero_headline?: string;
  hero_subtitle?: string;
  features?: { text: string }[];
  package_small_label?: string;
  package_small_sub?: string;
  package_fair_label?: string;
  package_fair_sub?: string;
  package_large_label?: string;
  package_large_sub?: string;
  popular_badge?: string;
  cta_prefix?: string;
  restore_text?: string;
  legal_link_terms?: string;
  legal_link_privacy?: string;
}

export async function getPaywallContent(): Promise<PaywallContent | null> {
  try {
    const data = await directus.request(readSingleton("paywall_content" as any, { fields: ["*"] }));
    logCms("paywall_content", !!data);
    return (data as PaywallContent) ?? null;
  } catch (e) {
    logCms("paywall_content", false, e);
    return null;
  }
}
