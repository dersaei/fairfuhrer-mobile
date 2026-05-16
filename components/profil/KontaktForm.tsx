import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useAuth } from "@/context/AuthContext";

const WEB_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "";

export default function KontaktForm() {
  const { user, profile } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  const displayEmail = user?.email ?? "";
  const displayName = profile?.username ?? "";

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setErrorMsg("Bitte fülle alle Felder aus.");
      return;
    }
    setErrorMsg(undefined);
    setStatus("submitting");

    try {
      const res = await fetch(`${WEB_URL}/api/account-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          user_id: user?.id ?? null,
          email: displayEmail,
          name: displayName || null,
          username: displayName || null,
          account_type: "reisender",
        }),
      });

      if (res.ok) {
        setStatus("success");
        setSubject("");
        setMessage("");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Ein Fehler ist aufgetreten.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <View style={s.section}>
        <View style={s.successBox}>
          <Text style={s.successText}>
            Vielen Dank für Ihre Nachricht! Wir melden uns so schnell wie möglich bei Ihnen.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.section}>
      <Text style={s.title}>Kontakt aufnehmen</Text>
      <Text style={s.lead}>
        Sie haben eine Frage oder ein Anliegen? Schreiben Sie uns direkt — wir antworten in der
        Regel innerhalb von 1–2 Werktagen.
      </Text>

      {status === "error" && errorMsg && <Text style={s.errorMsg}>{errorMsg}</Text>}

      <View style={s.infoRow}>
        <Text style={s.infoLabel}>Absender</Text>
        <Text style={s.infoValue} numberOfLines={1}>
          {displayName ? `${displayName} (${displayEmail})` : displayEmail}
        </Text>
      </View>

      <View style={s.field}>
        <Text style={s.label}>Betreff</Text>
        <TextInput
          style={s.input}
          value={subject}
          onChangeText={setSubject}
          editable={status !== "submitting"}
          autoComplete="off"
          autoCorrect={false}
          returnKeyType="next"
        />
      </View>

      <View style={s.field}>
        <Text style={s.label}>Nachricht</Text>
        <TextInput
          style={s.textarea}
          value={message}
          onChangeText={setMessage}
          editable={status !== "submitting"}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[s.button, status === "submitting" && s.buttonDisabled]}
        onPress={handleSubmit}
        disabled={status === "submitting"}
        activeOpacity={0.85}
      >
        {status === "submitting" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.buttonText}>Nachricht senden</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    borderTopWidth: 2,
    borderTopColor: "#000",
    paddingTop: 20,
    gap: 12,
  },
  title: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#18222f",
  },
  lead: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  infoLabel: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 13,
    color: "#18222f",
  },
  infoValue: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 13,
    color: "#555",
    flex: 1,
  },
  field: { gap: 4 },
  label: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#18222f",
  },
  input: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#18222f",
    backgroundColor: "#fafafa",
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 15,
    color: "#18222f",
    backgroundColor: "#fafafa",
    minHeight: 120,
  },
  button: {
    backgroundColor: "#fc6c14",
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignSelf: "flex-start",
    alignItems: "center",
    minWidth: 160,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonText: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 14,
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  errorMsg: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 14,
    color: "#c0392b",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#f5c6cb",
    backgroundColor: "#fdf0ef",
  },
  successBox: {
    borderWidth: 1.5,
    borderColor: "#b7e4cc",
    backgroundColor: "#f0faf4",
    padding: 20,
  },
  successText: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 14,
    color: "#18222f",
    lineHeight: 20,
    textAlign: "center",
  },
});
