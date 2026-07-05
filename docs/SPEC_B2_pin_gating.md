# Release B.2 — Pin Gating & Vorschlags-Flow

> ⚠️ **STATUS 2026-07-05: NIEAKTUALNY (do przerobki v5)**
>
> Ort-vorschlagen (prosty formularz sugestii dla kategorii komercyjnych)
> zostało **usunięte z produktu** (repo + Directus) po wiadomości Miriam
> z 2026-07-03 potwierdzającej wizję Franka: *"One thing Frank definitely
> does not want is a feature where users can only suggest a place."*
>
> W tym dokumencie **Flow A (prosty formularz sugestii → `/api/ort-vorschlagen`)
> NIE OBOWIĄZUJE**. Cały opis "OrtVorschlagenSection", `useSubmitPlaceProposal`,
> `ort_vorschlaege` collection, `/api/ort-vorschlagen` route — pliki i endpointy
> już nie istnieją.
>
> **Co zostaje aktualne:** ogólna filozofia gatingu Sehenswertes (teraz 50 %
> nie 20 %), rozróżnienie Sehenswertes vs kategorie komercyjne, koncept
> Redaktion.
>
> **Nowy model (do doprecyzowania po odpowiedzi Miriam na pytania z 2026-07-03):**
> Redaktion widzi Sehenswertes-Pin form (istnieje, live) oraz — być może —
> Partner-Pin form w imieniu biznesu. Reisender bez konta lub z kontem?
> Sehenswertes 50 % free / 100 % Fairführer+. Grace period po expired
> subscription — czekamy na Franka.
>
> Patrz: `project_miriam_pending_answer_2026_07_03` w memory index.

**Status:** SPEC v4 (po ustaleniach z Konradem — dwa Reisender flowy + moderacja wszystkich)
**Data aktualizacji:** 2026-07-02
**Docelowa wersja:** 1.2.0 (mobile) + drobny sync w web

**Historia zmian:**
- v1 (2026-07-02 rano) — pierwsza wersja
- v2 (2026-07-02 popołudnie) — integracja review agenta (8 uwag)
- v3 (2026-07-02 wieczór) — integracja rundy 2 review + odkrycie istniejącego web Partner flow
- **v4 (2026-07-02 późne popołudnie) — korekta modelu uprawnień + moderacja:**
  - **Reisender może TWORZYĆ Sehenswertes-piny bezpośrednio (pełny formularz, free, unlimited)** — nie sugerować. Sehenswertes = redakcyjne, ale Reisender może być twórcą contentu.
  - **Reisender dla kategorii komercyjnych → tylko sugestia** (prosty formularz jak dziś).
  - **UI mobile: Reisender najpierw wybiera kategorię, potem widzi odpowiedni formularz** (Sehenswertes → pełny, komercyjne → prosty).
  - **Wszystkie piny i sugestie przechodzą moderację** (`Bearbeitungsstatus: ausstehend` domyślnie). To zmienia obecne zachowanie `audiopin/route.ts:92` gdzie premium Partner → od razu `veroeffentlicht`. Wymaga refactoru web endpointu.
  - Otwarte pytania do Miriam: multiple pins per Partner, grace period, czy Partner może za darmo tworzyć Sehenswertes.

**v3 zawierało (zachowane):**
- Odkrycie że `audiopin/route.ts` implementuje ~80% Partner-pin flow
- B.2.3 obniżone z 2-3 dni na 1 dzień (reuse web endpoint)
  - **🔴 KLUCZOWE: `fairfuhrer/app/api/audiopin/route.ts` + `[id]/route.ts` już istnieją** i implementują ~80% B.2.3 — Partner-pin flow działa w web. B.2.3 to port do mobile, nie budowa od zera. Estymacja B.2.3 obniżona z 2-3 dni na 1 dzień.
  - **🟡 Premium Partner → od razu `veroeffentlicht`** (bez review). Standard Partner (bez premium) → `ausstehend`. To decyzja produktowa która była już zaimplementowana w audiopin/route.ts:92.
  - **🟡 Nazwy kategorii w kodzie web (`Erlebnisse`, `Gastronomie`) są nieaktualne** vs Directus (`Sehenswertes`, `Essen & Übernachten`). ID się zgadzają. Refaktor kodu web to opcjonalny cleanup (nie funkcjonalny bug).
  - **🟡 `pin_id` single-string nadpisywany** przy każdym submit — multiple pins wymaga zmiany schematu, nie tylko decyzji biznesowej.
  - **🟢 `partner_profiles` to jedna tabela** — Directus to proxy view na Supabase, nie duplikat.

**v2 zawierało (zachowane):**
- Warstwa web API jako pośrednik między mobile a Directus
- Realne niemieckie nazwy pól (`Bearbeitungsstatus`, `Partner_ID`, `Pin_Typ`, `Unternehmensname`)
- Anti-cheat: rola i priorytet z sesji Supabase, nie z body
- PayPal (`paypal_subscription_id` + `premium_until`) dla Partnera
- B.2.1 obejmuje sights-gating w mobile + web

---

## 1. Cel biznesowy

Wprowadzić **różnicowanie uprawnień do tworzenia pinów** wg roli użytkownika i kategorii pinu:

- **Sehenswertes** (turystyczne atrakcje) — **redakcyjne**, zawsze free dla wszystkich do konsumpcji (z 20% cap dla free), tworzone tylko przez redakcję (nie przez usera).
- **Komercyjne kategorie** (Essen & Übernachten, Einkaufen, Engagement, Unternehmen) — mogą być tworzone przez **Partnerów** (płatne — patrz cennik z Voraussetzungen) lub sugerowane przez **Reisender** dla redakcji.

