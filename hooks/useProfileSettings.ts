import { useState } from "react";
import { Alert } from "react-native";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/context/AuthContext";

export function useProfileSettings(
  user: User | null,
  _profile: Profile | null,
  _refreshProfile: () => Promise<void>,
  deleteAccount: () => Promise<void>,
) {
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const handleEmailChange = async () => {
    setEmailError(null);
    setEmailSuccess(false);
    if (!newEmail.trim()) {
      setEmailError("Bitte neue E-Mail-Adresse eingeben.");
      return;
    }
    if (!user) return;
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
