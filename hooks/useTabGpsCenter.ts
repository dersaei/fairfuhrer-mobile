import { useState, useRef, useEffect } from "react";
import * as Location from "expo-location";
import * as Sentry from "@sentry/react-native";
import { useIsFocused } from "@react-navigation/native";

const DEFAULT_CENTER: [number, number] = [10.0, 51.0];
const DEFAULT_ZOOM = 5;

export function useTabGpsCenter(dataReady: boolean): {
  center: [number, number];
  zoom: number;
} {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const isFocused = useIsFocused();
  const doneRef = useRef(false);

  useEffect(() => {
    if (!dataReady || !isFocused || doneRef.current) return;
    doneRef.current = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Sentry.captureMessage("tab-gps-center: permission not granted", {
            level: "warning",
            tags: { feature: "gps-tab-center" },
            extra: { status },
          });
          return;
        }
        // Timeout — bez fixa GPS getCurrentPositionAsync potrafi wisiec bez konca.
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("getCurrentPositionAsync timeout (10s)")), 10000),
          ),
        ]);
        setCenter([pos.coords.longitude, pos.coords.latitude]);
        setZoom(10);
      } catch (e) {
        // zostaje domyślne centrum — ale logujemy realny powód
        Sentry.captureException(e, { tags: { feature: "gps-tab-center" } });
      }
    })();
  }, [dataReady, isFocused]);

  return { center, zoom };
}
