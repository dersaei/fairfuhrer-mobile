# Release B.2 — Pin Gating & Vorschlags-Flow

**Status:** SPEC (nie implementacja)
**Data:** 2026-07-02
**Docelowa wersja:** 1.2.0 (mobile) + odpowiedni sync w web (partner_page_content itd.)

---

## 1. Cel biznesowy

Wprowadzić **różnicowanie uprawnień do tworzenia pinów** wg roli użytkownika i kategorii pinu:

- **Sehenswertes** (turystyczne atrakcje) — **redakcyjne**, zawsze free dla wszystkich do konsumpcji, tworzone tylko przez redakcję (nie przez usera).
- **Komercyjne kategorie** (Essen & Übernachten, Einkaufen, Engagement, Unternehmen) — mogą być tworzone przez **Partnerów** (płatne — patrz cennik z Voraussetzungen) lub sugerowane przez **Reisender** dla redakcji.

To fundament modelu przychodowego. Partner płaci za widoczność swojego biznesu; Reisender premium nie może obejść tego tworząc "za darmo" komercyjny pin — tylko sugeruje.

---

## 2. Model uprawnień

### 2.1 Role użytkownika (dziś istniejące)

| Rola | Skąd wynika | Widoki | Może tworzyć piny? |
|------|-------------|--------|-------------------|
| **Guest** (niezalogowany) | brak konta | Karte + Liste + Tour (Sehenswertes 20% cap) | Nie |
| **Reisender free** | zarejestrowany, bez RC subscription | Karte + Liste + Tour (Sehenswertes 20% cap) | Sugestia tylko |
| **Reisender premium** | zarejestrowany + `isPro=true` z RevenueCat | Karte + Liste + Tour (100% Sehenswertes, offline mapa, ...) | Sugestia tylko |
| **Partner** | zarejestrowany + `partner_profile` w Supabase | To co Reisender free + panel Partner na web | Tak, w kategoriach komercyjnych, po opłacie |

**Kluczowe rozstrzygnięcie z poprzedniej sesji (potwierdzone):** Reisender premium **NIE MOŻE** tworzyć komercyjnych pinów jak Partner. Może tylko sugerować redakcji.

### 2.2 Matrix uprawnień × kategoria

Kolumny = kategoria pinu. Wiersze = rola.

|  | Sehenswertes | Essen&Übernachten | Einkaufen | Engagement | Unternehmen |
|---|---|---|---|---|---|
| **Guest** | konsumpcja (20% cap) | konsumpcja | konsumpcja | konsumpcja | konsumpcja |
| **Reisender free** | konsumpcja (20% cap) + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** |
| **Reisender premium** | konsumpcja (100%) + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** |
| **Partner** | konsumpcja (20% cap) + **sugestia** | konsumpcja + **własne piny** | konsumpcja + **własne piny** | konsumpcja + **własne piny** | konsumpcja + **własne piny** |

**Uwaga:** Sehenswertes nigdy nie ma "własnych pinów" — tylko sugestia (redakcja decyduje). Dlatego premium Reisender przy sugestii Sehenswertes jest równorzędny z free.

### 2.3 Sugestia vs. własny pin — różnica

- **Sugestia** — trafia do `ort_vorschlaege` (lub nowej kolekcji `pin_vorschlaege` — patrz sekcja 4). Redakcja weryfikuje, tworzy w Directus prawdziwy pin w `Orte` z metadata redakcyjnym (Titelbild + Audio + Text). Sugerujący nie widzi swojego pinu dopóki redakcja go nie zaakceptuje.
- **Własny pin (Partner)** — trafia do `Orte` bezpośrednio (status: `draft`) + wypełnia bogatsze pola (link, telefon, galeria 6 zdjęć, własne audio, zertifizierungen). Redakcja tylko akceptuje (status: `published`), nie tworzy contentu.

---

## 3. Multiple pins per Partner

**Decyzja do potwierdzenia z Miriam** (spec: **rekomendacja moja: A**):

