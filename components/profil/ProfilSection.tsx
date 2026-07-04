// Hinweis (2026-07-04): Community-Feature auf Eis gelegt (Entscheidung Frank —
// Aufwand/Kosten Rechtsberatung). Diese Datei wurde auf den Stand vor dem
// Feature zurückgesetzt. Der fertige Community-Block (Bio + Sichtbarkeit) liegt
// als Referenz im Web-Projekt: components/auth/CommunityProfilSection.tsx.
// DB-Felder profiles.bio / profiles.is_public bleiben in Supabase erhalten.
// Zum Reaktivieren: Block von dort nach React Native portieren + Props
// profile/refreshProfile aus (tabs)/profil.tsx werden bereits übergeben.

import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";

export default function ProfilSection({ user, signOut }: any) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Kontodaten</Text>
      <View style={s.infoRow}>
        <Text style={s.infoLabel}>E-Mail-Adresse</Text>
        <Text style={s.infoValue}>{user?.email ?? "—"}</Text>
      </View>

      <View style={s.divider} />
      <TouchableOpacity
        style={[s.signOutBtn, signingOut && s.btnDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
        activeOpacity={0.7}
      >
        {signingOut ? (
          <ActivityIndicator color="#111" size="small" />
        ) : (
          <Text style={s.signOutBtnText}>Abmelden</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#18222f",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  btnDisabled: { opacity: 0.5 },
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
    flexShrink: 1,
    textAlign: "right",
  },
  divider: { height: 1, backgroundColor: "#f0e8e0", marginVertical: 4 },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: "#fafafa",
  },
  signOutBtnText: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 15,
    color: "#111",
  },
});
