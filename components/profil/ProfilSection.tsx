import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function ProfilSection({ user, profile, signOut }: any) {
  const { refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const avatarUrl = profile?.avatar_url ?? null;

  const handlePickImage = async () => {
    // Request full library access (not limited)
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync(true);
    if (!perm.granted) {
      setUploadError("Kein Zugriff auf die Fotobibliothek.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      // base64 for reliable upload in React Native
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setUploadError("Bild konnte nicht geladen werden.");
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;

      // Decode base64 to Uint8Array for upload
      const byteCharacters = atob(asset.base64);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }

      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, byteArray, {
        upsert: true,
        contentType: mimeType,
      });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: `${data.publicUrl}?t=${Date.now()}` })
        .eq("id", user.id);

      if (updateErr) throw updateErr;

      await refreshProfile();
    } catch (err) {
      console.error(err);
      setUploadError("Beim Hochladen ist ein Fehler aufgetreten.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user) return;
    setUploadError(null);
    setUploading(true);
    try {
      const { data: files } = await supabase.storage.from("avatars").list(user.id);
      if (files && files.length > 0) {
        const paths = files.map((f: { name: string }) => `${user.id}/${f.name}`);
        await supabase.storage.from("avatars").remove(paths);
      }
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      await refreshProfile();
    } catch (err) {
      console.error(err);
      setUploadError("Beim Löschen ist ein Fehler aufgetreten.");
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const fields = [
    { label: "Benutzername", value: profile?.username ?? "—" },
    { label: "E-Mail-Adresse", value: user?.email ?? "—" },
    { label: "Vorname", value: profile?.first_name ?? "—" },
    { label: "Nachname", value: profile?.last_name ?? "—" },
  ];

  return (
    <View style={s.section}>
      {/* Profilbild — only buttons, no avatar preview (avatar is in header) */}
      <Text style={s.sectionTitle}>Profilbild</Text>
      <Text style={s.sectionHint}>
        Lade ein Bild hoch (JPG, PNG, WebP — max. 2 MB). Es erscheint im Profil-Header.
      </Text>

      <View style={s.avatarActions}>
        <TouchableOpacity
          style={[s.uploadBtn, uploading && s.btnDisabled]}
          onPress={handlePickImage}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.uploadBtnText}>{avatarUrl ? "Bild ändern" : "Bild hochladen"}</Text>
          )}
        </TouchableOpacity>
        {avatarUrl && (
          <TouchableOpacity
            style={[s.deleteBtn, uploading && s.btnDisabled]}
            onPress={handleDeleteAvatar}
            disabled={uploading}
            activeOpacity={0.8}
          >
            <Text style={s.deleteBtnText}>Entfernen</Text>
          </TouchableOpacity>
        )}
      </View>

      {uploadError && <Text style={s.errorMsg}>{uploadError}</Text>}

      {/* Persönliche Daten */}
      <Text style={[s.sectionTitle, { marginTop: 12 }]}>Persönliche Daten</Text>
      {fields.map((f) => (
        <View key={f.label} style={s.infoRow}>
          <Text style={s.infoLabel}>{f.label}</Text>
          <Text style={s.infoValue}>{f.value}</Text>
        </View>
      ))}

      {/* Abmelden */}
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
  sectionHint: {
    fontSize: 14,
    color: "#555",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 20,
  },
  avatarActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  uploadBtn: {
    backgroundColor: "#18222f",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
    minWidth: 140,
  },
  uploadBtnText: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  deleteBtn: {
    backgroundColor: "rgb(220,29,29)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#18222f",
    alignItems: "center",
  },
  deleteBtnText: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  btnDisabled: { opacity: 0.5 },
  errorMsg: {
    fontFamily: "FiraSansCondensed_400Regular",
    fontSize: 13,
    color: "#c0392b",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#f5c6cb",
    backgroundColor: "#fdf0ef",
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
