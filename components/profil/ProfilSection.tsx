import { View, Text, StyleSheet } from "react-native";

export default function ProfilSection({ user, profile }: any) {
  const fields = [
    { label: "Benutzername", value: profile?.username ?? "—" },
    { label: "E-Mail-Adresse", value: user?.email ?? "—" },
    { label: "Vorname", value: profile?.first_name ?? "—" },
    { label: "Nachname", value: profile?.last_name ?? "—" },
  ];

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Profilbild</Text>
      <Text style={s.sectionHint}>Profilbild-Upload wird demnächst verfügbar sein.</Text>

      <Text style={[s.sectionTitle, { marginTop: 24 }]}>Persönliche Daten</Text>
      {fields.map((f) => (
        <View key={f.label} style={s.infoRow}>
          <Text style={s.infoLabel}>{f.label}</Text>
          <Text style={s.infoValue}>{f.value}</Text>
        </View>
      ))}
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
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f9f0eb",
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#999",
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#111",
  },
});
