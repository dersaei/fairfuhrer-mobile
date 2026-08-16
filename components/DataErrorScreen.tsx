import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuth } from "@/context/AuthContext";

/**
 * Vollflächiger Fehler-Bildschirm, der erscheint wenn der initiale
 * Fetch der Fairführer-Daten fehlgeschlagen ist (kein Netz beim Start,
 * Directus/Render nicht erreichbar). Ohne diesen Screen zeigte die App
 * nur eine leere Karte ohne Erklärung.
 *
 * Auto-Retry passiert im `_layout.tsx` sobald das Netz zurückkommt
 * (via NetInfo). Zusätzlich hat der Nutzer hier einen manuellen Button.
 */
export default function DataErrorScreen() {
  const { fetchAll, status, isOffline } = usePlacesStore();
  const { isPro } = useAuth();

  const isRetrying = status === "loading";

  const handleRetry = () => {
    if (isRetrying) return;
    fetchAll(isPro);
  };

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <View style={s.content}>
        <Text style={s.emoji}>📡</Text>
        <Text style={s.title}>Keine Verbindung</Text>
        <Text style={s.body}>
          Wir konnten die Fairführer-Daten nicht laden. Prüfe deine Internetverbindung und versuche
          es erneut.
        </Text>

        <TouchableOpacity
          style={[s.primaryBtn, isRetrying && s.primaryBtnDisabled]}
          onPress={handleRetry}
          disabled={isRetrying}
          activeOpacity={0.85}
        >
          {isRetrying ? (
            <ActivityIndicator color="#fc6c14" />
          ) : (
            <Text style={s.primaryBtnText}>Erneut versuchen</Text>
          )}
        </TouchableOpacity>

        {isPro && isOffline && (
          <Text style={s.offlineHint}>
            Deine Offline-Karten stehen dir weiterhin zur Verfügung.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontFamily: "Anton_400Regular",
    fontSize: 32,
    color: "#181716",
    letterSpacing: 1,
    textAlign: "center",
  },
  body: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 320,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#181716",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    minWidth: 220,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: "#fc6c14",
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  offlineHint: {
    marginTop: 16,
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
  },
});