To fundament modelu przychodowego. Partner płaci za widoczność swojego biznesu; Reisender premium nie może obejść tego tworząc "za darmo" komercyjny pin — tylko sugeruje.

---

## 2. Model uprawnień

### 2.1 Role użytkownika (dziś istniejące)

| Rola | Skąd wynika | Widoki | Może tworzyć piny? |
|------|-------------|--------|-------------------|
| **Guest** (niezalogowany) | brak konta | Karte + Liste + Tour (Sehenswertes 20% cap) | Nie |
| **Reisender free** | zarejestrowany, bez RC subscription | Karte + Liste + Tour (Sehenswertes 20% cap) | Sugestia tylko |
| **Reisender premium** | zarejestrowany + `hasPro=true` z RC (`fairfuehrer_pro`) | Karte + Liste + Tour (100% Sehenswertes, offline mapa, ...) | Sugestia tylko |
| **Partner** | zarejestrowany + `partner_profile` istnieje + `premium_until > now()` (PayPal subscription active) | To co Reisender free + panel Partner na web | Tak, w kategoriach komercyjnych, po opłacie PayPal |

**Kluczowe rozstrzygnięcia:**
- Reisender premium **NIE MOŻE** tworzyć komercyjnych pinów jak Partner. Może tylko sugerować redakcji.
- **Partner płaci przez PayPal, nie RevenueCat.** RevenueCat jest tylko dla Reisender+ (mobile subscription). Weryfikacja Partner-active idzie przez `partner_profiles.premium_until` (kolumna już istnieje w Supabase / Directus view).

### 2.2 Matrix uprawnień × kategoria (v4)

Kolumny = kategoria pinu. Wiersze = rola.

|  | Sehenswertes | Essen&Übernachten | Einkaufen | Engagement | Unternehmen |
|---|---|---|---|---|---|
| **Guest** | konsumpcja (20% cap) | konsumpcja | konsumpcja | konsumpcja | konsumpcja |
| **Reisender free** | konsumpcja (20% cap) + **pełny pin (free)** | konsumpcja + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** |
| **Reisender premium** | konsumpcja (100%) + **pełny pin (free)** | konsumpcja + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** | konsumpcja + **sugestia** |
| **Partner** | konsumpcja (20% cap) + **?** *(OTWARTE — Miriam)* | konsumpcja + **własne piny (płatne)** | konsumpcja + **własne piny (płatne)** | konsumpcja + **własne piny (płatne)** | konsumpcja + **własne piny (płatne)** |

**Kluczowe zmiany v4:**
- Reisender (free i premium) **TWORZY** Sehenswertes-piny — pełny formularz, free, unlimited. Nie sugestia — pełny pin z Titelbild, Audio, Vollbeschreibung, Galerie itd.
- Reisender dla kategorii komercyjnych → tylko sugestia (prosty formularz: Name, Adresse, Beschreibung).
- **Wszystkie piny i sugestie przechodzą moderację** (`Bearbeitungsstatus: ausstehend`). Redakcja akceptuje przez zmianę na `veroeffentlicht`.
- Partner + Sehenswertes = OTWARTE PYTANIE — Miriam potwierdzi czy Partner może korzystać z darmowego Sehenswertes-flow tak jak Reisender.

### 2.3 Trzy różne flowy tworzenia contentu (v4)

**Flow A — Sugestia (prosty formularz)**
- Kto: Reisender (free/premium) dla kategorii **komercyjnych**
- Gdzie: `ort_vorschlaege` przez `/api/ort-vorschlagen`
- Pola: Name_des_Ortes, Adresse, Beschreibung, Kategorie_id (nowe)
- Efekt: Redakcja weryfikuje, sama tworzy prawdziwy pin w `Orte` z redakcyjnym metadata (Titelbild + Audio + Text)

**Flow B — Pełny pin Reisender-Sehenswertes (pełny formularz, free)**
- Kto: Reisender (free/premium) dla kategorii **Sehenswertes**
- Gdzie: `Orte` przez nowy endpoint `/api/audiopin-reisender` (analog `audiopin/route.ts`, ale bez `role: partner` check)
- Pola: Name, Adresse, Stadt, Land, Vollbeschreibung, Titelbild, Audio, Galerie (opcjonalna), Kategorie_id, location, itd.
- Efekt: `Bearbeitungsstatus: ausstehend` → moderacja → `veroeffentlicht`
- Partner_ID = null (bo Reisender, nie Partner)
- Pin_Typ = "standard" (Reisender nigdy nie ma premium-pin)

**Flow C — Własny pin Partner (płatny, pełny formularz)**
- Kto: Partner (`role === "partner"` + `premium_until > now()`) dla kategorii **komercyjnych**
- Gdzie: `Orte` przez istniejący `/api/audiopin`
- Pola: jak Flow B + Link_URL, Telefon, Kontaktperson, Email, Zertifizierungen, Unternehmensname
- Efekt: `Bearbeitungsstatus: ausstehend` → moderacja → `veroeffentlicht`
- **Zmiana v4 vs obecny kod:** `audiopin/route.ts:92` obecnie ustawia `veroeffentlicht` od razu dla premium. **Trzeba zmienić na `ausstehend` zawsze** (wszystkie piny przez moderację).
- Partner_ID = user.id, Pin_Typ = "premium" (bo Partner premium) lub "standard" (jeśli premium wygasł, ale nie powinno się zdarzyć bo paywall)

---

## 3. Architektura komunikacji (KRYTYCZNE)