- **A** — Partner może stworzyć **wiele pinów** za jedną opłatę. Powód: mały biznes ma 1 pin (kawiarnia), duży ma 3-4 (hotel + restauracja + ogród + spa). Cennik już to uwzględnia (Kleinstunternehmen 50€ / kleinerbetrieb 100€ / mittelbetrieb 200€) — im większy biznes tym więcej pinów.
- **B** — 1 pin = 1 opłata, dodatkowe piny płatne osobno.
- **C** — Cap per tier: gemeinnützig 1 pin, Kleinstunternehmen 2 piny, klein 5, mittel 10.

**Rekomendacja A** — cennik już rozróżnia wielkość biznesu, więc jest wliczone w "za dużego biznesu płacisz więcej". Prościej dla Partnerów, mniej micro-management dla redakcji.

**Techniczne konsekwencje A:** `partner_profiles.Ort` (obecnie potencjalnie 1:1) staje się 1:N. Trzeba refactor — patrz sekcja 4.

---

## 4. Zmiany w danych (Directus / Supabase)

### 4.1 Directus `Kategorie` — nowe pole `Typ`

Dodać enum: `redaktion` | `kommerziell`. Ustawić:
- Sehenswertes (id=1) → `redaktion`
- Essen & Übernachten (id=2) → `kommerziell`
- Einkaufen (id=3) → `kommerziell`
- Engagement (id=5) → `kommerziell`
- Unternehmen (id=8) → `kommerziell`

**Powód:** eliminuje hardcoded ID w kodzie (obecnie `EXPO_PUBLIC_SIGHTS_CATEGORY_ID`), pozwala redakcji dodawać nowe kategorie bez zmiany kodu.

### 4.2 Directus `ort_vorschlaege` — rozszerzenie o kategorię

Obecnie zawiera: `Name_des_Ortes`, `Adresse`, `Beschreibung`, `Benutzername`, `Eingereicht_von_Email`, `Vorname`, `Nachname`.

Dodać:
- `Kategorie_id` (M2O do `Kategorie`) — jaka kategoria (Reisender wybiera z listy)
- `Rolle_Einreicher` (string enum: `reisender_free`, `reisender_premium`, `partner`) — dla redakcji info kto to zgłosił
- `Priorität` (integer) — automatyczne: premium user = 2, free = 1 (redakcja sortuje)

### 4.3 Directus `Orte` — nowe pola dla Partner submissions

Piny Partnera lądują w `Orte` bezpośrednio ze `status: draft`. Trzeba:
- `submitted_by_partner_id` (M2O do `partner_profiles` w Supabase, przez UUID) — kto zgłosił
- `submitted_at` (timestamp) — kiedy
- `partner_status` (enum: `draft`, `pending_review`, `active`, `expired`) — cykl życia
- `expires_at` (timestamp) — 12 miesięcy od `submitted_at` (per Voraussetzungen)

### 4.4 Supabase `partner_profiles` — brak zmian schematu, tylko RLS

RLS policy: Partner może `INSERT` do `Orte` **tylko** dla kategorii `kommerziell`. Sehenswertes zawsze redakcja. Weryfikacja przez Supabase Edge Function (bo Directus jest source of truth dla `Orte`).

**Alternatywa techniczna:** submit idzie przez custom Directus endpoint (Directus flow lub extension) który weryfikuje uprawnienia. To czystsze niż RLS na tabelach cross-service.

**Decyzja do zbadania:** wolisz Supabase RPC (kontrolujemy w kodzie web + mobile) czy Directus flow (kontrolujemy w Directus)?

---

## 5. UX — mobile flow

### 5.1 Zmiany w OrtVorschlagenSection (`components/profil/OrtVorschlagenSection.tsx`)

**Obecny stan (do refactoru):** premium-only formularz, brak wyboru kategorii, hardcoded 3 pola (name, address, description).

**Nowy stan:**

