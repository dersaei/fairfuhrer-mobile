import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { User } from "@supabase/supabase-js";
import { apiFetch } from "@/lib/apiAuth";
import { getRedaktionPageContent, type RedaktionPageContent } from "@/lib/directus";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Types ──────────────────────────────────────────────────────────────────

interface GeoSuggestion {
  place_name: string;
  center: [number, number];
  text: string;
  address?: string;
  context?: { id: string; text: string }[];
}

interface Props {
  user: User | null;
}

// ─── Fallback texts ─────────────────────────────────────────────────────────

const DEFAULTS = {
  title: "Audiopin für Sehenswertes erstellen",
  subtitle:
    "Werde Mitgestalter*in unseres fairen Reiseführers und hilf anderen Reisenden, einen Ort zu entdecken, der einen Besuch wert ist.",
  label_name: "Name des Ortes",
  label_adresse: "Straße & Hausnummer",
  label_stadt: "Stadt",
  label_land: "Land",
  label_beschreibung: "Beschreibung",
  label_titelbild: "Titelbild",
  label_audio: "Audiodatei",
  label_galerie: "Galerie (max. 6 Bilder)",
  hint_moderation:
    "Alle eingereichten Pins werden vor der Veröffentlichung von unserem Team geprüft. Bitte gib möglichst genaue Informationen an, damit wir deinen Beitrag schnell freischalten können.",
  button_text: "Einreichen",
  button_sending_text: "Wird gesendet…",
  success_message: "Vielen Dank! Dein Pin wurde eingereicht und wird nun redaktionell geprüft.",
  error_message: "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
};

// ─── Upload helper — przez web API /api/directus-upload ─────────────────────

async function uploadFile(uri: string, filename: string, mimeType: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    // React Native FormData przyjmuje obiekt z uri/name/type — bez File API.
    // Cast na any bo TS typuje FormData zbyt strictly dla RN.
    uri,
    name: filename,
    type: mimeType,
  } as any);

  const res = await apiFetch("/api/directus-upload", {
    method: "POST",
    body: formData,
    // Uwaga: NIE ustawiaj Content-Type — RN automatycznie doda multipart boundary.
  });

  if (!res.ok) {
    throw new Error(`Upload fehlgeschlagen (${res.status})`);
  }
  const data = await res.json();
  return data.id as string;
}

// ─── Mapbox geocoding ───────────────────────────────────────────────────────