**Mobile NIGDY nie pisze bezpośrednio do Directusa.** Wszystkie mutacje idą przez web API (Next.js route handlers):

```
Mobile (fairfuhrer-mobile) ─→ Web API (fairfuhrer/app/api/*) ─→ Directus
```

To ma dwa powody:
1. **Bezpieczeństwo** — `DIRECTUS_TOKEN` jest server-only, nigdy nie leci w mobile bundle. Web route używa go za pośrednictwem `server-only` importu.
2. **Server-side validation** — web route weryfikuje sesję Supabase, wylicza rolę i priorytet, waliduje kategorie. Klient nie może spoofować.

**Obecny stan:**
- Web route: [`fairfuhrer/app/api/ort-vorschlagen/route.ts`](../../fairfuhrer/app/api/ort-vorschlagen/route.ts) — istnieje, ale bez auth verification
- Mobile hook: [`fairfuhrer-mobile/hooks/useSubmitPlaceProposal.ts`](../hooks/useSubmitPlaceProposal.ts) — robi POST na `${EXPO_PUBLIC_SITE_URL}/api/ort-vorschlagen`

**Dla B.2 potrzeba:**
- Rozszerzyć istniejący route o kategorię + auth verification
- Nowy endpoint `POST /api/orte-partner` dla submissions Partnera (kompletnie nowy)

---

## 4. Zmiany w danych (Directus / Supabase)

### 4.1 Directus `Kategorie` — nowe pole `Typ`

Dodać enum: `redaktion` | `kommerziell`. Ustawić:
- Sehenswertes (id=1) → `redaktion`
- Essen & Übernachten (id=2) → `kommerziell`
- Einkaufen (id=3) → `kommerziell`
- Engagement (id=5) → `kommerziell`
- Unternehmen (id=8) → `kommerziell`

**Powód:** eliminuje hardcoded ID w kodzie (obecnie `EXPO_PUBLIC_SIGHTS_CATEGORY_ID` + `NEXT_PUBLIC_SIGHTS_CATEGORY_ID` w web), pozwala redakcji dodawać nowe kategorie bez zmiany kodu. Fallback name-based (`startsWith("sehen")`) zostaje jako trzecia warstwa bezpieczeństwa.

### 4.2 Directus `ort_vorschlaege` — rozszerzenie o kategorię i weryfikację

Obecnie zawiera: `Name_des_Ortes`, `Adresse`, `Beschreibung`, `Benutzername`, `Eingereicht_von_Email`, `Vorname`, `Nachname`.

Dodać:
- `Kategorie_id` (M2O do `Kategorie`) — jaka kategoria (Reisender wybiera z listy)
- `Rolle_Einreicher` (string enum: `reisender_free`, `reisender_premium`, `partner`) — **ustawiane po stronie serwera z zweryfikowanej sesji Supabase**, nie z body
- `Priorität` (integer) — **automatyczne po stronie serwera**: premium user = 2, free = 1 (redakcja sortuje)

### 4.3 Directus `Orte` — realne nazwy pól (NIE dodajemy nowych!)

**Ważne:** wiele pól które opisał v1 spec jako "nowe" już istnieje w Directusie pod niemieckimi nazwami. Dopasowanie:

| v1 spec proponował | Rzeczywistość — użyć tego |
|---|---|
| `status: draft` / `published` | `Bearbeitungsstatus: ausstehend` / `veroeffentlicht` (istnieje) |
| `submitted_by_partner_id` | `Partner_ID` (string, istnieje) |
| Firma / nazwa | `Unternehmensname` (istnieje) |
| Typ pinu | `Pin_Typ` (`standard`/`premium`, istnieje) |
| Kontakt osobisty | `Kontaktperson` (istnieje) |
| Email biznesowy pinu | `Email` (istnieje, wewnętrzne) |

**Nowe pola do dodania (tylko te, których nie ma):**
- `submitted_at` (timestamp) — kiedy Partner zgłosił pin. Wartość: `date-created` special.
- **Rozszerzenie enum `Bearbeitungsstatus`** o wartości:
  - `ausstehend` (istnieje) — redakcyjne piny czekają na review
  - `veroeffentlicht` (istnieje) — aktywne
  - `partner_ausstehend` (NOWY) — Partner zgłosił, czeka na weryfikację redakcji
  - `partner_aktiv` (NOWY) — Partner opłacony, aktywny do `premium_until`
  - `partner_abgelaufen` (NOWY) — Partner nie odnowił, pin niewidoczny na mapie
- **Lifecycle NIE potrzebuje `expires_at` w `Orte`** — używamy `partner_profiles.premium_until` (już istnieje) przez JOIN po `Partner_ID`.

### 4.4 Supabase / Directus view `partner_profiles` — już wystarcza!

Realny schemat (via Directus MCP):
- `id` (uuid, FK do `profiles.id`)
- `company_name`, `street`, `city`, `postal_code`, `country`
- `website_url`, `phone_number`, `phone_number_2`, `business_email`
- `tax_id`, `vat_eu`, `tax_bucket`, `tax_group`, `no_eu_vat`, `cross_border_b2c` — VAT infrastructure
- **`premium_until` (timestamp)** — do kiedy Partner ma aktywną subskrypcję ✅
- **`paypal_subscription_id` (text)** — PayPal subscription ID ✅
- `pin_id` (text) — **JEDEN pin per partner** (open question w sekcji 13)
- `gallery_paths` (text[]) — galeria zdjęć Partnera
- `instagram_url`, `facebook_url`, `tiktok_url`, `youtube_url`
- `created_at`, `updated_at`