- Formularz **dostępny dla każdego zalogowanego** (free i premium), nie tylko premium
- Dodać **selektor kategorii** (5 opcji z Directus)
- Guest → CTA "Zaloguj się aby proponować" (link do auth)
- Reisender → formularz sugestii (idzie do `ort_vorschlaege`)
- Partner → **inna sekcja** "Neuen Pin einreichen" z bogatszym formularzem (patrz 5.2)

**Copy zmiana** (Directus `ort_vorschlagen_content`):
- Usunąć `premium_info` (bo teraz dla wszystkich)
- Dodać `category_label` = "Kategorie"
- Dodać `category_hint` = "Wähle die passende Kategorie für deinen Vorschlag"

### 5.2 Nowa sekcja "Neuer Pin" dla Partner (`components/profil/PartnerPinSection.tsx`)

**Widoczna tylko** gdy user ma `partner_profile` w Supabase.

Pola formularza:
- **Kategorie** (M2O do `Kategorie`, filter: `Typ = kommerziell`) — Partner nie może wybrać Sehenswertes
- **Name des Ortes**
- **Adresse** (street + city — pole `Stadt` jak w Orte)
- **Kurzbeschreibung** (~500 znaków, na potrzeby audio)
- **Link_URL** + **Telefon** (opcjonalne)
- **Titelbild** — upload (Directus files)
- **Galerie** — upload 0-6 zdjęć

Po submit → INSERT do `Orte` ze `status: draft` + `partner_status: pending_review`.
Redakcja dostaje email/notification.

### 5.3 Selektor "Twoje piny" (lista własnych)

Nowy ekran w Profil → "Meine Pins" (tylko dla Partner). Lista pinów Partnera z badge statusu:
- 🟡 W trakcie weryfikacji
- 🟢 Aktywny (do daty expires_at)
- 🔴 Wygasł (odnów subskrypcję)

### 5.4 Paywall check

Zanim Partner może wypełnić formularz "Neuer Pin":
1. Sprawdź czy ma aktywny plan Partnera (nowy scope RevenueCat: `partner_active`, różny od reisender `pro`)
2. Jeśli nie ma → paywall Partner (nowy content w Directus `paywall_partner_content`)
3. Jeśli ma → formularz

**RevenueCat entitlement (do dodania):** `partner_active` = boolean, TTL 12 miesięcy per plan.

---

## 6. Backend validation (Anti-cheat)

**Ważne:** client-side gating można obejść (edytując bundle). Musimy zweryfikować **na backendzie** że:

1. Kategoria jest `kommerziell` (Partner nigdy nie robi Sehenswertes)
2. User ma aktywny `partner_active` entitlement RC (weryfikacja przez RC webhook / cache Supabase)
3. Reisender sugestia lecąca do `Orte` bezpośrednio jest odrzucana (musi iść przez `ort_vorschlaege`)

**Implementacja:** Directus flow "Verify Partner Submission" wykonuje się na hook `items.Orte.create` — sprawdza fields, blokuje jeśli warunki nie spełnione.

---

## 7. Kolejność implementacji

Zaproponowany podział na 4 sub-releasy, każdy testowalny inkrementalnie:

### B.2.1 — Fundament danych (Directus)
- Dodać `Kategorie.Typ` (redaktion/kommerziell)
- Rozszerzyć `ort_vorschlaege` o `Kategorie_id`, `Rolle_Einreicher`, `Priorität`
- Rozszerzyć `Orte` o `partner_status`, `expires_at`, `submitted_by_partner_id`
- Zmiana `placesStore.isSightsCategory` — czytaj z `Typ`, nie z env override
- **Test:** widoki na mapie/liście dalej działają, gating Sehenswertes nadal działa

### B.2.2 — Formularz sugestii dla wszystkich (Reisender)
- Refactor `OrtVorschlagenSection.tsx` — usunąć premium-gate, dodać selektor kategorii
- `useSubmitPlaceProposal.ts` — przesyła `kategorie_id` i `rolle_einreicher`
- Guest handling — CTA do auth
- Success/error copy w Directus
- **Test:** free user może zaproponować pin, sugestia ląduje w `ort_vorschlaege` z kategorią

