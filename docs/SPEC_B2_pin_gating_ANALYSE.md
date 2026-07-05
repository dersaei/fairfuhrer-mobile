# Analiza i drogowskaz — review dokumentu `SPEC_B2_pin_gating.md`

> ⚠️ **STATUS 2026-07-05: częściowo nieaktualny**
>
> Ort-vorschlagen usunięty z produktu (2026-07-05). Wszystkie odwołania
> do `/api/ort-vorschlagen`, `useSubmitPlaceProposal`, `ort_vorschlaege`
> i `OrtVorschlagenSection` odnoszą się do **nieistniejącego już kodu**.
> Uwagi bezpieczeństwa (Flow A anti-spoofing) są historyczne — endpoint
> nie istnieje. Uwagi dotyczące Sehenswertes gating (Flow B, moderacja,
> RevenueCat sync) pozostają aktualne dla ewentualnego SPEC v5.

**Status:** REVIEW (nie zastępuje speca — dokument towarzyszący)
**Data:** 2026-07-02
**Dotyczy:** [`SPEC_B2_pin_gating.md`](./SPEC_B2_pin_gating.md)
**Metoda:** spec zweryfikowany względem realnego kodu (mobile + web), schematu Directus (live) i konfiguracji RevenueCat.

---

## 0. Jak czytać ten dokument

Spec jest **koncepcyjnie solidny**: model uprawnień, podział na inkrementalne sub-releasy oraz świadomość walidacji backendowej (anti-cheat) są dobrze pomyślane. Ten dokument to **nie kontr-spec**, tylko drogowskaz: notuje, gdzie spec rozjeżdża się z rzeczywistością, żeby implementacja nie ruszyła na fałszywych założeniach.

System świateł:

- 🔴 **Blocker** — do wyjaśnienia przed implementacją, inaczej zły scope.
- 🟡 **Korekta** — założenie w specu nie do końca zgadza się z rzeczywistością.
- 🟢 **Odwołanie alarmu / rezerwa** — w specu przedstawione jako trudniejsze/bardziej ryzykowne niż jest naprawdę.

---

## 1. Główny wniosek

> **Spec opisuje architekturę, w której aplikacja mobilna pisze bezpośrednio do Directusa. To nie odpowiada rzeczywistości — flow sugestii idzie dziś przez web app.**

To najważniejszy wniosek, bo bezpośrednio powiększa scope B.2.2 (i częściowo B.2.3). Szczegóły w 2.1.

---

## 2. Rozbieżności spec ↔ rzeczywistość

### 2.1 🔴 Sugestia NIE idzie wprost do Directusa — przechodzi przez web API

**Założenie speca** (sekcje 4.2, 5.1, B.2.2): „sugestia trafia do `ort_vorschlaege`" — tak jakby mobile pisał wprost do Directusa.

**Rzeczywistość:**