**Konsekwencja:** cała infrastruktura Partner ($$ + lifecycle + brand) już istnieje. B.2 to głównie **podłączenie tego do flow tworzenia pinu**, nie budowanie od zera.

**JEDNAK:** `pin_id` (text, single) → jeśli decyzja "multiple pins" = A, trzeba **1:N przez FK w `Orte.Partner_ID` → `partner_profiles.id`**, nie przez `partner_profiles.pin_id`. Pole `pin_id` można wtedy zdeprecjonować lub zostawić dla backwards compat.

---

## 5. Multiple pins per Partner

**Decyzja do potwierdzenia z Miriam** (rekomendacja: **A**):

- **A** — Partner może stworzyć **wiele pinów** za jedną opłatę. Powód: cennik już rozróżnia wielkość biznesu (Kleinstunternehmen 50€ / kleinbetrieb 100€ / mittelbetrieb 200€) — wliczone.
- **B** — 1 pin = 1 opłata, dodatkowe piny płatne osobno.
- **C** — Cap per tier: gemeinnützig 1 pin, Kleinstunternehmen 2, klein 5, mittel 10.

**Rekomendacja A**, ale to wymaga migracji `partner_profiles.pin_id` (text, single) na relację 1:N via `Orte.Partner_ID`.

---

## 6. UX — mobile flow

### 6.1 Nowy flow tworzenia pinu dla Reisender (`components/profil/OrtErstellenSection.tsx`)

**Obecny stan (do przemianowania i rewrite):** `OrtVorschlagenSection.tsx` — premium-only, prosty formularz, brak wyboru kategorii.

**Nowy stan (v4):**

**Krok 1 — Kategoria decyduje o formularzu:**
1. User widzi selektor kategorii (5 opcji z Directus)
2. Wybiera kategorię
3. **UI dynamicznie przełącza formularz:**
   - Sehenswertes → **pełny formularz** (Flow B) → POST na `/api/audiopin-reisender`
   - Komercyjne (4 kategorie) → **prosty formularz sugestii** (Flow A) → POST na `/api/ort-vorschlagen`

**Krok 2 — Widoczność sekcji:**
- Guest → CTA "Zaloguj się aby Pins hinzuzufügen" (link do auth)
- Reisender (free/premium) → sekcja widoczna (obie ścieżki dostępne w zależności od kategorii)
- Partner → sekcja Sehenswertes widoczna **OTWARTE**, komercyjne = inna sekcja "Neuen Pin einreichen" (patrz 6.2)

**Refactor komponentu:**
- Zmiana nazwy: `OrtVorschlagenSection` → `OrtErstellenSection` (bo teraz to nie tylko sugestia)
- Nowy stan: wybrana kategoria + rendered form component
- Dwa sub-komponenty:
  - `SehenswertesForm.tsx` — pełny formularz (jak `PartnerPinForm` bez Partner-specific pól)
  - `SugestionForm.tsx` — prosty formularz (obecny UI, extract)

**Copy zmiana** (Directus `ort_vorschlagen_content`):
- Usunąć `premium_info` (bo teraz dla wszystkich)
- Dodać `category_label` = "Kategorie"
- Dodać `category_hint` = "Wähle die passende Kategorie für deinen Vorschlag"

### 6.2 Nowa sekcja "Neuer Pin" dla Partner (`components/profil/PartnerPinSection.tsx`)

**Widoczna tylko** gdy user ma `partner_profile` w Supabase **i** `premium_until > now()`.

Pola formularza (mapowanie na istniejące pola `Orte`):
- **Kategorie** (M2O do `Kategorie`, filter: `Typ = kommerziell`) — Partner nie może wybrać Sehenswertes → `Kategorie` m2m
- **Name** (Name des Ortes) → `Name`
- **Unternehmensname** → `Unternehmensname` (istnieje!)
- **Adresse / Stadt / Land** → `Adresse` / `Stadt` / `Land` (istnieją!)
- **Kurzbeschreibung** (~500 znaków, na potrzeby audio) → `Vollbeschreibung`
- **Link_URL** + **Telefon** + **Kontaktperson** (opcjonalne) → istniejące pola
- **Titelbild** — upload (Directus files) → `Titelbild`
- **Galerie** — upload 0-6 zdjęć → `Galerie` (M2M z `directus_files`)
- **Zertifizierungen** — checkbox z listy → `Zertifizierungen` (M2M)
- **location** — mapbox pin picker → `location` (geometry.Point)

Po submit → INSERT do `Orte` ze:
- `Bearbeitungsstatus: partner_ausstehend`
- `Pin_Typ: premium`
- `Partner_ID: <partner_profiles.id>`
- `Kategorie` z formularza
- `submitted_at: now()` (auto przez `date-created` special)

Redakcja dostaje email/notification. Po review → `partner_aktiv`.

### 6.3 Selektor "Twoje piny" (lista własnych)

Nowy ekran w Profil → "Meine Pins" (tylko dla Partner). Lista pinów Partnera z badge statusu:
- 🟡 W trakcie weryfikacji (`partner_ausstehend`)
- 🟢 Aktywny do `premium_until` (`partner_aktiv`)
- 🔴 Wygasł (`partner_abgelaufen` — auto-set gdy `premium_until < now()`)

### 6.4 Paywall check dla Partner

Zanim Partner może wypełnić formularz "Neuer Pin":
1. Sprawdź `partner_profiles.premium_until > now()`
2. Jeśli nie → CTA "PayPal Abo abschließen" (redirect do web `/partner/abonnement`)
3. Jeśli tak → formularz

**Ważne:** Weryfikacja robimy przez server API (nie zaufaj klientowi), analogicznie do `hasPro`. Mobile nie ma bezpośredniego dostępu do PayPal subscription status.