### B.2.3 — Formularz Partner Pin
- Nowy komponent `PartnerPinSection.tsx`
- Nowy hook `useSubmitPartnerPin.ts`
- RevenueCat `partner_active` entitlement
- Nowy content w Directus `partner_pin_form_content`
- Paywall Partner (jeśli nie ma entitlement)
- Directus flow "Verify Partner Submission"
- **Test:** Partner z aktywnym subskrypcją tworzy pin, redakcja widzi w `Orte` draft

### B.2.4 — "Meine Pins" dla Partnera + lifecycle
- Nowy ekran `app/(tabs)/profil` → "Meine Pins"
- Wyświetlanie z badge statusu
- Powiadomienia o zbliżającym się wygaśnięciu (30 dni przed)
- Flow renewal — link do paywall
- **Test:** Partner widzi swoje piny, dostaje maila 30 dni przed expires

---

## 8. Wpływ na inne moduły

- **RevenueCat:** nowy plan Partner (osobny SKU) → RC dashboard config
- **Web app (fairfuhrer/):** panel Partner musi obsługiwać ten sam flow (nie tylko mobile). To osobny release albo integralna część B.2.
- **Sentry:** dodać breadcrumb `submit.category` żeby móc debugować odrzucone submissions

---

## 9. Ryzyka i otwarte pytania

### Otwarte pytania — czekają na decyzję

1. **Multiple pins per Partner** — A, B czy C z sekcji 3? Moja rekomendacja A.
2. **Backend validation** — Supabase RPC czy Directus flow? Moja skłonność: Directus flow (bo Orte to Directus source of truth).
3. **Web app synchronizacja** — czy B.2 obejmuje też web panel Partnera, czy web to osobny release?
4. **RevenueCat**: nowy SKU dla Partner czy reuse istniejącego? Miriam ma preferencję?

### Zidentyfikowane ryzyka

- **R1: RC entitlement race condition** — user kupuje plan Partnera, cache jeszcze mówi `partner_active: false`, submit odrzucony. Mitigacja: force refresh RC customer info przed submit.
- **R2: Migracja istniejących pinów** — 700+ pinów w `Orte`, żaden nie ma `partner_status`. Trzeba migration script "wszystko istniejące = `status: active`, `submitted_by_partner_id: null`, `expires_at: null` (redakcyjne)".
- **R3: Regresja gating** — zmiana `isSightsCategory` z env-based na field-based może zepsuć obecny 20% cap. Trzeba dodać feature flag / staging test.
- **R4: Copy w Directus** — B.2 wymaga sporo nowego contentu (paywall Partner, form labels, hint text). Miriam musi to napisać zanim wypuścimy.

---

## 10. Kryteria akceptacji (per sub-release)

**B.2.1:** Wszystkie widoki działają jak przed. `isSightsCategory` czyta z Directus `Typ`, nie z env. Migration `partner_status: null` na istniejących pinach nie łamie gating.

**B.2.2:** Reisender free może wysłać sugestię pinu z kategorii komercyjnej. Kategoria jest widoczna dla redakcji w `ort_vorschlaege`. Guest widzi CTA do login.

**B.2.3:** Partner z aktywnym RC entitlement tworzy pin z kategorii komercyjnej z pełnym setem pól. Bez entitlement widzi paywall. Bez podanego kategorii `kommerziell` (próba wybrać Sehenswertes) — UI blokuje.

**B.2.4:** Partner widzi listę swoich pinów w profil. Piny z `partner_status: expired` mają badge i CTA "Erneuern".

---

## 11. Poza zakresem B.2 (na kolejne releasy)

- **Analytics Partnera** — statystyki odsłuchań/kliknięć per pin. To B.4+.
- **Płatność za pin per unit** (opcja B z sekcji 3) — na razie A.
- **Redakcyjne review workflow w Directus** (batch approve) — Miriam potrzebuje po testach realnego ruchu.
- **Auto-audio generation dla Partner pins** — Miriam chciała eventualnie (TTS), poza zakresem B.

