import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearPlacesCache } from "@/lib/placesCache";
import { clearAllMediaCache } from "@/lib/mediaCache";
import { deleteOfflinePack } from "@/lib/offlineMaps";

// ─── Właściciel danych offline ───────────────────────────────────────────────
//
// Dane offline (paczka mapy, cache pinów, cache mediów) to pliki na urządzeniu
// — same z siebie nie są związane z kontem. Aby konto B nie odziedziczyło
// danych pobranych przez konto A, zapamiętujemy ID ostatniego konta, które
// posiadało dane offline. Gdy zaloguje się INNE konto, dane są czyszczone.
//
// Wylogowanie samo w sobie NIE czyści danych (wygoda przy powrocie tego samego
// konta) — czyszczenie następuje dopiero przy wykryciu zmiany konta.

const OWNER_KEY = "fairfuhrer.offlineOwner.v1";

/**
 * Usuwa wszystkie dane offline z urządzenia: paczkę mapy, cache pinów
 * i cache mediów. Używane przy zmianie konta.
 */
export async function wipeAllOfflineData(): Promise<void> {
  await deleteOfflinePack();
  await clearPlacesCache();
  clearAllMediaCache();
}

/**
 * Zapisuje ID konta jako właściciela danych offline. Wywoływać po pobraniu
 * paczki mapy (gdy faktycznie powstają dane offline).
 */
export async function setOfflineDataOwner(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Błąd storage — pomijamy; gorszy przypadek to zbędne wyczyszczenie później.
  }
}

/**
 * Uzgadnia właściciela danych offline z aktualnie zalogowanym kontem.
 *
 * - Jeśli zalogowane konto różni się od zapisanego właściciela → czyści
 *   wszystkie dane offline i aktualizuje właściciela na bieżące konto.
 * - Jeśli konto jest takie samo (lub brak zapisanego właściciela) → nic nie
 *   robi; dane zostają.
 *
 * Wywoływać przy logowaniu / przy wykryciu sesji na starcie aplikacji.
 */
export async function reconcileOfflineDataOwner(userId: string): Promise<void> {
  try {
    const previous = await AsyncStorage.getItem(OWNER_KEY);
    if (previous && previous !== userId) {
      // Zalogowało się inne konto — dane poprzedniego nie mogą być widoczne.
      await wipeAllOfflineData();
    }
    await AsyncStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Błąd storage — pomijamy.
  }
}
