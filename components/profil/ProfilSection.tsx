import { useState } from "react";
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function ProfilSection({ user, profile }: any) {
  const { refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const avatarUrl = profile?.avatar_url ?? null;

  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setUploadError("Kein Zugriff auf die Fotobibliothek.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploadError(null);
    setUploading(true);

    try {
      const ext = asset.uri.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, arrayBuffer, {
          upsert: true,
          contentType: asset.mimeType ?? `image/${ext}`,
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

  const fields = [
    { label: "Benutzername", value: profile?.username ?? "—" },
    { label: "E-Mail-Adresse", value: user?.email ?? "—" },
    { label: "Vorname", value: profile?.first_name ?? "—" },
    { label: "Nachname", value: profile?.last_name ?? "—" },
  ];

  return (
    <View style={s.section}>
      {/* Profilbild */}
      <Text style={s.sectionTitle}>Profilbild</Text>
      <Text style={s.sectionHint}>
        Lade ein Bild hoch (JPG, PNG — max. 2 MB). Es erscheint in deinem Profil-Header.
      </Text>

      <View style={s.avatarRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={s.avatarPreview} />
        ) : (
          <View style={s.avatarPlaceholderLarge}>
            <Text style={s.avatarInitialLarge}>
              {(profile?.username ?? user?.email ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={s.avatarButtons}>
          <TouchableOpacity
            style={[s.uploadBtn, uploading && s.btnDisabled]}
            onPress={handlePickImage}
            disabled={uploading}
            activeOpacity={0.85}
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
              activeOpacity={0.85}
            >
              <Text style={s.deleteBtnText}>Entfernen</Text>
            </TouchableOpacity>
          )}
        </View>
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
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#eee",
  },
  avatarPlaceholderLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialLarge: {
    fontSize: 32,
    color: "#fc6c14",
    fontFamily: "Anton_400Regular",
    lineHeight: 32,
  },
  avatarButtons: { flex: 1, gap: 8 },
  uploadBtn: {
    backgroundColor: "#fc6c14",
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  uploadBtnText: {
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 14,
    color: "#fff",
    letterSpacing: 0.3,
  },
  deleteBtn: {
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  deleteBtnText: {
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontSize: 14,
    color: "#111",
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
});
