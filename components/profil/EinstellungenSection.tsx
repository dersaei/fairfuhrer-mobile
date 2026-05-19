import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useProfileSettings } from "@/hooks/useProfileSettings";

export default function EinstellungenSection({
  user,
  profile,
  signOut,
  deleteAccount,
  refreshProfile,
}: any) {
  const { nameForm, emailForm, passwordForm, handleDeleteAccount } = useProfileSettings(
    user,
    profile,
    refreshProfile,
    deleteAccount,
  );

  // Nutzer, die sich nur über Google angemeldet haben, besitzen noch kein
  // Passwort – für sie heißt die Aktion "festlegen", nicht "ändern".
  const providers: string[] = user?.app_metadata?.providers ?? [];
  const hasPassword = providers.includes("email");
  const passwordTitle = hasPassword ? "Passwort ändern" : "Passwort festlegen";

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>E-Mail-Adresse ändern</Text>
      <Text style={s.sectionHint}>Aktuelle Adresse: {user?.email}</Text>
      {emailForm.emailError && <Text style={s.errorText}>{emailForm.emailError}</Text>}
      {emailForm.emailSuccess && (
        <Text style={s.successMsg}>Bestätigungslink wurde an Ihre neue Adresse gesendet.</Text>
      )}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Neue E-Mail-Adresse</Text>
        <TextInput
          style={s.input}
          value={emailForm.newEmail}
          onChangeText={emailForm.setNewEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </View>
      <TouchableOpacity
        style={[s.button, emailForm.emailLoading && s.buttonDisabled]}
        onPress={emailForm.handleEmailChange}
        disabled={emailForm.emailLoading}
      >
        {emailForm.emailLoading ? (
          <ActivityIndicator color="#fc6c14" />
        ) : (
          <Text style={s.buttonText}>Ändern</Text>
        )}
      </TouchableOpacity>
      <View style={s.divider} />

      <Text style={s.sectionTitle}>Persönliche Daten</Text>
      {nameForm.nameError && <Text style={s.errorText}>{nameForm.nameError}</Text>}
      {nameForm.nameSuccess && <Text style={s.successMsg}>Daten erfolgreich aktualisiert.</Text>}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Benutzername</Text>
        <TextInput
          style={s.input}
          value={nameForm.username}
          onChangeText={nameForm.setUsername}
          autoCapitalize="none"
          autoComplete="username"
        />
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Vorname</Text>
        <TextInput
          style={s.input}
          value={nameForm.firstName}
          onChangeText={nameForm.setFirstName}
          autoComplete="given-name"
        />
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Nachname</Text>
        <TextInput
          style={s.input}
          value={nameForm.lastName}
          onChangeText={nameForm.setLastName}
          autoComplete="family-name"
        />
      </View>
      <TouchableOpacity
        style={[s.button, nameForm.nameLoading && s.buttonDisabled]}
        onPress={nameForm.handleNameUpdate}
        disabled={nameForm.nameLoading}
      >
        {nameForm.nameLoading ? (
          <ActivityIndicator color="#fc6c14" />
        ) : (
          <Text style={s.buttonText}>Aktualisieren</Text>
        )}
      </TouchableOpacity>
      <View style={s.divider} />

      <Text style={s.sectionTitle}>{passwordTitle}</Text>
      {!hasPassword && (
        <Text style={s.sectionHint}>
          Du hast dich mit Google angemeldet. Lege optional ein Passwort fest, um dich
          zusätzlich mit E-Mail und Passwort anmelden zu können.
        </Text>
      )}
      {passwordForm.pwError && <Text style={s.errorText}>{passwordForm.pwError}</Text>}
      {passwordForm.pwSuccess && (
        <Text style={s.successMsg}>
          {hasPassword ? "Passwort erfolgreich geändert." : "Passwort erfolgreich festgelegt."}
        </Text>
      )}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Neues Passwort</Text>
        <TextInput
          style={s.input}
          value={passwordForm.newPassword}
          onChangeText={passwordForm.setNewPassword}
          secureTextEntry
          autoComplete="new-password"
        />
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Passwort bestätigen</Text>
        <TextInput
          style={s.input}
          value={passwordForm.confirmPassword}
          onChangeText={passwordForm.setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />
      </View>
      <TouchableOpacity
        style={[s.button, passwordForm.pwLoading && s.buttonDisabled]}
        onPress={passwordForm.handlePasswordChange}
        disabled={passwordForm.pwLoading}
      >
        {passwordForm.pwLoading ? (
          <ActivityIndicator color="#fc6c14" />
        ) : (
          <Text style={s.buttonText}>{hasPassword ? "Passwort aktualisieren" : "Passwort festlegen"}</Text>
        )}
      </TouchableOpacity>

      <View style={s.divider} />

      <Text style={s.sectionTitleDanger}>Konto löschen</Text>
      <Text style={s.sectionHint}>
        Diese Aktion ist unwiderruflich. Alle Ihre Daten werden dauerhaft gelöscht.
      </Text>
      <TouchableOpacity style={s.buttonDanger} onPress={handleDeleteAccount}>
        <Text style={s.buttonDangerText}>Konto unwiderruflich löschen</Text>
      </TouchableOpacity>
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
  sectionTitleDanger: {
    fontSize: 16,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#c0392b",
  },
  sectionHint: {
    fontSize: 15,
    color: "#000",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 18,
  },
  divider: { height: 1, backgroundColor: "#f0e8e0", marginVertical: 8 },
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
  successMsg: {
    fontSize: 13,
    color: "#2D6A4F",
    backgroundColor: "#f0faf5",
    borderWidth: 1,
    borderColor: "#b7e4cc",
    padding: 10,
    borderRadius: 10,
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
  button: {
    width: "100%",
    backgroundColor: "#000",
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
  buttonOutline: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#111",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonOutlineText: {
    color: "#111",
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  buttonDanger: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "#c0392b",
    backgroundColor: "firebrick",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDangerText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
});
