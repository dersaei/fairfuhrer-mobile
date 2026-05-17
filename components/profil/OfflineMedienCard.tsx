import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import {
  clearMediaCache,
  downloadMedia,
  getAvailableDiskSpace,
  getMediaCacheSize,
  type MediaDownloadProgress,
  type MediaKind,
} from "@/lib/mediaCache";
import { collectOfflineAudioUrls, collectOfflineImageUrls } from "@/lib/mediaUrls";
import { formatPackSize } from "@/lib/offlineMaps";
import { usePlacesStore } from "@/stores/placesStore";

// ─── Offline-Medien-Karte ────────────────────────────────────────────────────
//
// Untergeordnete Karte der Offline-Sektion. Zeigt:
//  • Speichernutzung (Fotos / Audio) mit Lösch-Option,
//  • separaten Download für Fotos und Audioguides — jeweils eine bewusste
//    Nutzerentscheidung, da beide den Speicherbedarf deutlich erhöhen.
//
// Wichtig: Größen werden NICHT als feste MB-Werte angezeigt (die Directus-
// Sammlung ändert sich). Stattdessen wird die Anzahl der Dateien aus den
// aktuellen Daten berechnet, und während des Downloads wächst die Größe live.

export function OfflineMedienCard() {
  const [imageSize, setImageSize] = useState(0);
  const [audioSize, setAudioSize] = useState(0);
  // Welcher Medientyp gerade lädt (null = kein Download aktiv).
  const [activeKind, setActiveKind] = useState<MediaKind | null>(null);
  const [progress, setProgress] = useState<MediaDownloadProgress | null>(null);
  // Live wachsende Cache-Größe des gerade ladenden Typs.
  const [liveSize, setLiveSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Anzahl der zu ladenden Dateien — aus den aktuellen Directus-Daten, also
  // immer korrekt, auch wenn sich die Sammlung ändert.
  const places = usePlacesStore((st) => st.places);
  const imageCount = useMemo(() => collectOfflineImageUrls(places).length, [places]);
  const audioCount = useMemo(() => collectOfflineAudioUrls(places).length, [places]);

  const refreshSizes = useCallback(() => {
    if (!isMountedRef.current) return;
    setImageSize(getMediaCacheSize("image"));
    setAudioSize(getMediaCacheSize("audio"));
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    refreshSizes();
    return () => {
      isMountedRef.current = false;
    };
  }, [refreshSizes]);

  // Eigentlicher Download — wird nach Bestätigung aufgerufen.
  const runDownload = useCallback(
    async (kind: MediaKind) => {
      if (activeKind) return;
      const noun = kind === "image" ? "Fotos" : "Audioguides";
      setError(null);

      // Mindestens benötigter freier Speicher — konservativer Schwellwert.
      // Verhindert, dass der Download bei vollem Gerät mitten im Vorgang
      // mit einem kryptischen Fehler abbricht.
      const MIN_FREE_BYTES = 200 * 1024 * 1024;
      const free = getAvailableDiskSpace();
      if (free !== null && free < MIN_FREE_BYTES) {
        setError(
          "Nicht genügend freier Speicher auf dem Gerät. Bitte gib " +
            "Speicherplatz frei und versuche es erneut.",
        );
        return;
      }

      setActiveKind(kind);
      setLiveSize(0);
      try {
        const all = usePlacesStore.getState().places;
        const urls =
          kind === "image"
            ? collectOfflineImageUrls(all)
            : collectOfflineAudioUrls(all);
        if (urls.length === 0) {
          setError(`Keine ${noun} zum Herunterladen verfügbar.`);
          return;
        }
        const result = await downloadMedia(kind, urls, (p) => {
          if (!isMountedRef.current) return;
          setProgress(p);
          // Größe live aktualisieren, damit der Nutzer den realen
          // Speicherbedarf während des Downloads sieht.
          setLiveSize(getMediaCacheSize(kind));
        });
        if (!isMountedRef.current) return;
        if (result.failed > 0 && result.completed === 0) {
          setError(`${noun} konnten nicht heruntergeladen werden.`);
        } else if (result.failed > 0) {
          // Teilweiser Fehlschlag — nicht still verschlucken, sonst wundert
          // sich der Nutzer, warum manche Inhalte offline fehlen.
          setError(
            `${result.failed} von ${result.total} ${noun} konnten nicht ` +
              "geladen werden. Versuche es bei bestehender Verbindung erneut.",
          );
        }
        refreshSizes();
      } catch {
        if (isMountedRef.current) {
          setError(`${noun} konnten nicht heruntergeladen werden.`);
        }
      } finally {
        if (isMountedRef.current) {
          setActiveKind(null);
          setProgress(null);
        }
      }
    },
    [activeKind, refreshSizes],
  );

  // Download anstoßen. Audioguides können sehr groß sein (> 1 GB), daher
  // immer mit deutlicher Warnung und Bestätigung.
  const handleDownload = useCallback(
    (kind: MediaKind) => {
      if (activeKind) return;
      if (kind === "audio") {
        Alert.alert(
          "Audioguides herunterladen",
          `Es werden ${audioCount} Audioguides heruntergeladen. ` +
            "Audiodateien sind groß und können je nach Anzahl mehrere hundert " +
            "Megabyte bis über ein Gigabyte Speicherplatz belegen. Wir empfehlen " +
            "den Download über WLAN und genügend freien Speicher.",
          [
            { text: "Abbrechen", style: "cancel" },
            { text: "Herunterladen", onPress: () => void runDownload("audio") },
          ],
        );
        return;
      }
      void runDownload(kind);
    },
    [activeKind, audioCount, runDownload],
  );

  const confirmClear = useCallback(
    (kind: MediaKind, label: string) => {
      if (activeKind) return;
      Alert.alert(
        label + " entfernen",
        "Möchtest du die offline gespeicherten " + label + " von diesem Gerät entfernen?",
        [
          { text: "Abbrechen", style: "cancel" },
          {
            text: "Entfernen",
            style: "destructive",
            onPress: () => {
              clearMediaCache(kind);
              refreshSizes();
            },
          },
        ],
      );
    },
    [activeKind, refreshSizes],
  );

  const hasImages = imageSize > 0;
  const hasAudio = audioSize > 0;
  const isWorking = activeKind !== null;
  const progressCount = progress ? progress.completed + progress.failed : 0;

  // Eine Download-Zeile (Foto oder Audio): zeigt Fortschritt mit live
  // wachsender Größe, wenn dieser Typ gerade lädt, sonst den Button mit
  // der aktuellen Anzahl der Dateien.
  const renderDownloadRow = (
    kind: MediaKind,
    noun: string,
    fileCount: number,
    hasCache: boolean,
  ) => {
    if (activeKind === kind && progress) {
      const pct =
        progress.total > 0 ? Math.round((progressCount / progress.total) * 100) : 0;
      return (
        <View style={{ gap: 6, marginTop: 8 }}>
          <View style={s.progressTrack}>
            <View style={[s.progressBar, { width: `${pct}%` }]} />
          </View>
          <Text style={s.progressText}>
            {noun}: {progressCount} / {progress.total}
            {liveSize > 0 ? ` · ${formatPackSize(liveSize)}` : ""}
          </Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={[s.button, isWorking && s.buttonDisabled, { marginTop: 8 }]}
        onPress={() => handleDownload(kind)}
        disabled={isWorking || fileCount === 0}
      >
        <Text style={s.buttonText}>
          {hasCache
            ? `${noun} aktualisieren (${fileCount})`
            : `${noun} herunterladen (${fileCount})`}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>Offline-Medien</Text>
      <Text style={s.cardMeta}>
        Fotos und Audioguides werden nicht automatisch mit der Karte geladen.
        Du kannst sie hier einzeln herunterladen und so den Speicherbedarf
        selbst bestimmen. Audioguides können je nach Anzahl sehr viel
        Speicherplatz belegen.
      </Text>

      {/* Speichernutzung */}
      <View style={s.usageRow}>
        <Text style={s.usageLabel}>Fotos ({imageCount})</Text>
        <Text style={s.usageValue}>{hasImages ? formatPackSize(imageSize) : "—"}</Text>
      </View>
      <View style={s.usageRow}>
        <Text style={s.usageLabel}>Audioguides ({audioCount})</Text>
        <Text style={s.usageValue}>{hasAudio ? formatPackSize(audioSize) : "—"}</Text>
      </View>

      {error && <Text style={s.errorText}>{error}</Text>}

      {/* Foto-Download */}
      {renderDownloadRow("image", "Fotos", imageCount, hasImages)}

      {/* Audio-Download */}
      {renderDownloadRow("audio", "Audioguides", audioCount, hasAudio)}

      {/* Speicher freigeben */}
      {(hasImages || hasAudio) && (
        <View style={s.clearRow}>
          {hasImages && (
            <TouchableOpacity
              style={[s.clearBtn, isWorking && s.buttonDisabled]}
              onPress={() => confirmClear("image", "Fotos")}
              disabled={isWorking}
            >
              <Text style={s.clearBtnText}>Fotos entfernen</Text>
            </TouchableOpacity>
          )}
          {hasAudio && (
            <TouchableOpacity
              style={[s.clearBtn, isWorking && s.buttonDisabled]}
              onPress={() => confirmClear("audio", "Audioguides")}
              disabled={isWorking}
            >
              <Text style={s.clearBtnText}>Audioguides entfernen</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: "#e8e0d8",
    borderRadius: 16,
    padding: 18,
    gap: 8,
    backgroundColor: "#fafaf9",
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
  },
  cardMeta: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#666",
    lineHeight: 18,
  },
  usageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e0",
  },
  usageLabel: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#333",
  },
  usageValue: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#666",
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
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "#f0e8e0",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#fc6c14",
  },
  progressText: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#fc6c14",
  },
  clearRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  clearBtn: {
    borderWidth: 1.5,
    borderColor: "#c0392b",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearBtnText: {
    color: "#c0392b",
    fontSize: 13,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
});
