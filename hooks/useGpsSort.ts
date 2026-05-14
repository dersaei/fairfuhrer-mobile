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
  const donRef = useRef(false);

  useEffect(() => {
    if (!dataReady || !isFocused || donRef.current) return;
    donRef.current = true;

    let mounted = true;

    const fetchSorted = (lat: number, lng: number) => {
      supabase.rpc("nearby_orte", { user_lat: lat, user_lng: lng }).then(({ data, error }) => {
        if (error || !data || !mounted) return;
        const ids = (data as { id: number }[]).map((p) => p.id);
        orderedIdsRef.current = ids;
        setOrderedIds(ids);
      });
    };

    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== "granted" || !mounted) return;

        Location.getLastKnownPositionAsync()
          .then((lastPos) => {
            if (lastPos && mounted) {
              const { latitude, longitude } = lastPos.coords;
              fetchSorted(latitude, longitude);
            }
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
              .then((pos) => {
                if (!mounted) return;
                fetchSorted(pos.coords.latitude, pos.coords.longitude);
              })
              .catch(() => {});
          })
          .catch(() => {});
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [dataReady, isFocused]);

  return { orderedIds, setOrderedIds, orderedIdsRef };
}
