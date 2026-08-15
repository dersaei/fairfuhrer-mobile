import { Alert, Linking } from "react-native";
import * as Sentry from "@sentry/react-native";

// Linking.openURL odrzuca promise, gdy urzadzenie nie ma aplikacji obslugujacej
// dany schemat (brak klienta poczty, brak dialera) albo gdy URL jest zepsuty —
// np. blednie wpisany adres partnera w bazie. Bez zlapania tego leci
// nieobsluzone odrzucenie promise: uzytkownik nie dostaje zadnej informacji,
// a Sentry zapisuje to jako blad bez kontekstu.
//
// Kazde wywolanie openURL w aplikacji powinno isc przez ten helper.
export async function openExternalUrl(url: string, notAvailableMessage: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch (e) {
    Sentry.captureException(e, {
      tags: { feature: "external-link" },
      extra: { url },
    });
    Alert.alert("Link konnte nicht geöffnet werden", notAvailableMessage);
  }
}