async function fetchGeoSuggestions(query: string): Promise<GeoSuggestion[]> {
  if (query.trim().length < 3 || !MAPBOX_TOKEN) return [];
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query,
    )}.json?language=de&limit=5&types=address,poi&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    const json = await res.json();
    return (json.features ?? []) as GeoSuggestion[];
  } catch {
    return [];
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RedaktionSection({ user: _user }: Props) {
  // Content z Directus (analog web).
  const [content, setContent] = useState<RedaktionPageContent | null>(null);
  useEffect(() => {
    let active = true;
    getRedaktionPageContent().then((c) => {
      if (active) setContent(c);
    });
    return () => {
      active = false;
    };
  }, []);

  const t = {
    title: content?.title || DEFAULTS.title,
    subtitle: content?.subtitle || DEFAULTS.subtitle,
    label_name: content?.label_name || DEFAULTS.label_name,
    label_adresse: content?.label_adresse || DEFAULTS.label_adresse,
    label_stadt: content?.label_stadt || DEFAULTS.label_stadt,
    label_land: content?.label_land || DEFAULTS.label_land,
    label_beschreibung: content?.label_beschreibung || DEFAULTS.label_beschreibung,
    label_titelbild: content?.label_titelbild || DEFAULTS.label_titelbild,
    label_audio: content?.label_audio || DEFAULTS.label_audio,
    label_galerie: content?.label_galerie || DEFAULTS.label_galerie,
    hint_moderation: content?.hint_moderation || DEFAULTS.hint_moderation,
    button_text: content?.button_text || DEFAULTS.button_text,
    button_sending_text: content?.button_sending_text || DEFAULTS.button_sending_text,
    success_message: content?.success_message || DEFAULTS.success_message,
    error_message: content?.error_message || DEFAULTS.error_message,
  };

  // Form fields
  const [name, setName] = useState("");
  const [adresse, setAdresse] = useState("");
  const [stadt, setStadt] = useState("");
  const [land, setLand] = useState("");
  const [vollbeschreibung, setVollbeschreibung] = useState("");
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Mapbox
  const [geoQuery, setGeoQuery] = useState("");
  const [geoSuggestions, setGeoSuggestions] = useState<GeoSuggestion[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const geoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Uploads
  const [titelbildId, setTitelbildId] = useState<string | null>(null);
  const [titelbildPreview, setTitelbildPreview] = useState<string | null>(null);
  const [titelbildUploading, setTitelbildUploading] = useState(false);

  const [audioId, setAudioId] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);

  const [galerieIds, setGalerieIds] = useState<string[]>([]);
  const [galeriePreviews, setGaleriePreviews] = useState<string[]>([]);
  const [galerieUploading, setGalerieUploading] = useState(false);

  // Submit state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Mapbox handlers ──
  function handleGeoQueryChange(value: string) {
    setGeoQuery(value);
    setAdresse(value);
    if (geoDebounceRef.current) clearTimeout(geoDebounceRef.current);
    geoDebounceRef.current = setTimeout(async () => {
      setGeoLoading(true);
      const suggestions = await fetchGeoSuggestions(value);
      setGeoSuggestions(suggestions);
      setGeoLoading(false);
    }, 300);
  }

  function selectGeoSuggestion(s: GeoSuggestion) {
    const [lng, lat] = s.center;
    const plzContext = s.context?.find((c) => c.id.startsWith("postcode."));
    const cityContext = s.context?.find((c) => c.id.startsWith("place."));
    const countryContext = s.context?.find((c) => c.id.startsWith("country."));
    const streetPart = s.address ? `${s.text} ${s.address}` : s.text;
    const adressPart = plzContext ? `${streetPart}, ${plzContext.text}` : streetPart;
    setAdresse(adressPart);
    setGeoQuery(s.place_name);
    setCoordinates({ lat, lng });
    if (cityContext) setStadt(cityContext.text);
    if (countryContext) setLand(countryContext.text);
    setGeoSuggestions([]);
  }

  // ── Upload handlers ──
  async function pickTitelbild() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setTitelbildUploading(true);
    setError(null);
    try {
      const filename = asset.fileName ?? `titelbild-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const id = await uploadFile(asset.uri, filename, mimeType);
      setTitelbildId(id);
      setTitelbildPreview(asset.uri);
    } catch {
      setError("Titelbild-Upload fehlgeschlagen.");
    } finally {
      setTitelbildUploading(false);
    }
  }

  async function pickAudio() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAudioUploading(true);
    setError(null);
    try {
      const filename = asset.name;
      const mimeType = asset.mimeType ?? "audio/mpeg";
      const id = await uploadFile(asset.uri, filename, mimeType);
      setAudioId(id);
      setAudioName(filename);
    } catch {
      setError("Audio-Upload fehlgeschlagen.");
    } finally {
      setAudioUploading(false);
    }
  }

  async function pickGalerie() {
    const remaining = 6 - galerieIds.length;
    if (remaining <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled) return;
    setGalerieUploading(true);
    setError(null);
    try {
      const newIds: string[] = [];
      const newPreviews: string[] = [];
      for (const asset of result.assets.slice(0, remaining)) {
        const filename = asset.fileName ?? `galerie-${Date.now()}.jpg`;
        const mimeType = asset.mimeType ?? "image/jpeg";
        const id = await uploadFile(asset.uri, filename, mimeType);
        newIds.push(id);
        newPreviews.push(asset.uri);
      }
      setGalerieIds((p) => [...p, ...newIds]);
      setGaleriePreviews((p) => [...p, ...newPreviews]);
    } catch {
      setError("Galerie-Upload fehlgeschlagen.");
    } finally {
      setGalerieUploading(false);
    }
  }

  function removeGalerieItem(idx: number) {
    setGalerieIds((p) => p.filter((_, i) => i !== idx));
    setGaleriePreviews((p) => p.filter((_, i) => i !== idx));
  }

  // ── Submit ──
  async function handleSubmit() {
    setError(null);
    if (!name.trim() || !adresse.trim() || !stadt.trim()) {
      setError("Name, Adresse und Stadt sind erforderlich.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiFetch("/api/redaktion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Name: name.trim(),
          Adresse: adresse.trim(),
          Stadt: stadt.trim(),
          Land: land.trim() || null,
          Breite: coordinates?.lat ?? null,
          Lange: coordinates?.lng ?? null,
          Vollbeschreibung: vollbeschreibung.trim() || null,
          Titelbild: titelbildId,
          Audio: audioId,
          Galerie: galerieIds.length > 0 ? galerieIds : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError("Bitte anmelden.");
        } else {
          setError(data.error ?? t.error_message);
        }
        setIsSubmitting(false);
        return;
      }
      setSuccess(true);
      // Reset form
      setName("");
      setAdresse("");
      setStadt("");
      setLand("");
      setVollbeschreibung("");
      setCoordinates(null);
      setGeoQuery("");
      setTitelbildId(null);
      setTitelbildPreview(null);
      setAudioId(null);
      setAudioName(null);
      setGalerieIds([]);
      setGaleriePreviews([]);
    } catch {
      setError(t.error_message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={s.section}>
        <Text style={s.title}>{t.title}</Text>
        <View style={s.successBox}>
          <Text style={s.successMsg}>{t.success_message}</Text>
          <TouchableOpacity style={s.newBtn} onPress={() => setSuccess(false)}>
            <Text style={s.newBtnText}>Neuen Pin einreichen</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.section}>
      <Text style={s.title}>{t.title}</Text>
      <Text style={s.subtitle}>{t.subtitle}</Text>

      {error && <Text style={s.errorText}>{error}</Text>}

      {/* Name */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>{t.label_name}</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} />
      </View>

      {/* Adresse — Mapbox autocomplete */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>{t.label_adresse}</Text>
        <TextInput
          style={s.input}
          value={geoQuery}
          onChangeText={handleGeoQueryChange}
          autoCapitalize="none"
        />
        {geoLoading && <Text style={s.hint}>Suche…</Text>}
        {geoSuggestions.length > 0 && (
          <View style={s.suggestions}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {geoSuggestions.map((sug, i) => (
                <TouchableOpacity
                  key={i}
                  style={s.suggestionBtn}
                  onPress={() => selectGeoSuggestion(sug)}
                >
                  <Text style={s.suggestionText}>{sug.place_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Stadt + Land */}
      <View style={s.fieldRow}>
        <View style={[s.fieldGroup, s.fieldHalf]}>
          <Text style={s.fieldLabel}>{t.label_stadt}</Text>
          <TextInput style={s.input} value={stadt} onChangeText={setStadt} />
        </View>
        <View style={[s.fieldGroup, s.fieldHalf]}>
          <Text style={s.fieldLabel}>{t.label_land}</Text>
          <TextInput style={s.input} value={land} onChangeText={setLand} />
        </View>
      </View>

      {/* Vollbeschreibung */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>{t.label_beschreibung}</Text>
        <TextInput
          style={[s.input, s.textarea]}
          value={vollbeschreibung}
          onChangeText={setVollbeschreibung}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Titelbild */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>{t.label_titelbild}</Text>
        {titelbildPreview && <Image source={{ uri: titelbildPreview }} style={s.imagePreview} />}
        <TouchableOpacity style={s.uploadBtn} onPress={pickTitelbild} disabled={titelbildUploading}>
          {titelbildUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.uploadBtnText}>{titelbildPreview ? "Bild ändern" : "Bild wählen"}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Audio */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>{t.label_audio}</Text>
        {audioName && <Text style={s.hint}>✓ {audioName}</Text>}
        <TouchableOpacity style={s.uploadBtn} onPress={pickAudio} disabled={audioUploading}>
          {audioUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.uploadBtnText}>{audioName ? "Datei ändern" : "Audiodatei wählen"}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Galerie */}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>{t.label_galerie}</Text>
        {galeriePreviews.length > 0 && (
          <View style={s.galerieRow}>
            {galeriePreviews.map((uri, i) => (
              <View key={i} style={s.galerieItem}>
                <Image source={{ uri }} style={s.galerieImg} />
                <TouchableOpacity style={s.galerieRemoveBtn} onPress={() => removeGalerieItem(i)}>
                  <Text style={s.galerieRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {galerieIds.length < 6 && (
          <TouchableOpacity style={s.uploadBtn} onPress={pickGalerie} disabled={galerieUploading}>
            {galerieUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.uploadBtnText}>Bilder hinzufügen</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[s.button, isSubmitting && s.buttonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fc6c14" />
        ) : (
          <Text style={s.buttonText}>{t.button_text}</Text>
        )}
      </TouchableOpacity>

      <Text style={s.hintCentered}>{t.hint_moderation}</Text>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  section: { gap: 14 },
  title: {
    fontSize: 24,
    fontFamily: "Anton_400Regular",
    color: "#18222f",
    textAlign: "center",
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#18222f",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 4,
  },
  fieldGroup: { width: "100%", gap: 6 },
  fieldRow: { flexDirection: "row", gap: 10 },
  fieldHalf: { flex: 1 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#000",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    paddingLeft: 4,
  },
  input: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#000",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: "#111",
    backgroundColor: "#fafafa",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  textarea: { height: 110, textAlignVertical: "top" },
  // Mapbox suggestions dropdown
  suggestions: {
    borderWidth: 1.5,
    borderColor: "#000",
    borderRadius: 12,
    backgroundColor: "#fff",
    maxHeight: 200,
    marginTop: 2,
  },
  suggestionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  suggestionText: {
    fontSize: 14,
    color: "#18222f",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  hint: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#555",
    lineHeight: 18,
    paddingLeft: 4,
  },
  hintCentered: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#555",
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 12,
  },
  errorText: {
    color: "#c0392b",
    fontSize: 13,
    backgroundColor: "#fff0ee",
    borderWidth: 1,
    borderColor: "#fcd5cf",
    padding: 10,
    borderRadius: 10,
    fontFamily: "FiraSansCondensed_400Regular",
  },
  imagePreview: {
    width: 200,
    height: 140,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  uploadBtn: {
    backgroundColor: "#18222f",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  uploadBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  galerieRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  galerieItem: {
    position: "relative",
    width: 90,
    height: 90,
  },
  galerieImg: {
    width: 90,
    height: 90,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#000",
  },
  galerieRemoveBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  galerieRemoveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },
  button: {
    width: "100%",
    backgroundColor: "#111",
    paddingTop: 12,
    paddingBottom: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: "#fc6c14",
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  successBox: {
    backgroundColor: "#f0faf5",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  successMsg: {
    fontSize: 14,
    color: "#2D6A4F",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 20,
  },
  newBtn: {
    backgroundColor: "#18222f",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  newBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "FiraSansCondensed_700Bold",
  },
});
