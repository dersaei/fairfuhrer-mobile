import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import Purchases, { PRODUCT_CATEGORY } from "react-native-purchases";
import { RevenueCatUI, PAYWALL_RESULT } from "react-native-purchases-ui";

type AuthView = "login" | "register";
type AccountSection =
  | "profil"
  | "einstellungen"
  | "premium"
  | "ort-vorschlagen";

// ─── Auth Screen ────────────────────────────────────────────────────────────

function AuthScreen() {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  const reset = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setRegisterSuccess(false);
  };

  const switchView = (v: AuthView) => {
    reset();
    setView(v);
  };

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);
    if (error) setError("E-Mail oder Passwort ist falsch.");
  };

  const handleRegister = async () => {
    setError(null);
    if (!email || !username || !password || !confirmPassword) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    if (username.length < 3) {
      setError("Benutzername muss mindestens 3 Zeichen lang sein.");
      return;
    }
    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "consumer", username },
        emailRedirectTo: process.env.EXPO_PUBLIC_SITE_URL,
      },
    });
    setIsLoading(false);
    if (error) {
      setError(
        error.message.includes("already registered")
          ? "Diese E-Mail-Adresse ist bereits registriert."
          : "Registrierung fehlgeschlagen. Bitte erneut versuchen.",
      );
    } else {
      setRegisterSuccess(true);
    }
  };

  if (registerSuccess) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centerContent}>
          <Text style={s.logo}>FAIRFÜHRER</Text>
          <Text style={s.roleLabel}>Reisender</Text>
          <Text style={s.successTitle}>Fast fertig!</Text>
          <Text style={s.successText}>
            Bitte prüfe deine E-Mails und bestätige deine Registrierung.
          </Text>
          <TouchableOpacity onPress={() => switchView("login")}>
            <Text style={s.link}>Zurück zum Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.centerContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.logo}>FAIRFÜHRER</Text>
          <Text style={s.roleLabel}>Reisender</Text>

          <View style={s.tabRow}>
            <TouchableOpacity
              style={s.tabBtn}
              onPress={() => switchView("login")}
            >
              <Text
                style={[s.tabBtnText, view === "login" && s.tabBtnTextActive]}
              >
                Anmelden
              </Text>
              {view === "login" && <View style={s.tabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.tabBtn}
              onPress={() => switchView("register")}
            >
              <Text
                style={[
                  s.tabBtnText,
                  view === "register" && s.tabBtnTextActive,
                ]}
              >
                Registrieren
              </Text>
              {view === "register" && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          </View>

          {error && <Text style={s.errorText}>{error}</Text>}

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>E-Mail</Text>
            <TextInput
              style={s.input}
              placeholder="deine@email.de"
              placeholderTextColor="rgba(252,108,20,0.4)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          {view === "register" && (
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Benutzername</Text>
              <TextInput
                style={s.input}
                placeholder="min. 3 Zeichen"
                placeholderTextColor="rgba(252,108,20,0.4)"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoComplete="username-new"
              />
            </View>
          )}

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Passwort</Text>
            <TextInput
              style={s.input}
              placeholder="min. 8 Zeichen"
              placeholderTextColor="rgba(252,108,20,0.4)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={view === "login" ? "password" : "new-password"}
            />
          </View>

          {view === "register" && (
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Passwort wiederholen</Text>
              <TextInput
                style={s.input}
                placeholder="Passwort bestätigen"
                placeholderTextColor="rgba(252,108,20,0.4)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </View>
          )}

          <TouchableOpacity
            style={[s.button, isLoading && s.buttonDisabled]}
            onPress={view === "login" ? handleLogin : handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fc6c14" />
            ) : (
              <Text style={s.buttonText}>
                {view === "login" ? "Anmelden" : "Konto erstellen"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Account Screen ──────────────────────────────────────────────────────────

function AccountScreen() {
  const { user, profile, isPro, signOut, refreshProfile, refreshPro } = useAuth();
  const [activeSection, setActiveSection] = useState<AccountSection>("profil");

  const displayName = profile?.username ?? user?.email ?? "";

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.accountHeader}>
        <View style={s.avatarPlaceholder}>
          <Text style={s.avatarInitial}>
            {displayName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={s.accountHeaderInfo}>
          <Text style={s.accountName}>{profile?.username ?? "—"}</Text>
          <Text style={s.accountEmail}>{user?.email}</Text>
          <View style={s.planBadge}>
            <Text style={s.planBadgeText}>
              {isPro ? "★ Fairführer+" : "Kostenlos"}
            </Text>
          </View>
        </View>
      </View>

      {/* Nav */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.navScroll}
        contentContainerStyle={s.navContent}
      >
        {(
          [
            "profil",
            "einstellungen",
            "premium",
            "ort-vorschlagen",
          ] as AccountSection[]
        ).map((sec) => (
          <TouchableOpacity
            key={sec}
            style={[s.navItem, activeSection === sec && s.navItemActive]}
            onPress={() => setActiveSection(sec)}
          >
            <Text
              style={[
                s.navItemText,
                activeSection === sec && s.navItemTextActive,
              ]}
            >
              {sec === "profil"
                ? "Profil"
                : sec === "einstellungen"
                  ? "Einstellungen"
                  : sec === "premium"
                    ? "Premium"
                    : "Ort vorschlagen"}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.sectionContent}
        keyboardShouldPersistTaps="handled"
      >
        {activeSection === "profil" && (
          <ProfilSection user={user} profile={profile} />
        )}
        {activeSection === "einstellungen" && (
          <EinstellungenSection
            user={user}
            profile={profile}
            signOut={signOut}
            refreshProfile={refreshProfile}
          />
        )}
        {activeSection === "premium" && (
          <PremiumSection isPro={isPro} refreshPro={refreshPro} />
        )}
        {activeSection === "ort-vorschlagen" && (
          <OrtVorschlagenSection user={user} isPremium={isPro} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Profil Section ──────────────────────────────────────────────────────────

function ProfilSection({ user, profile }: any) {
  const fields = [
    { label: "Benutzername", value: profile?.username ?? "—" },
    { label: "E-Mail-Adresse", value: user?.email ?? "—" },
    { label: "Vorname", value: profile?.first_name ?? "—" },
    { label: "Nachname", value: profile?.last_name ?? "—" },
  ];

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Profilbild</Text>
      <Text style={s.sectionHint}>
        Profilbild-Upload wird demnächst verfügbar sein.
      </Text>

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

// ─── Einstellungen Section ───────────────────────────────────────────────────

function EinstellungenSection({ user, profile, signOut, refreshProfile }: any) {
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
            const { error } = await supabase.rpc("delete_user");
            if (error) {
              Alert.alert("Fehler", "Konto konnte nicht gelöscht werden.");
            } else {
              await supabase.auth.signOut();
            }
          },
        },
      ],
    );
  };

  return (
    <View style={s.section}>
      {/* Persönliche Daten */}
      <Text style={s.sectionTitle}>Persönliche Daten</Text>
      {nameError && <Text style={s.errorText}>{nameError}</Text>}
      {nameSuccess && (
        <Text style={s.successMsg}>Daten erfolgreich aktualisiert.</Text>
      )}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Benutzername</Text>
        <TextInput
          style={s.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoComplete="username"
        />
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Vorname</Text>
        <TextInput
          style={s.input}
          value={firstName}
          onChangeText={setFirstName}
          autoComplete="given-name"
        />
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Nachname</Text>
        <TextInput
          style={s.input}
          value={lastName}
          onChangeText={setLastName}
          autoComplete="family-name"
        />
      </View>
      <TouchableOpacity
        style={[s.button, nameLoading && s.buttonDisabled]}
        onPress={handleNameUpdate}
        disabled={nameLoading}
      >
        {nameLoading ? (
          <ActivityIndicator color="#fc6c14" />
        ) : (
          <Text style={s.buttonText}>Aktualisieren</Text>
        )}
      </TouchableOpacity>

      <View style={s.divider} />

      {/* E-Mail */}
      <Text style={s.sectionTitle}>E-Mail-Adresse ändern</Text>
      <Text style={s.sectionHint}>Aktuelle Adresse: {user?.email}</Text>
      {emailError && <Text style={s.errorText}>{emailError}</Text>}
      {emailSuccess && (
        <Text style={s.successMsg}>
          Bestätigungslink wurde an Ihre neue Adresse gesendet.
        </Text>
      )}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Neue E-Mail-Adresse</Text>
        <TextInput
          style={s.input}
          value={newEmail}
          onChangeText={setNewEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </View>
      <TouchableOpacity
        style={[s.button, emailLoading && s.buttonDisabled]}
        onPress={handleEmailChange}
        disabled={emailLoading}
      >
        {emailLoading ? (
          <ActivityIndicator color="#fc6c14" />
        ) : (
          <Text style={s.buttonText}>Ändern</Text>
        )}
      </TouchableOpacity>

      <View style={s.divider} />

      {/* Passwort */}
      <Text style={s.sectionTitle}>Passwort ändern</Text>
      {pwError && <Text style={s.errorText}>{pwError}</Text>}
      {pwSuccess && (
        <Text style={s.successMsg}>Passwort erfolgreich geändert.</Text>
      )}
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Neues Passwort</Text>
        <TextInput
          style={s.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
        />
      </View>
      <View style={s.fieldGroup}>
        <Text style={s.fieldLabel}>Passwort bestätigen</Text>
        <TextInput
          style={s.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />
      </View>
      <TouchableOpacity
        style={[s.button, pwLoading && s.buttonDisabled]}
        onPress={handlePasswordChange}
        disabled={pwLoading}
      >
        {pwLoading ? (
          <ActivityIndicator color="#fc6c14" />
        ) : (
          <Text style={s.buttonText}>Passwort aktualisieren</Text>
        )}
      </TouchableOpacity>

      <View style={s.divider} />

      {/* Abmelden */}
      <TouchableOpacity style={s.buttonOutline} onPress={signOut}>
        <Text style={s.buttonOutlineText}>Abmelden</Text>
      </TouchableOpacity>

      <View style={s.divider} />

      {/* Konto löschen */}
      <Text style={s.sectionTitleDanger}>Konto löschen</Text>
      <Text style={s.sectionHint}>
        Diese Aktion ist unwiderruflich. Alle Ihre Daten werden dauerhaft
        gelöscht.
      </Text>
      <TouchableOpacity style={s.buttonDanger} onPress={handleDeleteAccount}>
        <Text style={s.buttonDangerText}>Konto unwiderruflich löschen</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Premium Section ─────────────────────────────────────────────────────────

function PremiumSection({ isPro, refreshPro }: { isPro: boolean; refreshPro: () => Promise<void> }) {
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const features = [
    "100 % der Pins in der Kategorie „Sehenswertes"",
    "Offline-Karten für unterwegs",
    "Funktion „Alle abspielen"",
    "Favoriten speichern",
    "Neue Orte vorschlagen",
  ];

  const plans = [
    { id: "monthly", label: "Kleine Unterstützung", price: "€4,99 / Monat" },
    { id: "yearly", label: "Faire Unterstützung", price: "€9,99 / Monat", popular: true },
    { id: "lifetime", label: "Große Unterstützung", price: "€19,99 einmalig" },
  ];

  const handlePurchase = async (productId: string) => {
    setPurchasing(true);
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: "Fairführer Pro",
      });
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await refreshPro();
      }
    } catch (e) {
      Alert.alert("Fehler", "Kauf konnte nicht abgeschlossen werden.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await Purchases.restorePurchases();
      await refreshPro();
      Alert.alert("Erfolg", "Käufe wurden wiederhergestellt.");
    } catch (e) {
      Alert.alert("Fehler", "Wiederherstellung fehlgeschlagen.");
    } finally {
      setRestoring(false);
    }
  };

  const handleCustomerCenter = async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (e) {
      Alert.alert("Fehler", "Kundencenter konnte nicht geöffnet werden.");
    }
  };

  if (isPro) {
    return (
      <View style={s.section}>
        <View style={s.proActiveBox}>
          <Text style={s.proActiveIcon}>★</Text>
          <Text style={s.proActiveTitle}>Fairführer+ aktiv</Text>
          <Text style={s.sectionHint}>
            Du hast Zugang zu allen Premium-Funktionen. Vielen Dank für deine Unterstützung!
          </Text>
        </View>

        <TouchableOpacity style={s.buttonOutline} onPress={handleCustomerCenter}>
          <Text style={s.buttonOutlineText}>Abonnement verwalten</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Fairführer+</Text>
      <Text style={s.sectionHint}>
        Schalte alle Funktionen frei und unterstütze ein unabhängiges Projekt.
      </Text>

      <View style={s.featureList}>
        {features.map((f) => (
          <View key={f} style={s.featureRow}>
            <Text style={s.featureDot}>●</Text>
            <Text style={s.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <View style={s.plansContainer}>
        {plans.map((plan) => (
          <TouchableOpacity
            key={plan.id}
            style={[s.planButton, plan.popular && s.planButtonPopular]}
            onPress={() => handlePurchase(plan.id)}
            disabled={purchasing}
          >
            <View style={s.planButtonInner}>
              <View>
                <Text style={[s.planLabel, plan.popular && s.planLabelPopular]}>
                  {plan.label}
                </Text>
                <Text style={[s.planPrice, plan.popular && s.planPricePopular]}>
                  {plan.price}
                </Text>
              </View>
              {plan.popular && (
                <View style={s.popularBadge}>
                  <Text style={s.popularBadgeText}>Beliebt</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[s.buttonOutline, restoring && s.buttonDisabled]}
        onPress={handleRestore}
        disabled={restoring}
      >
        {restoring
          ? <ActivityIndicator color="#111" />
          : <Text style={s.buttonOutlineText}>Käufe wiederherstellen</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

// ─── Ort vorschlagen Section ─────────────────────────────────────────────────

function OrtVorschlagenSection({ user, isPremium }: any) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim() || !address.trim() || !description.trim()) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.from("ort_vorschlaege").insert({
      name: name.trim(),
      address: address.trim(),
      description: description.trim(),
      submitted_by: user?.email ?? null,
      submitted_by_first_name: user?.profile?.first_name ?? null,
      submitted_by_last_name: user?.profile?.last_name ?? null,
    });
    setIsLoading(false);
    if (error) {
      setError("Ein Fehler ist aufgetreten. Bitte erneut versuchen.");
    } else {
      setSuccess(true);
      setName("");
      setAddress("");
      setDescription("");
    }
  };

  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Ort vorschlagen</Text>
      <Text style={s.sectionHint}>
        Kennen Sie einen fairen Ort, der auf unsere Karte gehört? Füllen Sie das
        Formular aus!
      </Text>

      {!isPremium && (
        <View style={s.premiumInfo}>
          <Text style={s.premiumInfoText}>
            Das Einreichen von Ortsvorschlägen ist ausschließlich für
            Premium-Mitglieder verfügbar.
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
            <Text style={s.fieldLabel}>
              Warum sollte dieser Ort auf der Karte stehen?
            </Text>
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

// ─── Root ────────────────────────────────────────────────────────────────────

export default function ProfilScreen() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centerContent}>
          <ActivityIndicator color="#fc6c14" />
        </View>
      </SafeAreaView>
    );
  }

  return user ? <AccountScreen /> : <AuthScreen />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Auth
  centerContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 16,
  },
  logo: {
    fontFamily: "Anton_400Regular",
    fontSize: 36,
    color: "#fc6c14",
    letterSpacing: 4,
  },
  roleLabel: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
    letterSpacing: 1,
    marginTop: -10,
    marginBottom: 4,
  },
  tabRow: {
    flexDirection: "row",
    width: "100%",
    borderBottomWidth: 1.5,
    borderBottomColor: "#f0e8e0",
    marginBottom: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabBtnText: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#ccc",
  },
  tabBtnTextActive: { color: "#111" },
  tabUnderline: {
    position: "absolute",
    bottom: -1.5,
    left: "15%",
    right: "15%",
    height: 2.5,
    backgroundColor: "#fc6c14",
    borderRadius: 2,
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
    borderColor: "#fc6c14",
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
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    color: "#fc6c14",
    fontSize: 16,
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
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDangerText: {
    color: "#c0392b",
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  link: {
    color: "#fc6c14",
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
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
  successTitle: { fontSize: 26, fontFamily: "Anton_400Regular", color: "#111" },
  successText: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "FiraSansCondensed_400Regular",
  },

  // Account header
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e0",
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 28,
    color: "#fc6c14",
    fontFamily: "Anton_400Regular",
    lineHeight: 28,
  },
  accountHeaderInfo: { flex: 1, gap: 2 },
  accountName: {
    fontSize: 18,
    fontFamily: "Anton_400Regular",
    color: "#111",
    letterSpacing: 1,
  },
  accountEmail: {
    fontSize: 13,
    color: "#999",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  planBadge: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#fc6c14",
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
  planBadgeText: {
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_700Bold",
    fontSize: 12,
  },

  // Nav
  navScroll: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8e0",
    flexGrow: 0,
  },
  navContent: {
    paddingHorizontal: 16,
    gap: 4,
    flexDirection: "row",
    paddingVertical: 4,
  },
  navItem: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  navItemActive: { backgroundColor: "#fff5ef" },
  navItemText: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#999",
  },
  navItemTextActive: { color: "#fc6c14" },

  // Sections
  sectionContent: { paddingHorizontal: 20, paddingVertical: 24, gap: 16 },
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
    color: "#999",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 18,
  },
  divider: { height: 1, backgroundColor: "#f0e8e0", marginVertical: 8 },
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

  // Premium
  featureList: { gap: 8, marginTop: 4 },
  featureRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  featureDot: { color: "#fc6c14", fontSize: 15, marginTop: 3 },
  featureText: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#333",
    flex: 1,
  },
  proActiveBox: {
    backgroundColor: "#fff5ef",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  proActiveIcon: {
    fontSize: 32,
    color: "#fc6c14",
  },
  proActiveTitle: {
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
    letterSpacing: 0.3,
  },
  plansContainer: { gap: 10, marginTop: 4 },
  planButton: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#fff",
  },
  planButtonPopular: {
    borderColor: "#fc6c14",
    backgroundColor: "#fff5ef",
  },
  planButtonInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planLabel: {
    fontSize: 16,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#111",
  },
  planLabelPopular: { color: "#fc6c14" },
  planPrice: {
    fontSize: 14,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#666",
    marginTop: 2,
  },
  planPricePopular: { color: "#fc6c14" },
  popularBadge: {
    backgroundColor: "#fc6c14",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  popularBadgeText: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  pricingBox: {
    backgroundColor: "#fff5ef",
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  pricingTitle: {
    fontSize: 18,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#111",
  },
  comingSoon: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fc6c14",
    letterSpacing: 1,
  },

  // Ort vorschlagen
  premiumInfo: { backgroundColor: "#fff5ef", borderRadius: 12, padding: 14 },
  premiumInfoText: {
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#fc6c14",
    lineHeight: 18,
  },
  successBox: { backgroundColor: "#f0faf5", borderRadius: 12, padding: 16 },
});
