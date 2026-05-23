import { useState } from "react";
import { Alert } from "react-native";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/context/AuthContext";

export function useProfileSettings(
  user: User | null,
  profile: Profile | null,
  refreshProfile: () => Promise<void>,
  deleteAccount: () => Promise<void>,
) {
  const [username, setUsername] = useState(profile?.username ?? "");
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const handleNameUpdate = async () => {
    if (!user) return;
    setNameError(null);
    setNameSuccess(false);
    setNameLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: username.trim() || null,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
      })
      .eq("id", user.id);
    setNameLoading(false);
    if (error) {
      setNameError("Fehler beim Speichern. Bitte erneut versuchen.");
    } else {
      setNameSuccess(true);
      refreshProfile();
    }
  };

  const handleEmailChange = async () => {
    setEmailError(null);
    setEmailSuccess(false);
    if (!newEmail.trim()) {
      setEmailError("Bitte neue E-Mail-Adresse eingeben.");
      return;
    }
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      // Bestätigungslink öffnet sich im Browser auf der Website.
      { emailRedirectTo: process.env.EXPO_PUBLIC_SITE_URL },
    );
    setEmailLoading(false);
    if (error) {
      setEmailError("E-Mail-Adresse konnte nicht geändert werden.");
    } else {
      setEmailSuccess(true);
      setNewEmail("");
    }
  };

  const handlePasswordChange = async () => {
    setPwError(null);
    setPwSuccess(false);
    if (newPassword.length < 8) {
      setPwError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwörter stimmen nicht überein.");
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) {
      setPwError("Passwort konnte nicht geändert werden.");
    } else {
      setPwSuccess(true);
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Konto löschen",
      "Diese Aktion ist unwiderruflich. Alle Ihre Daten werden dauerhaft gelöscht. Fortfahren?",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Konto löschen",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } catch {
              Alert.alert("Fehler", "Konto konnte nicht gelöscht werden.");
            }
          },
        },
      ],
    );
  };

  return {
    nameForm: {
      username,
      setUsername,
      firstName,
      setFirstName,
      lastName,
      setLastName,
      nameLoading,
      nameSuccess,
      nameError,
      handleNameUpdate,
    },
    emailForm: {
      newEmail,
      setNewEmail,
      emailLoading,
      emailSuccess,
      emailError,
      handleEmailChange,
    },
    passwordForm: {
      newPassword,
      setNewPassword,
      confirmPassword,
      setConfirmPassword,
      pwLoading,
      pwSuccess,
      pwError,
      handlePasswordChange,
    },
    handleDeleteAccount,
  };
}