---

## 7. Backend validation (Anti-cheat) — WZMOCNIONE

**Kluczowe rozstrzygnięcie:** klient (mobile + web browser) **NIE MOŻE** podawać ról ani priorytetów. Wszystko wyliczane po stronie serwera z zweryfikowanej sesji.

### 7.1 Web API `/api/ort-vorschlagen` (rozszerzenie)

Obecnie **nie weryfikuje auth** — akceptuje body wprost. Refactor:

```typescript
// pseudo-code
const supabase = createServerClient(cookies());
const { data: { user }, error } = await supabase.auth.getUser();
// user może być null (guest) → wymusić auth
if (!user) return 401;

const { data: profile } = await supabase
  .from('profiles')
  .select('id, first_name, last_name')
  .eq('id', user.id).single();

// Wylicz rolę po stronie serwera z RC + partner_profiles
const isPro = await checkRcHasPro(user.id);          // RevenueCat webhook cache
const isPartner = await checkPartnerActive(user.id); // partner_profiles.premium_until > now()

let rolle: 'reisender_free' | 'reisender_premium' | 'partner';
if (isPartner) rolle = 'partner';
else if (isPro) rolle = 'reisender_premium';
else rolle = 'reisender_free';

const prioritaet = (rolle !== 'reisender_free') ? 2 : 1;

// TERAZ pisz do Directus z wartościami z serwera (nie z body!)
await directusInsert('ort_vorschlaege', {
  ...bodyFields,
  Rolle_Einreicher: rolle,   // z serwera
  Priorität: prioritaet,     // z serwera
  Eingereicht_von_Email: user.email,  // z Supabase sesji
});
```

### 7.2 Nowe API `/api/orte-partner` (kompletnie nowe)

Analogiczna weryfikacja, plus:
- **Odrzuć jeśli `!isPartner`** (401 z komunikatem "Nur für Partner")
- **Odrzuć jeśli kategoria = redaktion** (400 z "Sehenswertes kann nur die Redaktion einreichen")
- Wypełnij `Partner_ID` z `user.id`
- Ustaw `Bearbeitungsstatus: partner_ausstehend` (nie ufaj klientowi)
- Ustaw `Pin_Typ: premium`

### 7.3 Sprawdzenie `checkPartnerActive` (helper)

```typescript
// server-only
export async function checkPartnerActive(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('partner_profiles')
    .select('premium_until')
    .eq('id', userId)
    .single();
  if (!data?.premium_until) return false;
  return new Date(data.premium_until) > new Date();
}
```

---

## 8. Kolejność implementacji

Zaproponowany podział na 4 sub-releasy, każdy testowalny inkrementalnie:

### B.2.1 — Fundament danych + gating cleanup
- Dodać `Kategorie.Typ` (redaktion/kommerziell)
- Zmiana `mobile/stores/placesStore.ts::isSightsCategory` — czytaj z `Typ`, potem env, potem fallback name
- **Zmiana `web/lib/sightsGating.ts::isSightsCategory`** — ten sam algorytm co mobile (dwie implementacje muszą pozostać w sync)
- Rozszerzyć `ort_vorschlaege` o `Kategorie_id`, `Rolle_Einreicher`, `Priorität`
- Rozszerzyć enum `Orte.Bearbeitungsstatus` o `partner_ausstehend`, `partner_aktiv`, `partner_abgelaufen`
- Dodać `Orte.submitted_at` (auto date-created)
- **Test:** widoki na mapie/liście dalej działają, gating Sehenswertes nadal działa, żaden istniejący pin nie zniknął

### B.2.2 — Dwa Reisender flowy + auth server-side (v4)

**Zmiany web:**
- **Refactor `web/api/ort-vorschlagen/route.ts`** — auth verification (Supabase session), rola po stronie serwera, dodać `Kategorie_id` w insert
- **NOWY web endpoint `/api/audiopin-reisender`** — analog `audiopin/route.ts`, ale:
  - `role: reisender` (albo brak Partner check)
  - Wymusić `Kategorie_id = Sehenswertes` (odrzuć komercyjne z 400)
  - `Partner_ID = null`, `Pin_Typ = standard`, `Bearbeitungsstatus = ausstehend`
- **Refactor `web/api/audiopin/route.ts:92`** — zmienić z `isPremium ? "veroeffentlicht" : "ausstehend"` na zawsze `"ausstehend"` (wszystkie piny przez moderację, v4)

**Zmiany mobile:**
- Rename `OrtVorschlagenSection` → `OrtErstellenSection`
- Dodać selektor kategorii + dynamiczne przełączanie formularza
- Nowe sub-komponenty: `SehenswertesForm.tsx` + `SugestionForm.tsx`
- Guest handling — CTA do auth
- Nowy content w Directus (`ort_erstellen_content` singleton) dla obu formularzy

**Test:**
- Free user: wybiera Sehenswertes → pełny formularz → pin w `Orte` z `Bearbeitungsstatus: ausstehend` (nie widoczny na mapie do momentu moderacji)
- Free user: wybiera komercyjne → prosty formularz → wpis w `ort_vorschlaege`
- Spoofing: POST z `Rolle_Einreicher: partner` w body → serwer nadpisuje
- Spoofing: POST na `/api/audiopin-reisender` z `Kategorie_id: 3` (Einkaufen, komercyjna) → 400 z komunikatem

### B.2.3 — Formularz Partner Pin (~80% już istnieje w web!)

