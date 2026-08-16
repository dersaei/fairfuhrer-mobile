import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import * as Sentry from "@sentry/react-native";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";
import { withPositionTimeout } from "@/lib/location";

/**
 * - idle:     noch nichts versucht
 * - locating: Berechtigung / Position wird geholt
 * - ready:    Liste ist nach Entfernung sortiert
 * - denied:   Berechtigung abgelehnt, darf aber erneut gefragt werden
 * - blocked:  dauerhaft abgelehnt — nur noch über die Systemeinstellungen
 * - error:    Berechtigung da, aber kein Fix (Timeout, GPS aus, RPC-Fehler)
 */
export type GpsSortStatus = "idle" | "locating" | "ready" | "denied" | "blocked" | "error";

export function useGpsSort(dataReady: boolean): {
  orderedIds: number[] | null;
  setOrderedIds: React.Dispatch<React.SetStateAction<number[] | null>>;
  orderedIdsRef: React.MutableRefObject<number[] | null>;
  status: GpsSortStatus;
  sortByLocation: () => void;
} {
  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);
  const [status, setStatus] = useState<GpsSortStatus>("idle");
  const orderedIdsRef = useRef<number[] | null>(null);
  const isFocused = useIsFocused();
  // Zapala sie dopiero po udanym posortowaniu. Wczesniej byl ustawiany od razu
  // na wejsciu do efektu, wiec pojedyncza odmowa uprawnien albo nieudany odczyt
  // GPS wylaczaly sortowanie po odleglosci az do restartu aplikacji — mapa
  // (wlasny flow uprawnien) dzialala, lista juz nie.
  const doneRef = useRef(false);
  // Chroni przed rownoleglymi przebiegami przy szybkim przelaczaniu zakladek.
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  // Nieudany odczyt raportujemy do Sentry raz na sesje — inaczej jedno zepsute
  // GPS zamienia sie w strumien identycznych zdarzen (jak w useTabGpsCenter).
  const reportedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus("locating");

    const fetchSorted = async (lat: number, lng: number) => {
      const { data, error } = await supabase.rpc("nearby_orte", { user_lat: lat, user_lng: lng });
      if (error || !data || !mountedRef.current) return;
      const ids = (data as { id: number }[]).map((p) => p.id);
      orderedIdsRef.current = ids;
      setOrderedIds(ids);
      doneRef.current = true;
      setStatus("ready");
    };

    try {
      const { status: permission, canAskAgain } =
        await Location.requestForegroundPermissionsAsync();
      // Odmowa uprawnien to normalny wybor uzytkownika, nie awaria — sam
      // breadcrumb. Nie ustawiamy doneRef: zgoda moze zostac przyznana
      // pozniej (przycisk na liscie albo ustawienia systemu).
      if (permission !== "granted") {
        Sentry.addBreadcrumb({
          category: "gps-sort",
          message: `permission ${permission} (canAskAgain: ${canAskAgain})`,
          level: "info",
        });
        if (mountedRef.current) setStatus(canAskAgain ? "denied" : "blocked");
        return;
      }

      // Pozycja z cache jest natychmiastowa i w praktyce ratuje sytuacje,
      // gdy fix GPS sie nie lapie. Dokladniejszy odczyt i tak ja nadpisze.
      const lastPos = await Location.getLastKnownPositionAsync().catch(() => null);
      if (lastPos && mountedRef.current) {
        await fetchSorted(lastPos.coords.latitude, lastPos.coords.longitude);
      }

      const pos = await withPositionTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      );
      if (mountedRef.current) {
        await fetchSorted(pos.coords.latitude, pos.coords.longitude);
      }
    } catch (e) {
      // Ostatnia znana pozycja mogla juz posortowac liste — wtedy to nie jest
      // blad dla uzytkownika, tylko brak dokladniejszego odczytu.
      if (!doneRef.current && mountedRef.current) setStatus("error");
      if (!reportedRef.current) {
        reportedRef.current = true;
        Sentry.captureException(e, { tags: { feature: "gps-sort" } });
      }
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!dataReady || !isFocused || doneRef.current) return;
    void run();
  }, [dataReady, isFocused, run]);

  /**
   * Manueller Auslöser für den Button in der Liste. Liegt schon eine
   * Sortierung vor (z. B. weil der Nutzer zwischendurch eine Region gewählt
   * hat), wird sie ohne neue Ortung wiederhergestellt.
   */
  const sortByLocation = useCallback(() => {
    if (orderedIdsRef.current) {
      setOrderedIds(orderedIdsRef.current);
      setStatus("ready");
      return;
    }
    void run();
  }, [run]);

  return { orderedIds, setOrderedIds, orderedIdsRef, status, sortByLocation };
}
