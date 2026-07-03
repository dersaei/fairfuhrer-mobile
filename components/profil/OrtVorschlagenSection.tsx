import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { User } from "@supabase/supabase-js";
import { useSubmitPlaceProposal, KATEGORIEN_KOMMERZIELL } from "@/hooks/useSubmitPlaceProposal";
import { getOrtVorschlagenContent, type OrtVorschlagenContent } from "@/lib/directus";

// Fallback-Texte, falls Directus nichts liefert.
// UWAGA v1.1.3: `premium_info` juz sie nie pokazuje (usuniete premium-gate).
// `hint_with_name/without_name` tez usuniete — email/imie/nazwisko idzie z sesji Supabase.
const DEFAULTS = {
  intro: "Kennen Sie einen fairen Ort, der auf unsere Karte gehört? Füllen Sie das Formular aus!",
  label_name: "Name des Ortes",
  label_adresse: "Adresse",
  label_beschreibung: "Warum sollte dieser Ort auf der Karte stehen?",
  label_kategorie: "Kategorie",
  button_text: "Vorschlag einreichen",
  hint_intro:
    "Ihr Vorschlag wird mit Ihren Kontodaten (E-Mail, Name) übermittelt und redaktionell geprüft.",
  success_message: "Vielen Dank für Ihren Vorschlag! Wir prüfen ihn und melden uns.",
};

interface Props {
  user: User | null;
  // isPremium zostaje w propsach dla kompat, ale ignorowane (v1.1.3: no premium-gate).
  isPremium?: boolean;
}

export default function OrtVorschlagenSection({ user }: Props) {
  const {
    name,
    setName,
    address,
    setAddress,
    description,
    setDescription,
    kategorieId,
    setKategorieId,
    isLoading,
    error,
    success,
    handleSubmit,
  } = useSubmitPlaceProposal(user);

  const [content, setContent] = useState<OrtVorschlagenContent | null>(null);

  useEffect(() => {
    let active = true;
    getOrtVorschlagenContent().then((c) => {
      if (active) setContent(c);
    });
    return () => {
      active = false;
    };
  }, []);

  const t = {
    intro: content?.intro || DEFAULTS.intro,
    label_name: content?.label_name || DEFAULTS.label_name,
    label_adresse: content?.label_adresse || DEFAULTS.label_adresse,
    label_beschreibung: content?.label_beschreibung || DEFAULTS.label_beschreibung,
    label_kategorie: DEFAULTS.label_kategorie,
    button_text: content?.button_text || DEFAULTS.button_text,
    hint_intro: content?.hint_intro || DEFAULTS.hint_intro,
    success_message: content?.success_message || DEFAULTS.success_message,
  };

  return (
    <View style={s.section}>
      <Text style={s.sectionHint}>{t.intro}</Text>

      {success ? (
        <View style={s.successBox}>
          <Text style={s.successMsg}>{t.success_message}</Text>
        </View>
      ) : (
        <>
          {error && <Text style={s.errorText}>{error}</Text>}

          {/* Kategorie selector — 4 komercyjne (Sehenswertes idzie przez Redaktion) */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>{t.label_kategorie}</Text>
            <View style={s.chipsRow}>
              {KATEGORIEN_KOMMERZIELL.map((k) => {
                const active = kategorieId === k.id;
                return (
                  <TouchableOpacity
                    key={k.id}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setKategorieId(k.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{k.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>{t.label_name}</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>{t.label_adresse}</Text>
            <TextInput style={s.input} value={address} onChangeText={setAddress} />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>{t.label_beschreibung}</Text>
            <TextInput
              style={[s.input, s.textarea]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          <Text style={s.hint}>{t.hint_intro}</Text>

          <TouchableOpacity
            style={[s.button, isLoading && s.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fc6c14" />
            ) : (
              <Text style={s.buttonText}>{t.button_text}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 12 },
  sectionHint: {
    fontSize: 20,
    color: "#000",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 22,
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#555",
    lineHeight: 18,
  },
  successBox: { backgroundColor: "#f0faf5", borderRadius: 12, padding: 16 },
  successMsg: {
    fontSize: 13,
    color: "#2D6A4F",
    fontFamily: "FiraSansCondensed_400Regular",
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
  fieldGroup: { width: "100%", gap: 6 },
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
    borderColor: "#000000",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: "#111",
    backgroundColor: "#fafafa",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  textarea: { height: 110, textAlignVertical: "top" },
  // Kategorie chips — poziomy wrap
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: "#000",
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fafafa",
  },
  chipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  chipText: {
    fontSize: 13,
    color: "#111",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  chipTextActive: {
    color: "#fc6c14",
  },
  button: {
    width: "100%",
    backgroundColor: "#111",
    paddingTop: 12,
    paddingBottom: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: "#fc6c14",
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
});