**Ważne:** `fairfuhrer/app/api/audiopin/route.ts` (POST) + `fairfuhrer/app/api/audiopin/[id]/route.ts` (PATCH/DELETE) już implementują:
- Auth verification (`profile.role === "partner"`)
- `premium_until` check → `isPremium` computed
- Insert do `Orte` z `Partner_ID`, `Pin_Typ`, `Bearbeitungsstatus`
- M2M `Orte_Kategorie`, `Orte_Zertifizierungen`
- Update `partner_profiles.pin_id` po submit
- Gating "galeria tylko premium"
- Auto-status: premium Partner → `veroeffentlicht`, standard → `ausstehend`

**Do zrobienia w B.2.3:**
- **Reużyć istniejący web endpoint `POST /api/audiopin`** — mobile robi POST tam z tymi samymi polami co web formularz (`konto/partner/audiopin/page.tsx`)
- **Nowy komponent mobile `PartnerPinSection.tsx`** — formularz UI z Directus content
- **Nowy hook mobile `useSubmitPartnerPin.ts`** — POST na `${EXPO_PUBLIC_SITE_URL}/api/audiopin`
- **Nowy content w Directus `partner_pin_form_content`** (labels, hints)
- Paywall Partner (jeśli `premium_until <= now()`) → redirect do web `/konto/partner/abonnement`
- **Uwaga:** cleanup — `KATEGORIEN` w [`audiopin/route.ts:7`](../../fairfuhrer/app/api/audiopin/route.ts#L7) ma stare nazwy (`Erlebnisse`, `Gastronomie`) vs Directus. Opcjonalne: aktualizacja przy okazji.
- **Test:** Mobile Partner submit → ten sam endpoint co web → pin w `Orte` z premium → `veroeffentlicht` od razu.

**Estymacja:** 1 dzień mobile (bez web zmian — endpoint istnieje).

### B.2.4 — "Meine Pins" dla Partnera + lifecycle
- Nowy widok w Profil → "Meine Pins" (query przez API filtr `Partner_ID = user.id`)
- Wyświetlanie z badge statusu
- Powiadomienia o zbliżającym się wygaśnięciu (30 dni przed `premium_until`)
- Cron/webhook: automatyczne przełączenie `partner_aktiv → partner_abgelaufen` gdy `premium_until` mija
- Flow renewal — link do web PayPal renewal
- **Test:** Partner widzi swoje piny, dostaje maila 30 dni przed expires, po wygaśnięciu pin znika z mapy publicznej

---

## 9. Wpływ na inne moduły

- **Web app (fairfuhrer/):** panel Partner + `/partner/abonnement` (PayPal integration) + nowy API endpoint. To integralna część B.2, nie osobny release.
- **RevenueCat:** **BEZ ZMIAN** — RC nadal tylko dla Reisender+. Partner idzie przez PayPal (webhook już istnieje: `webhook_logs`, `paypal_donations`).
- **Sentry:** dodać breadcrumb `submit.category` + `submit.role` żeby móc debugować odrzucone submissions
- **Directus roles/permissions:** dodać rolę Directus `partner` z uprawnieniami tylko do własnych pinów w `Orte` (via preset filter `Partner_ID = $CURRENT_USER.id`) — opcjonalne, tylko gdy Partner ma dostęp do Directus Studio (obecnie chyba nie ma)

---

## 10. Ryzyka i otwarte pytania

### Otwarte pytania — czekają na decyzję (dla Miriam)

1. **Multiple pins per Partner** — A, B czy C z sekcji 5? Rekomendacja A.
2. **Web app synchronizacja** — obligatoryjnie z B.2 (nie da się rozdzielić, bo API + paywall są tam).
3. **`partner_profiles.pin_id`** — deprecate czy trzymać dla back-compat? Rekomendacja: deprecate po migracji na `Orte.Partner_ID` join.
4. **Sehenswertes suggestion** — czy Reisender sugerujący Sehenswertes ma **osobny formularz** (bo tam nie ma "sponsor" pól)? Rekomendacja: **wspólny formularz**, kategoria decyduje jakie pola są wymagane.
5. **PayPal renewal flow** — czy przy `premium_until` expiration wygaszamy piny natychmiast, czy grace period 7 dni? Rekomendacja: 7 dni grace, w tym czasie badge "Erneuerung fällig" na pinie.

### Zidentyfikowane ryzyka

- **R1: PayPal subscription state race** — Partner opłaca, webhook jeszcze nie przyszedł, `premium_until` stare, submit odrzucony. Mitigacja: force refresh z PayPal API przed submit ALBO grace-check jeśli `paypal_subscription_id` jest ustawione ale `premium_until` przeterminowane.
- **R2: Migracja istniejących pinów w `Orte`** — 700+ pinów, wszystkie mają `Bearbeitungsstatus: veroeffentlicht` (redakcyjne). Nie ruszamy — nowe wartości enum `partner_*` dotyczą tylko nowych pinów Partnera. Zero migration script.
- **R3: Regresja gating Sehenswertes** — **NISKIE ryzyko** (obniżone z v1). Kod ma już 3-poziomową detekcję po B.2.1: `Typ` → env → fallback name (`startsWith("sehen")`). Nawet jeśli `Typ` gdzieś nie ustawiony, fallback name działa. Osobny feature flag zbędny.
- **R4: Web-mobile sights-gating rozjazd** — dwie implementacje `filterVisiblePlaces` (w mobile store + `web/lib/sightsGating.ts`) muszą pozostać w sync algorytmicznie. B.2.1 obejmuje **obie**. Dodać komentarz w obu plikach z cross-reference.
- **R5: Copy w Directus** — B.2 wymaga sporo nowego contentu (form labels, paywall Partner text, hint text). Miriam musi to napisać zanim wypuścimy.
- **R6: Rola Directus "partner"** — jeśli Partner ma dostęp do Directus Studio bezpośrednio, musimy skonfigurować permissions żeby widział tylko własne piny. Otwarte pytanie: czy w ogóle taki dostęp jest planowany?

---

## 11. Kryteria akceptacji (per sub-release)

**B.2.1:** Wszystkie widoki działają jak przed (mobile + web). `isSightsCategory` czyta z Directus `Typ`, z fallbackiem env i name. Enum `Bearbeitungsstatus` ma 5 wartości. Zero regresji na istniejących pinach.

**B.2.2:** Reisender free może wysłać sugestię pinu z kategorii komercyjnej. Kategoria widoczna dla redakcji w `ort_vorschlaege`. Guest widzi CTA do login. **Spoofing test:** POST z `Rolle_Einreicher: partner` w body → serwer nadpisuje wyliczoną rolą.

**B.2.3:** Partner z aktywnym `premium_until` tworzy pin z kategorii komercyjnej. Bez active → 401 z redirectem do PayPal. Próba `Kategorie: Sehenswertes` → 400.

**B.2.4:** Partner widzi listę swoich pinów w profil. Piny z `partner_abgelaufen` mają badge i CTA "Erneuern". Auto-transition `partner_aktiv → partner_abgelaufen` działa (test: ustaw `premium_until` na wczoraj, uruchom cron/webhook, pin znika z publicznych widoków).

---

## 12. Poza zakresem B.2 (na kolejne releasy)

- **Analytics Partnera** — statystyki odsłuchań/kliknięć per pin. B.4+.
- **Redakcyjne review workflow w Directus** (batch approve) — Miriam potrzebuje po testach realnego ruchu.
- **Auto-audio generation dla Partner pins** (TTS) — Miriam chciała eventualnie, poza zakresem B.
- **Partner Dashboard w mobile** (statystyki, edycja pinów) — tylko web w B.2. Mobile Partner UI dopiero jak feedback od Partnerów wskaże potrzebę.

---

## 13. Estymacja (subiektywna, po korekcie)

| Sub-release | Days work (mobile) | Days work (web) | Ryzyko |
|---|---|---|---|
| B.2.1 (fundament + gating cleanup) | 0.5 | 0.5 | Niskie |
| B.2.2 (Reisender dwa flowy + auth + moderacja wszystkich) | 1.5 | 1.5 | Średnie |
| B.2.3 (Partner form — reuse web endpoint) | 1 | 0.25 | Niskie (endpoint istnieje, tylko moderacja fix) |
| B.2.4 (Meine Pins + lifecycle + cron) | 1 | 0.5 | Średnie |

**Razem:** ~4 dni mobile + ~2.75 dni web = **~6.75 dnia** roboczych łącznie (v4 podniesione z 5.5 po dodaniu drugiego Reisender flow).

**Uwaga do B.2.4:** przy obecnym `partner_profiles.pin_id` (single string) "Meine Pins" to tak naprawdę "Mein Pin" — jeden. Jeśli Miriam wybierze multiple pins (A), B.2.4 rozrasta się o refactor schematu (+1 dzień).

---

## 14. Decyzje

### 14.1 Ustalone z Konradem (v4, 2026-07-02)
- ✅ **Reisender tworzy pełne piny Sehenswertes** (free, unlimited), nie sugeruje
- ✅ **Reisender komercyjne** → tylko sugestia (prosty formularz)
- ✅ **Wszystkie piny i sugestie przez moderację** — `Bearbeitungsstatus: ausstehend` domyślnie
- ✅ **Partner tylko przez web/mobile app**, nie ma dostępu do Directus Studio
- ✅ **`pin_id` deprecate** po B.2 (techniczna decyzja Konrada)
- ✅ **Directus flow / web API** dla anti-cheat (nie RLS)
- ✅ **PayPal, nie RC** dla Partner (infrastruktura już istnieje)

### 14.2 Do zapytania Miriam (3 pytania biznesowe)
1. **Multiple pins per Partner** — jedna subskrypcja = wiele pinów, czy każdy osobno?
2. **Grace period** — co się dzieje z pinem po wygaśnięciu subskrypcji?
3. **Czy Reisender może dodawać Sehenswertes bezpośrednio + sugerować komercyjne?** (potwierdzenie kierunku)

### 14.3 Do dopytania Miriam później (po jej odpowiedzi na 14.2)
- **Czy Partner może za darmo tworzyć piny Sehenswertes** (jak Reisender), czy tylko komercyjne przez subskrypcję? To wpływa na tabelę uprawnień z 2.2 (obecnie znak "?" dla Partner × Sehenswertes).

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
   │          └─────┬──────┘           │
   │                │                  │
   ▼                ▼                  ▼
[Login CTA]  [Sugestia formularz]  [Partner Pin formularz]
                    │                  │
                    │                  ├─ Kategorie kommerziell only
                    │                  ├─ Titelbild + Audio + Gallery
                    │                  └─ Link + Telefon + Zertifikate
                    │                  │
                    ▼                  ▼
             POST /api/          POST /api/orte-partner
             ort-vorschlagen     (NEW ENDPOINT)
                    │                  │
                    │              ├─ auth verify (Supabase)
                    │              ├─ checkPartnerActive
                    │              └─ Kategorie.Typ = kommerziell
                    │                  │
                    ▼                  ▼
      Directus ort_vorschlaege   Directus Orte
      (Rolle_Einreicher +        (Bearbeitungsstatus:
       Priorität z serwera)       partner_ausstehend,
                                   Partner_ID z user.id,
                                   Pin_Typ: premium)
                    │                  │
                    ▼                  ▼
              Redakcja           Redakcja
              tworzy pin         akceptuje
              w Orte             (Bearbeitungsstatus:
              (redakcyjny,        partner_aktiv)
               Bearbeitungsstatus:
               veroeffentlicht)
```

## Appendix B — Kolekcja / tabelka zmian (REALNE nazwy)

| Kolekcja | Rzeczywistość | Zmiana |
|---|---|---|
| `Kategorie` (Directus) | ma `id`, `Name`, `Farbe`, `Reihenfolge` | **DODAJ** `Typ` (enum) |
| `Orte` (Directus) | ma `Bearbeitungsstatus`, `Partner_ID`, `Pin_Typ`, `Unternehmensname`, `Kontaktperson`, `Email`, `Link_URL`, `Telefon`, `Titelbild`, `Audio`, `Galerie`, `Zertifizierungen`, `location`, `Stadt`, `Land` | **DODAJ** `submitted_at` (date-created). **ROZSZERZ** enum `Bearbeitungsstatus` o `partner_ausstehend`, `partner_aktiv`, `partner_abgelaufen` |
| `ort_vorschlaege` (Directus) | ma `Name_des_Ortes`, `Adresse`, `Beschreibung`, `Benutzername`, `Eingereicht_von_Email`, `Vorname`, `Nachname` | **DODAJ** `Kategorie_id` (M2O), `Rolle_Einreicher` (enum), `Priorität` (int) |
| `partner_profiles` (Supabase / Directus view) | ma `premium_until`, `paypal_subscription_id`, `pin_id`, dane firmy, VAT infra | **BEZ ZMIAN** (`pin_id` deprecate opcjonalnie) |
| `web/api/ort-vorschlagen/route.ts` | istnieje, bez auth verify | **REFACTOR** — Supabase session, rola po stronie serwera |
| `web/api/audiopin/route.ts` (POST) + `[id]/route.ts` (PATCH/DELETE) | **ISTNIEJE i działa** — pełny Partner-pin flow | **REUSE z mobile** — POST na ten sam endpoint. Opcjonalnie: cleanup stare nazwy kategorii (`Erlebnisse`, `Gastronomie`) |
| `web/lib/sightsGating.ts` | env + fallback name | **DODAJ** detekcję po `Typ` jako pierwszą warstwę |
| `mobile/stores/placesStore.ts::isSightsCategory` | env + fallback name | **DODAJ** detekcję po `Typ` jako pierwszą warstwę |
| RevenueCat | `fairfuehrer_pro` entitlement | **BEZ ZMIAN** — RC tylko dla Reisender+ |
| Directus flow | brak | **OPCJONALNIE** dodać `Bearbeitungsstatus` auto-transition na `partner_abgelaufen` gdy `premium_until` mija (można też cron w web) |

## Appendix C — Środowiskowe zmienne — status po B.2

**Do usunięcia (deprecated po B.2.1):**
- `EXPO_PUBLIC_SIGHTS_CATEGORY_ID` (mobile)
- `NEXT_PUBLIC_SIGHTS_CATEGORY_ID` (web)

**Do dodania:**
- (na razie nic — PayPal używa istniejących `PAYPAL_*` z systemu donations)

**BEZ ZMIAN:**
- `EXPO_PUBLIC_RC_KEY_*` — RC nadal używane dla Reisender+
- `DIRECTUS_URL`, `DIRECTUS_TOKEN` — server-only w web API

---

## Appendix D — Referencje w kodzie (dla implementującego)

| Co | Gdzie |
|---|---|
| Obecny mobile submit hook | [`fairfuhrer-mobile/hooks/useSubmitPlaceProposal.ts`](../hooks/useSubmitPlaceProposal.ts) |
| Obecny mobile form | [`fairfuhrer-mobile/components/profil/OrtVorschlagenSection.tsx`](../components/profil/OrtVorschlagenSection.tsx) |
| Web route submit sugestii | [`fairfuhrer/app/api/ort-vorschlagen/route.ts`](../../fairfuhrer/app/api/ort-vorschlagen/route.ts) |
| **Web route submit Partner pin (ISTNIEJE!)** | [`fairfuhrer/app/api/audiopin/route.ts`](../../fairfuhrer/app/api/audiopin/route.ts) POST + [`[id]/route.ts`](../../fairfuhrer/app/api/audiopin/[id]/route.ts) PATCH/DELETE |
| **Web page Partner-pin formularz (referencja)** | [`fairfuhrer/app/(protected)/konto/partner/audiopin/page.tsx`](../../fairfuhrer/app/(protected)/konto/partner/audiopin/page.tsx) |
| Mobile sights gating | [`fairfuhrer-mobile/stores/placesStore.ts:41`](../stores/placesStore.ts#L41) `isSightsCategory` |
| Web sights gating | [`fairfuhrer/lib/sightsGating.ts:24`](../../fairfuhrer/lib/sightsGating.ts#L24) `isSightsCategory` |
| RevenueCat entitlement pattern | [`fairfuhrer-mobile/lib/revenuecat.ts:93`](../lib/revenuecat.ts#L93) `hasPro` |
| Directus place types | [`fairfuhrer-mobile/types.ts:81`](../types.ts#L81) `DirectusOrte` |

---

*Spec zaktualizowany 2026-07-02 po review niezależnego agenta. Główne zmiany: pełna warstwa web API, realne nazwy pól, PayPal zamiast RC dla Partner, obniżony R3, dodany R4 (web-mobile sights sync).*