- Mobile [`hooks/useSubmitPlaceProposal.ts:22`](../hooks/useSubmitPlaceProposal.ts#L22) robi `POST` na `${EXPO_PUBLIC_SITE_URL}/api/ort-vorschlagen`.
- Web route [`fairfuhrer/app/api/ort-vorschlagen/route.ts`](../../fairfuhrer/app/api/ort-vorschlagen/route.ts) dopiero wtedy zapisuje z `DIRECTUS_TOKEN` do `items/ort_vorschlaege`.

**Konsekwencja:** nowe pola (`Kategorie_id`, `Rolle_Einreicher`, `Priorität`) trzeba przepchnąć przez **trzy** miejsca — mobile hook → web route → Directus — a nie przez dwa. Spec całkowicie pomija warstwę web route.

**Rekomendacja:** w B.2.2 uwzględnić web route jako osobny krok pracy. Odpowiednio podnieść estymację B.2.2 (patrz 4).

---

### 2.2 🔴 `Priorität` i `Rolle_Einreicher` są spoofowalne, jeśli przychodzą z klienta

**Dowód:** obecny web route przekazuje `submitted_by` **bez weryfikacji** wprost z body requestu ([`route.ts:36`](../../fairfuhrer/app/api/ort-vorschlagen/route.ts#L36)). Jeśli `Rolle_Einreicher`/`Priorität` pójdą tą samą drogą, free user może wysłać `Priorität: 2` / `rolle: reisender_premium`.

**Rekomendacja:** rolę i priorytet wyliczać **po stronie serwera** — z zweryfikowanej sesji Supabase, ewentualnie ze statusu RevenueCat, a nie z body. Klient może rolę *proponować*, ale route musi ją *nadpisać*. To ta sama klasa zabezpieczenia, której sekcja 6 speca wymaga dla pinów Partnera — dotyczy tak samo sugestii.

---

### 2.3 🟡 Wiele „nowych" pól `Orte` już istnieje — pod innymi nazwami

Spec (5.2, 4.3) opisuje pola Partnera i status cyklu życia jako nowe. W live-schemacie `Orte` już jednak są:

| Spec mówi (nowe) | Rzeczywistość w `Orte` |
|---|---|
| `status: draft` / `published` | **`Bearbeitungsstatus`** z wartościami `ausstehend` / `veroeffentlicht` (niemieckie, nie `draft`/`published`) |
| `submitted_by_partner_id` | **`Partner_ID`** (string) już istnieje |
| Pola Partnera: link, telefon, galeria, Titelbild, audio, nazwa firmy | **wszystkie obecne** (`Link_URL`, `Telefon`, `Galerie`, `Titelbild`, `Audio`, `Unternehmensname`) |
| — | dodatkowo istnieje **`Pin_Typ`** (`standard`/`premium`) |

**Konsekwencja:**
- Część „bogatszy formularz Partnera" (5.2) po stronie Directusa wymaga **prawie żadnych nowych pól** — dobra wiadomość, oszczędza pracę w B.2.3.
- Ale: cykl życia (`pending_review` / `active` / `expired`) koliduje z istniejącym `Bearbeitungsstatus`. **Otwarta decyzja projektowa:** rozszerzyć `Bearbeitungsstatus` o wartości, czy dodać osobne pole `partner_status`? Spec tej kolizji nie widzi.

**Rekomendacja:** przed B.2.1 zdecydować, czy lifecycle Partnera integrujemy w `Bearbeitungsstatus`, czy stawiamy obok. Nazwy pól w specu dopasować do realnych niemieckich, żeby migracja (R2) nie leciała na nieistniejące pola.

---

### 2.4 🟡 Sights-gating istnieje DWA razy — mobile ORAZ web

Spec dotyczy tylko mobile ([`stores/placesStore.ts:41`](../stores/placesStore.ts#L41)). Ta sama logika żyje jednak w web: [`fairfuhrer/lib/sightsGating.ts:24`](../../fairfuhrer/lib/sightsGating.ts#L24), sterowana przez `NEXT_PUBLIC_SIGHTS_CATEGORY_ID`.

**Konsekwencja:** przełączenie z env-based na pole `Typ` (B.2.1) musi objąć **obie** implementacje, inaczej web i mobile rozjadą się w widoczności pinów.

**Rekomendacja:** B.2.1 wyraźnie oznaczyć jako „mobile + web". Docelowo warto ujednolicić logikę detekcji (jedno źródło zamiast dwóch kopii), ale to opcjonalne i nie jest warunkiem B.2.

---

### 2.5 🟢 R3 (regresja gatingu) jest łagodniejszy niż zakłada spec — fallback już istnieje

Spec klasyfikuje przełączenie `isSightsCategory` jako „wysokie ryzyko bez feature flag". Realny kod ma jednak już dwustopniową detekcję:

1. env-override (`EXPO_PUBLIC_SIGHTS_CATEGORY_ID`)
2. **fallback**: `normalizeGerman(Name).startsWith("sehen")` — łapie „Sehenswertes" i „Sehenswürdigkeiten"

**Konsekwencja:** nawet bez env gating działa dziś po nazwie. Przy migracji na `Typ` wystarczy zachować ten fallback name-based jako **trzeci** stopień — wtedy regresja jest praktycznie wykluczona, nawet jeśli `Typ` gdzieś nie będzie ustawiony.

**Rekomendacja:** kolejność detekcji po B.2.1: `Typ` → env → fallback po nazwie. Osobny feature flag zbędny; fallback po nazwie *jest* siatką bezpieczeństwa.

---

### 2.6 🟡 RevenueCat nie ma jeszcze żadnej warstwy Partnera

Potwierdzone w [`lib/revenuecat.ts`](../lib/revenuecat.ts): istnieje tylko `fairfuehrer_pro` (+ legacy `Fairführer Pro`). `partner_active` (5.4) trzeba zbudować od zera: nowy entitlement w dashboardzie + funkcja `hasPartner` analogiczna do `hasPro`.

**Dobra wiadomość:** `hasPro` sprawdza już względem tablicy `KNOWN_ENTITLEMENT_IDS` — wzorzec jest gotowy do skopiowania. Wysiłek leży raczej w konfiguracji dashboardu i obsłudze zakupu (race condition R1) niż w kodzie detekcji.

---

### 2.7 🟡 `partner_profiles` leży (też) w Directusie — nie tylko w Supabase

Spec (4.4, Appendix B) traktuje `partner_profiles` jako tabelę Supabase z RLS. Istnieje jednak kolekcja Directus `partner_profiles` (grupa „Benutzerfelder_automatisch_generiert").

**Konsekwencja:** zanim zaplanujemy RLS dla cross-service INSERT, trzeba ustalić **źródło prawdy**. Ten fakt wspiera wyrażoną już w specu skłonność do **Directus flow** zamiast Supabase RLS: `Orte` należy do Directusa, a jeśli `partner_profiles` też tam (zdublowany) leży, to hook Directus `items.Orte.create` jest naturalnym, jedynym gatekeeperem.

**Rekomendacja:** otwarte pytanie 2 z sekcji 13 speca rozstrzygnąć na korzyść Directus flow — dane za tym przemawiają.

---

### 2.8 🟢 Kategorie i ID zgadzają się dokładnie

Zweryfikowane względem live-Directus: Sehenswertes=1, Essen & Übernachten=2, Einkaufen=3, Engagement=5, Unternehmen=8. Tabela z sekcji 4.1 speca jest poprawna. `Kategorie` nie ma jeszcze pola `Typ` — dodanie zgodnie z opisem speca to właściwy pierwszy krok.

---

## 3. Co w specu jest dobre (świadomie zachować)

- **Inkrementalny podział** (B.2.1 → B.2.4) z bramką testową między stopniami — dokładnie słuszne, zwłaszcza B.2.1 jako czysty fundament danych bez zmiany UX.
- **Świadomość anti-cheat** (sekcja 6) — rozpoznanie, że client-side gating można obejść i backend musi być gatekeeperem, jest trafne, a przez 2.2 staje się jeszcze pilniejsze.
- **R2 (migracja 700+ pinów)** jest wyłapane — to klasyczna pułapka „cicho zepsute na produkcji". Poprawić w niej tylko nazwy pól (2.3).
- **Matrix + diagram flow** (2.2, Appendix A) czynią intencję jednoznaczną — bardzo pomocne przy review.

---

## 4. Wpływ na estymację (sekcja 12)

| Sub-release | Szacunek speca | Uwaga z rzeczywistości |
|---|---|---|
| B.2.1 | 1 dzień | Realistyczne, **ale** musi objąć web-gating (2.4) → raczej 1–1,5 dnia |
| B.2.2 | 1–1,5 dnia | **Zbyt optymistyczne** — 3 warstwy zamiast 1 (2.1) + rola po stronie serwera (2.2) → raczej 2 dni |
| B.2.3 | 2–3 dni | Realistyczne; częściowo odciążone przez istniejące pola `Orte` (2.3), obciążone decyzją o kolizji statusu |
| B.2.4 | 1,5 dnia | Realistyczne; zależy od Voraussetzungen/modelu cenowego (zewnętrzne, patrz 5) |

---

## 5. Co może rozstrzygnąć tylko autor / Miriam (nie da się wyprowadzić z kodu)

1. **Voraussetzungen / dokument cenowy** (50/100/200 €, 12 miesięcy) — potrzebny do lifecycle `expires_at` (B.2.4) i decyzji o multiple pins. Nie był dostępny podczas review.
2. **Źródło prawdy dla `partner_profiles`** (Directus vs. Supabase) — patrz 2.7.
3. **Kolizja statusu** `Bearbeitungsstatus` vs. `partner_status` — patrz 2.3.
4. Cztery decyzje biznesowe z sekcji 13 speca (multiple pins A/B/C, SKU, scope web, wspólny vs. osobny formularz).

---

## 6. Rekomendowana kolejność ustaleń (przed B.2.1)

1. **Realne nazwy pól** wprowadzić do speca (2.3) — zapobiega migracji na nieistniejące pola.
2. **Web route ująć we flow** (2.1) — zapobiega złemu scope w B.2.2.
3. **Directus flow vs. Supabase RLS** rozstrzygnąć (2.7) — ustala architekturę walidacji backendowej.
4. **Kolizję statusu** rozstrzygnąć (2.3).
5. Dopiero potem decyzje biznesowe z sekcji 13.

---

## 7. Runda 2 — ustalenia z recon autora + weryfikacja (dopisane po review v2)

Autor speca zintegrował uwagi z sekcji 2 do wersji v2 i przy okazji zrobił własny recon `partner_profiles`. To odsłoniło **trzy fakty, których pierwsza runda review nie objęła** — z czego jeden jest ważniejszy niż wszystkie wcześniejsze blockery. Zweryfikowane na żywym schemacie i w kodzie web:

### 7.1 🔴 Partner-pin flow JUŻ ISTNIEJE i działa — w web, nie do zbudowania

Największe znalezisko całego review. Sekcja 5.2/5.3 speca („nowa sekcja Neuer Pin dla Partnera", „nowy hook", „Directus flow Verify Partner Submission") opisuje jako *nowe* coś, co **jest już zaimplementowane** w [`fairfuhrer/app/api/audiopin/route.ts`](../../fairfuhrer/app/api/audiopin/route.ts). Ten endpoint już dziś:

- weryfikuje sesję Supabase i `profile.role === "partner"` (403 jeśli nie) — **to jest ten server-side gatekeeper z sekcji 6 i 2.2**;
- czyta `partner_profiles.premium_until` i liczy `isPremium = premium_until > now()` — Pin_Typ premium/standard oraz galeria zależą od tego;
- buduje pin w `Orte` z realnymi polami (`Partner_ID: user.id`, `Unternehmensname`, `Pin_Typ`, `Bearbeitungsstatus`), tworzy relacje M2M `Orte_Kategorie` i `Orte_Zertifizierungen`, zapisuje `pin_id` z powrotem do `partner_profiles`.

**Konsekwencja:** B.2.3 to w dużej mierze **przeniesienie/reużycie istniejącego web flow do mobile**, a nie budowa od zera. To dramatycznie zmienia estymację B.2.3 w dół i eliminuje potrzebę osobnego „Directus flow Verify Partner Submission" — walidacja już jest w route. Oba wcześniejsze raporty (i spec v1, i v2) tego nie widziały.

### 7.2 🟡 Płatność Partnera to PayPal, nie RevenueCat

Potwierdzone: istnieją `partner_profiles.paypal_subscription_id` + `premium_until`, oraz web-endpointy [`api/paypal/create-subscription`](../../fairfuhrer/app/api/paypal/create-subscription/route.ts), `activate-subscription`, `subscription-webhook`. RevenueCat (`fairfuehrer_pro`) obsługuje **Reisender premium**, ale Partner płaci przez PayPal. Sekcja 5.4 speca (paywall RC `partner_active`, entitlement 12 mies.) jest oparta na błędnym założeniu.

**Korekta mojej sekcji 2.6:** źródłem prawdy dla „czy Partner aktywny" jest `premium_until > now()` (zasilane webhookiem PayPal), nie entitlement RevenueCat. `EXPO_PUBLIC_RC_PARTNER_ENTITLEMENT_ID` z Appendix C speca prawdopodobnie w ogóle nie jest potrzebny.

### 7.3 🟡 `pin_id` jest pojedynczy (string) — multiple pins wymaga realnej zmiany schematu

`partner_profiles.pin_id` to `text` (jeden pin), a route [`audiopin/route.ts:166`](../../fairfuhrer/app/api/audiopin/route.ts#L166) nadpisuje go przy każdym submitcie. Rekomendacja „A" ze speca (wiele pinów per Partner) nie jest więc tylko decyzją biznesową — wymaga zmiany modelu (1:N zamiast nadpisywanego stringa). To wzmacnia znaczenie otwartego pytania 2 ze speca: przy „A" trzeba refactoru `pin_id`.

### 7.4 🟢 Korekta mojej sekcji 2.7 — `partner_profiles` to jedna tabela, nie duplikat

Recon autora pokazał, że kolekcja Directus `partner_profiles` ma FK `id → profiles(id)` i `meta: null` na polach — to **widok/proxy na tę samą tabelę Supabase**, nie osobne źródło. Moje sformułowanie „dwa źródła" (2.7) było nieprecyzyjne: dostęp jest przez oba systemy, ale dane to jedna tabela. Wniosek (Directus flow jako gatekeeper) zostaje słuszny — a 7.1 pokazuje, że gatekeeper i tak już żyje w web route.

### 7.5 Uwaga metodologiczna

7.1 to przypadek, w którym **także druga runda przeoczyła fakt** (gotowy web flow), dopóki nie sięgnięto po `audiopin/route.ts`. Wniosek: weryfikacja jest tak dobra jak zakres przeszukania. Przy „Partner"/„pin submit" zawsze sprawdzać web `app/api/**` — tam żyje realna logika zapisu do Directusa, bo mobile nie ma `DIRECTUS_TOKEN`.

---

*Powstało jako review towarzyszące. Oryginalny spec pozostaje źródłem intencji; ten dokument koryguje techniczne założenia względem realnego stanu z 2026-07-02. Sekcja 7 dopisana po integracji v2 i drugiej rundzie recon.*
