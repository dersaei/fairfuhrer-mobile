import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from "react-native";
import {
  OFFLINE_PACK_LABEL,
  OFFLINE_PACK_ESTIMATED_SIZE_LABEL,
  deleteOfflinePack,
  formatPackSize,
  getOfflinePackStatus,
  startOfflinePackDownload,
  unsubscribeOfflinePack,
  type OfflinePackStatus,
} from "@/lib/offlineMaps";
import { clearPlacesCache, formatCacheDate, loadPlacesCache } from "@/lib/placesCache";
import { clearAllMediaCache } from "@/lib/mediaCache";
import { usePlacesStore } from "@/stores/placesStore";
import { OfflineMedienCard } from "@/components/profil/OfflineMedienCard";

export default function OfflineKartenSection({ isPro }: { isPro: boolean }) {
  const [status, setStatus] = useState<OfflinePackStatus | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Datum der zuletzt gespeicherten Offline-Daten (Orte), formatiert DD.MM.YYYY.
  const [cacheDate, setCacheDate] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const cacheCurrentPlaces = usePlacesStore((st) => st.cacheCurrentPlaces);

  // Liest das Datum des lokalen Orte-Cache neu ein.
  const refreshCacheDate = useCallback(async () => {
    const cached = await loadPlacesCache();
    if (isMountedRef.current) {
      setCacheDate(cached ? formatCacheDate(cached.savedAt) : null);
    }
  }, []);

  // Sprawdź aktualny status paczki przy wejściu na ekran i wyrejestruj
  // listenery RNMapbox przy odmontowaniu.
  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      try {
        const current = await getOfflinePackStatus();
        if (isMountedRef.current) setStatus(current);
      } catch {
        if (isMountedRef.current) setStatus(null);
      } finally {
        if (isMountedRef.current) setIsInitializing(false);
      }
      await refreshCacheDate();
    })();
    return () => {
      isMountedRef.current = false;
      unsubscribeOfflinePack();
    };
  }, [refreshCacheDate]);

  const handleProgress = useCallback(
    (next: OfflinePackStatus) => {
      if (!isMountedRef.current) return;
      setStatus(next);
      if (next.state === "complete") {
        unsubscribeOfflinePack();
        // Po pobraniu mapy: zapisz piny Directusa i odśwież datę. Zdjęcia
        // i audio pobiera się osobno (OfflineMedienCard). Fire-and-forget.
        void cacheCurrentPlaces()
          .then(refreshCacheDate)
          .finally(() => {
            if (isMountedRef.current) setIsWorking(false);
          });
      }
    },
    [cacheCurrentPlaces, refreshCacheDate],
  );

  const handleError = useCallback((err: { message: string }) => {
    if (!isMountedRef.current) return;
    setError(err.message);
    setIsWorking(false);
    unsubscribeOfflinePack();
  }, []);

  const handleDownload = useCallback(async () => {
    if (!isPro || isWorking) return;
    setError(null);
    setIsWorking(true);
    try {
      const initial = await startOfflinePackDownload(handleProgress, handleError, isPro);
      if (!isMountedRef.current) return;
      setStatus(initial);
      if (initial.state === "complete") {
        // Paczka mapy istniała już wcześniej (handleProgress się nie odpali) —
        // upewnij się, że cache pinów też istnieje.
        void cacheCurrentPlaces()
          .then(refreshCacheDate)
          .finally(() => {
            if (isMountedRef.current) setIsWorking(false);
          });
      }
    } catch (e) {
      if (!isMountedRef.current) return;
      const message = e instanceof Error ? e.message : "Download konnte nicht gestartet werden.";
      setError(message);
      setIsWorking(false);
    }
  }, [cacheCurrentPlaces, handleError, handleProgress, isPro, isWorking, refreshCacheDate]);

  const handleDelete = useCallback(() => {
    if (isWorking) return;
    Alert.alert(
      "Offline-Karte entfernen",
      "Möchtest du die Offline-Karte „" +
        OFFLINE_PACK_LABEL +
        "“ wirklich von diesem Gerät entfernen?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Entfernen",
          style: "destructive",
          onPress: async () => {
            setIsWorking(true);
            setError(null);
            try {
              await deleteOfflinePack();
              // Usuń też cache pinów i mediów — offline mapa, piny i media
              // mają być spójne (usunięcie paczki usuwa wszystko).
              await clearPlacesCache();
              clearAllMediaCache();
              if (!isMountedRef.current) return;
              setStatus(null);
              setCacheDate(null);
            } catch {
              if (!isMountedRef.current) return;
              setError("Offline-Karte konnte nicht entfernt werden.");
            } finally {
              if (isMountedRef.current) setIsWorking(false);
            }
          },
        },
      ],
    );
  }, [isWorking]);

  const isComplete = status?.state === "complete";
  const isDownloading = status?.state === "active" || (isWorking && !isComplete);
  const percent = Math.max(0, Math.min(100, Math.round(status?.percentage ?? 0)));

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Offline-Karten</Text>
      <Text style={s.sectionHint}>
        Lade Kartenkacheln für eine ausgewählte Region auf dein Gerät, damit die Karte auch ohne
        Internetverbindung funktioniert. Die Inhalte (Pins und Beschreibungen) bleiben weiterhin
        online.
      </Text>

      {!isPro && (
        <View style={s.premiumInfo}>
          <Text style={s.premiumInfoTitle}>Offline-Karten mit Fairführer+</Text>
          <Text style={s.premiumInfoText}>
            Mit einem Premium-Konto kannst du die Karte der Region Bodensee &amp;
            Allgäu auf dein Gerät laden und unterwegs ohne Internetverbindung
            nutzen – ideal für Wandern, Reisen und Gebiete mit schlechtem Empfang.
          </Text>
          <Text style={s.premiumInfoText}>
            Im Offline-Modus stehen dir zur Verfügung:
          </Text>
          <Text style={s.premiumInfoBullet}>
            • das Kartenbild der Region (Straßen, Orte, Gelände){"\n"}
            • alle Pins mit Namen und Beschreibungen{"\n"}
            • die Suche nach gespeicherten Orten
          </Text>
          <Text style={s.premiumInfoText}>
            Fotos und Audioguides kannst du als Premium-Nutzer zusätzlich und
            einzeln herunterladen. Was du nicht herunterlädst, wird wie gewohnt
            online geladen und ist ohne Verbindung nicht verfügbar.
          </Text>
        </View>
      )}

      <View style={s.offlinePackCard}>
        <View style={s.offlinePackHeader}>
          <Text style={s.offlinePackTitle}>{OFFLINE_PACK_LABEL}</Text>
          {isComplete && (
            <View style={s.offlinePackBadge}>
              <Text style={s.offlinePackBadgeText}>Verfügbar</Text>
            </View>
          )}
        </View>
        <Text style={s.offlinePackMeta}>
          Region rund um den Bodensee und das Allgäu. Zoom-Stufen 6 bis 14.
        </Text>

        {!isInitializing && !isComplete && !isDownloading && (
          <>
            <View style={s.offlineNote}>
              <Text style={s.offlineNoteText}>
                Dieser Download umfasst nur das Kartenbild der Region. Fotos und Audioguides kannst
                du anschließend separat herunterladen – so behältst du die Kontrolle über den
                Speicherbedarf.
              </Text>
            </View>
            <Text style={s.offlinePackMeta}>
              Geschätzte Größe der Karte: {OFFLINE_PACK_ESTIMATED_SIZE_LABEL}. Du kannst sie sowohl
              über WLAN als auch über mobile Daten herunterladen – ganz wie es dir passt. Bei
              mobilen Daten kann dies einen Teil deines Datenvolumens verbrauchen.
            </Text>
          </>
        )}

        {isInitializing && (
          <View style={s.offlineInline}>
            <ActivityIndicator color="#fc6c14" />
            <Text style={s.offlineInlineText}>Status wird geprüft…</Text>
          </View>
        )}

        {!isInitializing && isDownloading && (
          <View style={{ gap: 6, marginTop: 4 }}>
            <View style={s.offlineProgressTrack}>
              <View style={[s.offlineProgressBar, { width: `${percent}%` }]} />
            </View>
            <Text style={s.offlineProgressText}>
              {`Wird heruntergeladen… ${percent} %${
                status && status.completedResourceSize > 0
                  ? ` · ${formatPackSize(status.completedResourceSize)}`
                  : ""
              }`}
            </Text>
          </View>
        )}

        {!isInitializing && isComplete && (
          <>
            <Text style={s.offlinePackMeta}>
              {`Heruntergeladen: ${formatPackSize(status?.completedResourceSize ?? 0)}`}
            </Text>
            {cacheDate && (
              <Text style={s.offlinePackMeta}>
                {`Zuletzt aktualisiert: ${cacheDate}`}
              </Text>
            )}
          </>
        )}

        {error && <Text style={s.errorText}>{error}</Text>}

        {/* Download-Button — nur für Premium. Nicht-Premium sieht den
            Hinweis-Block oben (Fairführer+). Harter Gate. */}
        {isPro && !isInitializing && !isComplete && (
          <TouchableOpacity
            style={[s.button, isDownloading && s.buttonDisabled, { marginTop: 12 }]}
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator color="#fc6c14" />
            ) : (
              <Text style={s.buttonText}>Bodensee &amp; Allgäu herunterladen</Text>
            )}
          </TouchableOpacity>
        )}

        {!isInitializing && isComplete && (
          <TouchableOpacity
            style={[s.buttonOutline, isWorking && s.buttonDisabled, { marginTop: 12 }]}
            onPress={handleDelete}
            disabled={isWorking}
          >
            <Text style={s.buttonOutlineText}>Offline-Karte entfernen</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Medien-Verwaltung — sichtbar, sobald die Karte geladen ist. Fotos
          und Audioguides werden dort einzeln verwaltet. */}
      {!isInitializing && isComplete && <OfflineMedienCard />}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
    letterSpacing: 0.3,
  },
  sectionHint: {
    fontSize: 15,
    color: "#000",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 18,
  },
  premiumInfo: {
    backgroundColor: "#fff5ef",
    borderWidth: 1,
    borderColor: "#fcd9c2",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  premiumInfoTitle: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#7a4a22",
  },
  premiumInfoText: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#7a4a22",
    lineHeight: 18,
  },
  premiumInfoBullet: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#7a4a22",
    lineHeight: 20,
    paddingLeft: 4,
  },
  errorText: {
    color: "#c0392b",
    fontSize: 13,
    backgroundColor: "#fff0ee",
    borderWidth: 1,
    borderColor: "#fcd5cf",
    padding: 10,
    borderRadius: 10,
    width: "100%",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  button: {
    width: "100%",
    backgroundColor: "#000",
    paddingTop: 12,
    paddingBottom: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: "#fc6c14",
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  buttonOutline: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonOutlineText: {
    color: "#111",
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },

  // Offline-Karten
  offlinePackCard: {
    borderWidth: 1.5,
    borderColor: "#e8e0d8",
    borderRadius: 16,
    padding: 18,
    gap: 8,
    backgroundColor: "#fafaf9",
  },
  offlinePackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  offlinePackTitle: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
  },
  offlinePackBadge: {
    backgroundColor: "#2D6A4F",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  offlinePackBadgeText: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  offlinePackMeta: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#666",
    lineHeight: 18,
  },
  offlineProgressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f0e8e0",
    overflow: "hidden",
  },
  offlineProgressBar: {
    height: "100%",
    backgroundColor: "#fc6c14",
  },
  offlineProgressText: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#fc6c14",
  },
  offlineInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  offlineInlineText: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#666",
  },
  offlineNote: {
    backgroundColor: "#fff9f0",
    borderWidth: 1,
    borderColor: "#f0e0c8",
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  offlineNoteText: {
    fontSize: 12,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#7a6a4a",
    lineHeight: 17,
  },
});