---

## 12. Estymacja (moja subiektywna, mobile-only)

| Sub-release | Days work | Ryzyko |
|---|---|---|
| B.2.1 (fundament) | 1 | Niskie |
| B.2.2 (Reisender sugestia) | 1-1.5 | Niskie |
| B.2.3 (Partner form + paywall + validation) | 2-3 | Wysokie (RC + validation logic) |
| B.2.4 (Meine Pins + lifecycle) | 1.5 | Średnie |

Web app równolegle: **+2-3 dni** dla panelu Partner (osobny release albo integralna część).

Razem: **~5-8 dni roboczych mobile** + web osobno.

Nie jest to szacunek dla Ciebie/mnie — to informacja jak duży scope. Robimy inkrementalnie, po jednym sub-release, z testami Miriam między każdym.

---

## 13. Decyzje do potwierdzenia z Miriam PRZED implementacją

Zanim zaczniemy B.2.1, muszą być decyzje na:

1. ✅ **Pricing model** — Reisender premium NIE robi komercyjnych pinów (potwierdzone wcześniej)
2. ❓ **Multiple pins per Partner** (sekcja 3, A/B/C)
3. ❓ **Partner subscription SKU** — nowy plan czy uzupełnienie istniejącego?
4. ❓ **Sehenswertes suggestion** — czy Reisender sugerujący Sehenswertes ma **osobny formularz** (bo tam nie ma "sponsor" pól typu link/telefon)? Rekomendacja: **wspólny formularz**, kategoria decyduje jakie pola są wymagane.
5. ❓ **Web panel Partner** — czy w B.2 czy w osobnym releasie B.5?

---

## Appendix A — Diagram flow submissions

```
┌──────────────────┐
│    User type?    │
└──────────────────┘
         │
    ┌────┴─────┬────────────┬──────────┐
    │          │            │          │
  Guest    Reisender    Reisender    Partner
   │        free         premium       │
   │          │            │           │
   │          └────────────┘           │
   │                │                  │
   ▼                ▼                  ▼
[Login CTA]  [Sugestia formularz]  [Partner Pin formularz]
                    │                  │
                    │                  ├─ Kategorie kommerziell only
                    │                  ├─ Titelbild + Audio + Gallery
                    │                  └─ Link + Telefon + Zertifikate
                    ▼                  ▼
             ort_vorschlaege    Orte (status: draft)
                    │                  │
                    ▼                  ▼
              Redakcja           Redakcja
              tworzy             akceptuje
              w Orte             (status: published)
```

## Appendix B — Kolekcja / tabelka zmian

| Kolekcja | Dodane pola | Zmiana |
|---|---|---|
| `Kategorie` (Directus) | `Typ` (enum) | — |
| `ort_vorschlaege` (Directus) | `Kategorie_id`, `Rolle_Einreicher`, `Priorität` | — |
| `Orte` (Directus) | `submitted_by_partner_id`, `submitted_at`, `partner_status`, `expires_at` | — |
| `partner_profiles` (Supabase) | — | RLS: může INSERT do Orte |
| RevenueCat | — | Nowy entitlement `partner_active` |
| `paywall_partner_content` (Directus, NOWY) | Wszystkie pola | Nowa kolekcja singleton |
| `partner_pin_form_content` (Directus, NOWY) | Wszystkie pola | Nowa kolekcja singleton |

## Appendix C — Środowiskowe zmienne do dodania

- `EXPO_PUBLIC_RC_PARTNER_ENTITLEMENT_ID` — nazwa entitlement RC dla Partner
- `EXPO_PUBLIC_RC_PARTNER_OFFERING_ID` — offering ID dla plan Partnera (opcjonalne, może być default)

Usunąć po B.2.1:
- `EXPO_PUBLIC_SIGHTS_CATEGORY_ID` — zastąpione przez Directus `Kategorie.Typ`
