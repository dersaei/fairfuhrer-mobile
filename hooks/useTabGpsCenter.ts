import { useState, useRef } from "react";
import { useEffect } from "react";
import * as Location from "expo-location";
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
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCenter([pos.coords.longitude, pos.coords.latitude]);
          setZoom(10);
        }
      } catch {
        /* zostaje domyślne centrum */
      }
    })();
  }, [dataReady, isFocused]);

  return { center, zoom };
}
