import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { User } from "@supabase/supabase-js";
import { Profile } from "@/context/AuthContext";
import { useSubmitPlaceProposal } from "@/hooks/useSubmitPlaceProposal";

interface Props {
  user: User | null;
  profile: Profile | null;
  isPremium: boolean;
}

export default function OrtVorschlagenSection({ user, profile, isPremium }: Props) {
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
  } = useSubmitPlaceProposal(user, profile);

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Ort vorschlagen</Text>
      <Text style={s.sectionHint}>
        Kennen Sie einen fairen Ort, der auf unsere Karte gehört? Füllen Sie das Formular aus!
      </Text>

      {!isPremium && (
        <View style={s.premiumInfo}>
          <Text style={s.premiumInfoText}>
            Das Einreichen von Ortsvorschlägen ist ausschließlich für Premium-Mitglieder verfügbar.
          </Text>
        </View>
      )}

      {success ? (
        <View style={s.successBox}>
          <Text style={s.successMsg}>
            Vielen Dank für Ihren Vorschlag! Wir prüfen ihn und melden uns.
          </Text>
        </View>
      ) : (
        <>
          {error && <Text style={s.errorText}>{error}</Text>}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Name des Ortes</Text>
            <TextInput
              style={[s.input, !isPremium && s.inputDisabled]}
              value={name}
              onChangeText={setName}
              editable={isPremium}
            />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Adresse</Text>
            <TextInput
              style={[s.input, !isPremium && s.inputDisabled]}
              value={address}
              onChangeText={setAddress}
              editable={isPremium}
            />
          </View>
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Warum sollte dieser Ort auf der Karte stehen?</Text>
            <TextInput
              style={[s.input, s.textarea, !isPremium && s.inputDisabled]}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              editable={isPremium}
            />
          </View>
          <TouchableOpacity
            style={[s.button, (!isPremium || isLoading) && s.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!isPremium || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fc6c14" />
            ) : (
              <Text style={s.buttonText}>Vorschlag einreichen</Text>
            )}
          </TouchableOpacity>
        </>
      )}
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
    color: "#999",
    fontFamily: "FiraSansCondensed_400Regular",
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
    color: "#fc6c14",
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
    backgroundColor: "#fff",
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
