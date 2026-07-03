import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Helper autoryzacji dla wywolan web API z mobile.
//
// Web endpointy (fairfuhrer/app/api/*) uzywaja `lib/api-auth.ts` ktory
// akceptuje DWA modele auth:
//   1. Bearer token w headerze `Authorization: Bearer <token>` — MY (mobile)
//   2. Cookies (fallback) — web SSR
//
// Mobile ma Supabase session token z SDK. Wyciagamy access_token i budujemy
// header do wyslania w kazdym fetch do web API.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Zwraca headers z Bearer token do wyslania na web API.
 * Jesli brak sesji (user niezalogowany), zwraca headers bez Authorization.
 * Web endpoint zwroci wtedy 401.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

/**
 * Wrapper na fetch do web API — automatycznie dodaje Bearer token.
 * Uzywac zamiast `fetch()` dla wszystkich wywolan na EXPO_PUBLIC_SITE_URL.
 *
 * @example
 * const res = await apiFetch("/api/redaktion", {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify({ ... }),
 * });
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiUrl = process.env.EXPO_PUBLIC_SITE_URL;
  if (!apiUrl) {
    throw new Error("EXPO_PUBLIC_SITE_URL nie ustawiony");
  }

  const authHeaders = await getAuthHeaders();
  const url = path.startsWith("http") ? path : `${apiUrl}${path}`;

  return fetch(url, {
    ...init,
    headers: {
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
  });
}
