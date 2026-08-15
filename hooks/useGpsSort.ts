import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import { useIsFocused } from "@react-navigation/native";
import { supabase } from "@/lib/supabase";

export function useGpsSort(dataReady: boolean): {
  orderedIds: number[] | null;
  setOrderedIds: React.Dispatch<React.SetStateAction<number[] | null>>;
  orderedIdsRef: React.MutableRefObject<number[] | null>;
} {
  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);
  const orderedIdsRef = useRef<number[] | null>(null);
  const isFocused = useIsFocused();
  // Zapala sie dopiero po udanym posortowaniu. Wczesniej byl ustawiany od razu
  // na wejsciu do efektu, wiec pojedyncza odmowa uprawnien albo nieudany odczyt
  // GPS wylaczaly sortowanie po odleglosci az do restartu aplikacji — mapa
  // (wlasny flow uprawnien) dzialala, lista juz nie.
  const doneRef = useRef(false);
  // Chroni przed rownoleglymi przebiegami przy szybkim przelaczaniu zakladek.
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!dataReady || !isFocused || doneRef.current || inFlightRef.current) return;
    inFlightRef.current = true;

    let mounted = true;

    const fetchSorted = async (lat: number, lng: number) => {
      const { data, error } = await supabase.rpc("nearby_orte", { user_lat: lat, user_lng: lng });
      if (error || !data || !mounted) return;
      const ids = (data as { id: number }[]).map((p) => p.id);
      orderedIdsRef.current = ids;
      setOrderedIds(ids);
      doneRef.current = true;
    };

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        // Brak zgody nie jest bledem trwalym — przy kolejnym wejsciu na zakladke
        // sprobujemy ponownie, bo user mogl ja w miedzyczasie przyznac.
        if (status !== "granted" || !mounted) return;

        const lastPos = await Location.getLastKnownPositionAsync().catch(() => null);
        if (lastPos && mounted) {
          await fetchSorted(lastPos.coords.latitude, lastPos.coords.longitude);
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }).catch(() => null);
        if (pos && mounted) {
          await fetchSorted(pos.coords.latitude, pos.coords.longitude);
        }
      } catch (e) {
        console.warn("[useGpsSort] sortowanie po odleglosci nieudane:", e);
      } finally {
        inFlightRef.current = false;
      }
    })();

    return () => {
      mounted = false;
    };
  }, [dataReady, isFocused]);

  return { orderedIds, setOrderedIds, orderedIdsRef };
}
