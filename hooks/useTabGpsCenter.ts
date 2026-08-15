import { useState, useRef, useEffect } from "react";
import * as Location from "expo-location";
import * as Sentry from "@sentry/react-native";
import { useIsFocused } from "@react-navigation/native";

const DEFAULT_CENTER: [number, number] = [10.0, 51.0];
const DEFAULT_ZOOM = 5;
const POSITION_TIMEOUT_MS = 10000;

// getCurrentPositionAsync potrafi wisiec bez konca, gdy urzadzenie nie moze
// zlapac fixa. Timer jest sprzatany takze przy sukcesie — inaczej zostawalby
// wiszacy setTimeout na kazde wejscie na zakladke.
function withPositionTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`getCurrentPositionAsync timeout (${POSITION_TIMEOUT_MS / 1000}s)`)),
      POSITION_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function useTabGpsCenter(dataReady: boolean): {
  center: [number, number];
  zoom: number;
} {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const isFocused = useIsFocused();
  // Zapala sie dopiero po ustawieniu realnej pozycji. Wczesniej byl ustawiany
  // od razu na wejsciu do efektu, wiec jedna odmowa uprawnien albo jeden
  // nieudany fix GPS zostawialy mape na domyslnym centrum Niemiec az do
  // restartu aplikacji — bez zadnej proby ponowienia.
  const doneRef = useRef(false);
  // Chroni przed rownoleglymi przebiegami przy szybkim przelaczaniu zakladek.
  const inFlightRef = useRef(false);
  // Nieudany odczyt raportujemy do Sentry raz na sesje. Bez tego ponawianie
  // zamienialoby jedno zepsute GPS w strumien identycznych zdarzen.
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!dataReady || !isFocused || doneRef.current || inFlightRef.current) return;
    inFlightRef.current = true;

    let mounted = true;

    const apply = (lat: number, lng: number) => {
      if (!mounted) return;
      setCenter([lng, lat]);
      setZoom(10);
      doneRef.current = true;
    };

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          // Odmowa uprawnien to normalny wybor uzytkownika, nie awaria — sam
          // breadcrumb, zeby nie zasmiecac listy issues. Nie ustawiamy
          // doneRef: przy kolejnym wejsciu sprobujemy ponownie, bo zgoda
          // mogla zostac w miedzyczasie przyznana w ustawieniach systemu.
          Sentry.addBreadcrumb({
            category: "gps-tab-center",
            message: `permission ${status}`,
            level: "info",
          });
          return;
        }

        // Pozycja z cache jest natychmiastowa i w praktyce ratuje sytuacje,
        // gdy fix GPS sie nie lapie. Dokladniejszy odczyt i tak ja nadpisze.
        const lastPos = await Location.getLastKnownPositionAsync().catch(() => null);
        if (lastPos) apply(lastPos.coords.latitude, lastPos.coords.longitude);

        const pos = await withPositionTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        );
        apply(pos.coords.latitude, pos.coords.longitude);
      } catch (e) {
        // Zostaje ostatnie znane centrum (albo domyslne) — logujemy powod.
        if (!reportedRef.current) {
          reportedRef.current = true;
          Sentry.captureException(e, { tags: { feature: "gps-tab-center" } });
        }
      } finally {
        inFlightRef.current = false;
      }
    })();

    return () => {
      mounted = false;
    };
  }, [dataReady, isFocused]);

  return { center, zoom };
}
