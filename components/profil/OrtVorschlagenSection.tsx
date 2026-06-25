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
import { useSubmitPlaceProposal } from "@/hooks/useSubmitPlaceProposal";
import { getOrtVorschlagenContent, type OrtVorschlagenContent } from "@/lib/directus";

// Fallback-Texte, falls Directus nichts liefert
const DEFAULTS = {
  intro: "Kennen Sie einen fairen Ort, der auf unsere Karte gehört? Füllen Sie das Formular aus!",
  premium_info:
    "Das Einreichen von Ortsvorschlägen ist ausschließlich für Premium-Mitglieder verfügbar.",
  label_name: "Name des Ortes",
  label_adresse: "Adresse",
  label_beschreibung: "Warum sollte dieser Ort auf der Karte stehen?",
  button_text: "Vorschlag einreichen",
  hint_intro: "Ihr Vorschlag wird zusammen mit Ihrer E-Mail-Adresse übermittelt.",
  hint_with_name:
    "Vor- und Nachname werden ebenfalls gesendet, da sie in Ihrem Profil hinterlegt sind.",
  hint_without_name:
    "Vor- und Nachname werden nicht gesendet, da sie in Ihrem Profil nicht hinterlegt sind.",
  success_message: "Vielen Dank für Ihren Vorschlag! Wir prüfen ihn und melden uns.",
};

interface Props {
  user: User | null;
  isPremium: boolean;
}

export default function OrtVorschlagenSection({ user, isPremium }: Props) {
  const {
    name,
    setName,
    address,
    setAddress,
    description,
    setDescription,
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
    premium_info: content?.premium_info || DEFAULTS.premium_info,
    label_name: content?.label_name || DEFAULTS.label_name,
    label_adresse: content?.label_adresse || DEFAULTS.label_adresse,
    label_beschreibung: content?.label_beschreibung || DEFAULTS.label_beschreibung,
    button_text: content?.button_text || DEFAULTS.button_text,
    hint_intro: content?.hint_intro || DEFAULTS.hint_intro,
    hint_with_name: content?.hint_with_name || DEFAULTS.hint_with_name,
    hint_without_name: content?.hint_without_name || DEFAULTS.hint_without_name,
    success_message: content?.success_message || DEFAULTS.success_message,
  };

  return (
    <View style={s.section}>
      <Text style={s.sectionHint}>{t.intro}</Text>

      {!isPremium && (
        <View style={s.premiumInfo}>
          <Text style={s.premiumInfoText}>{t.premium_info}</Text>
        </View>
      )}

      {success ? (
        <View style={s.successBox}>
          <Text style={s.successMsg}>{t.success_message}</Text>
        </View>
      ) : (
        <>
          {error && <Text style={s.errorText}>{error}</Text>}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>{t.label_name}</Text>
            <TextInput
              style={[s.input, !isPremium && s.inputDisabled]}
              value={name}
              onChangeText={setName}
              editable={isPremium}
            />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>{t.label_adresse}</Text>
            <TextInput
              style={[s.input, !isPremium && s.inputDisabled]}
              value={address}
              onChangeText={setAddress}
              editable={isPremium}
            />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>{t.label_beschreibung}</Text>
            <TextInput
              style={[s.input, s.textarea, !isPremium && s.inputDisabled]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              editable={isPremium}
            />
          </View>
          {isPremium && <Text style={s.hint}>{t.hint_intro}</Text>}
          <TouchableOpacity
            style={[s.button, (!isPremium || isLoading) && s.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!isPremium || isLoading}
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
  premiumInfo: { backgroundColor: "#fff5ef", borderRadius: 12, padding: 14 },
  premiumInfoText: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#fc6c14",
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
  inputDisabled: {
    borderColor: "#ddd",
    color: "#bbb",
    backgroundColor: "#fafafa",
  },
  textarea: { height: 110, textAlignVertical: "top" },
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
