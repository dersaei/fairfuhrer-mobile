import { useEffect, useState } from "react";
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
  ImageBackground,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { AuthWeakPasswordError } from "@supabase/supabase-js";
import MenuButton from "@/components/MenuButton";
import PlanCompareCard from "@/components/PlanCompareCard";
// Social loginy (Apple/Google) sind in Release 1.0.3 vorübergehend
// deaktiviert: Mapbox-Konflikte auf iOS, fehlender Browser-Redirect bei
// Apple-OAuth auf Android. Die Komponenten und Pakete bleiben im Repo,
// damit eine Wiederaktivierung in einem späteren Release einfach ist.
// import GoogleSignInButton from "@/components/GoogleSignInButton";
// import AppleSignInButton from "@/components/AppleSignInButton";
import { getAuthScreenContent, type AuthScreenContent } from "@/lib/directus";
import PasswordInput from "@/components/PasswordInput";

type AuthView = "welcome" | "login" | "register" | "forgot";

// Fallback-Texte, falls Directus nichts liefert
const DEFAULTS = {
  welcome_eyebrow: "DEIN FAIRFÜHRER-KONTO",
  welcome_headline: "ENTDECKE\nMEHR.\nBEWEGE\nMEHR.",
  welcome_subtitle:
    "Kostenlos registrieren – Audio-Guides hören, faire Orte entdecken und die Community mitgestalten.",
  welcome_btn_register: "Kostenlos registrieren",
  welcome_btn_login: "Ich habe schon ein Konto",
  welcome_btn_premium: "Jetzt FAIRFÜHRER+ holen",
  brand_title: "FAIRFÜHRER",
  headline_register: "Konto erstellen",
  headline_login: "Reisender",
  tab_login: "Anmelden",
  tab_register: "Registrieren",
  divider_text: "oder mit E-Mail",
  btn_register: "Konto erstellen",
  btn_login: "Anmelden",
  forgot_link: "Passwort vergessen?",
  google_hint:
    "Du hast dich mit Google registriert? Melde dich mit dem Google-Button an statt mit E-Mail und Passwort.",
  partner_info: "Werde unser Partner.",
  partner_link: "Hier erfahren Sie mehr.",
  forgot_headline: "Passwort vergessen",
  forgot_hint:
    "Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du ein neues Passwort festlegen kannst.",
  forgot_success:
    "Wenn ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen des Passworts gesendet. Bitte prüfe dein Postfach.",
  forgot_btn: "Link senden",
  back_to_login: "Zurück zum Login",
  reg_success_title: "Fast fertig!",
  reg_success_text: "Bitte prüfe deine E-Mails und bestätige deine Registrierung.",
  back_btn: "← Zurück",
};

interface AuthScreenProps {
  /**
   * Wenn true, startet der Screen direkt im Login-View statt im Welcome-View
   * mit den PlanCompareCards. Wird vom auth-modal genutzt — dort kommt der
   * Nutzer vom Paywall und braucht keinen zweiten Verkaufstext.
   */
  skipWelcome?: boolean;
}

export default function AuthScreen({ skipWelcome = false }: AuthScreenProps = {}) {
  const router = useRouter();
  const [view, setView] = useState<AuthView>(skipWelcome ? "login" : "welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [content, setContent] = useState<AuthScreenContent | null>(null);

  useEffect(() => {
    let active = true;
    getAuthScreenContent().then((c) => {
      if (active) setContent(c);
    });
    return () => {
      active = false;
    };
  }, []);

  const t = {
    welcome_eyebrow: content?.welcome_eyebrow || DEFAULTS.welcome_eyebrow,
    welcome_headline: content?.welcome_headline || DEFAULTS.welcome_headline,
    welcome_subtitle: content?.welcome_subtitle || DEFAULTS.welcome_subtitle,
    welcome_btn_register: content?.welcome_btn_register || DEFAULTS.welcome_btn_register,
    welcome_btn_login: content?.welcome_btn_login || DEFAULTS.welcome_btn_login,
    welcome_btn_premium: content?.welcome_btn_premium || DEFAULTS.welcome_btn_premium,
    brand_title: content?.brand_title || DEFAULTS.brand_title,
    headline_register: content?.headline_register || DEFAULTS.headline_register,
    headline_login: content?.headline_login || DEFAULTS.headline_login,
    tab_login: content?.tab_login || DEFAULTS.tab_login,
    tab_register: content?.tab_register || DEFAULTS.tab_register,
    divider_text: content?.divider_text || DEFAULTS.divider_text,
    btn_register: content?.btn_register || DEFAULTS.btn_register,
    btn_login: content?.btn_login || DEFAULTS.btn_login,
    forgot_link: content?.forgot_link || DEFAULTS.forgot_link,
    google_hint: content?.google_hint || DEFAULTS.google_hint,
    partner_info: content?.partner_info || DEFAULTS.partner_info,
    partner_link: content?.partner_link || DEFAULTS.partner_link,
    forgot_headline: content?.forgot_headline || DEFAULTS.forgot_headline,
    forgot_hint: content?.forgot_hint || DEFAULTS.forgot_hint,
    forgot_success: content?.forgot_success || DEFAULTS.forgot_success,
    forgot_btn: content?.forgot_btn || DEFAULTS.forgot_btn,
    back_to_login: content?.back_to_login || DEFAULTS.back_to_login,
    reg_success_title: content?.reg_success_title || DEFAULTS.reg_success_title,
    reg_success_text: content?.reg_success_text || DEFAULTS.reg_success_text,
    back_btn: content?.back_btn || DEFAULTS.back_btn,
  };

  const reset = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setRegisterSuccess(false);
    setForgotSuccess(false);
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

  const handleForgotPassword = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }
    setIsLoading(true);
    // Link führt zum Web-Reset-Flow – mobile öffnet ihn im Browser.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}/passwort-zuruecksetzen`,
    });
    setIsLoading(false);
    // Aus Sicherheitsgründen immer Erfolg anzeigen (keine Account-Enumeration).
    if (error) {
      setError("Anfrage fehlgeschlagen. Bitte erneut versuchen.");
    } else {
      setForgotSuccess(true);
    }
  };

  const handleRegister = async () => {
    setError(null);
    if (!email || !password || !confirmPassword) {
      setError("Bitte alle Felder ausfüllen.");
      return;
    }
    if (!consentAccepted) {
      setError("Bitte stimme den Nutzungsbedingungen und der Datenschutzerklärung zu.");
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
        data: { role: "consumer" },
        // Bestätigungslink öffnet sich im Browser auf der Website.
        emailRedirectTo: process.env.EXPO_PUBLIC_SITE_URL,
      },
    });
    setIsLoading(false);
    if (error) {
      if (error instanceof AuthWeakPasswordError) {
        setError(
          "Dieses Passwort ist zu schwach oder bereits bekannt. Bitte wähle ein einzigartiges Passwort – am besten mit einem Passwort-Manager wie Bitwarden oder 1Password.",
        );
      } else if (error.message.includes("already registered")) {
        setError("Diese E-Mail-Adresse ist bereits registriert.");
      } else {
        setError("Registrierung fehlgeschlagen. Bitte erneut versuchen.");
      }
    } else {
      setRegisterSuccess(true);
    }
  };

  if (registerSuccess) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centerContent}>
          <Text style={s.formTitle}>{t.brand_title}</Text>
          <Text style={s.successTitle}>{t.reg_success_title}</Text>
          <Text style={s.successText}>{t.reg_success_text}</Text>
          <TouchableOpacity onPress={() => switchView("login")}>
            <Text style={s.link}>{t.back_to_login}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (view === "welcome") {
    return (
      <SafeAreaView style={s.container} edges={["top"]}>
        <ScrollView
          contentContainerStyle={s.welcomeContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ImageBackground
            source={require("@/assets/images/fair-fuehrer-guide-hero.jpg")}
            style={s.welcomeHero}
            resizeMode="cover"
          >
            <LinearGradient
              colors={["rgba(24,23,22,0.35)", "rgba(24,23,22,0.75)"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={s.welcomeMenuBtn}>
              <MenuButton tint="#fff" />
            </View>
            <View style={s.welcomeHeroContent}>
              <Text style={s.welcomeEyebrow}>{t.welcome_eyebrow}</Text>
              <Text style={s.welcomeHeadline}>{t.welcome_headline}</Text>
              <Text style={s.welcomeSubtitle}>{t.welcome_subtitle}</Text>

              <TouchableOpacity style={s.welcomeBtnPrimary} onPress={() => switchView("register")}>
                <Text style={s.welcomeBtnPrimaryText}>{t.welcome_btn_register}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.welcomeBtnSecondary} onPress={() => switchView("login")}>
                <Text style={s.welcomeBtnSecondaryText}>{t.welcome_btn_login}</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>

          <View style={s.welcomeValueSection}>
            <PlanCompareCard
              title="Kostenlos"
              features={[
                { text: "Audio-Guides zu allen Orten anhören" },
                { text: "Alle Kategorien entdecken (Gastronomie, Einkaufen, Engagement …)" },
                { text: "50 % der Pins in „Sehenswertes“" },
                { text: "Karte & Ortsuche" },
                { text: "100 % der Pins in „Sehenswertes“", locked: true },
                { text: "Offline-Karten", locked: true },
                { text: "Orte vorschlagen & Pins erstellen", locked: true },
              ]}
            />

            <PlanCompareCard
              title="FAIRFÜHRER+"
              isPremium
              features={[
                { text: "Alles aus der kostenlosen Version" },
                { text: "100 % der Pins in „Sehenswertes“" },
                { text: "Offline-Karten für unterwegs" },
                { text: "Neue Orte vorschlagen & eigene Pins erstellen" },
                { text: "Pins werden von unseren Redakteuren geprüft" },
              ]}
              button={
                <TouchableOpacity
                  style={s.welcomeBtnPremium}
                  onPress={() => switchView("register")}
                >
                  <Text style={s.welcomeBtnPremiumText}>{t.welcome_btn_premium}</Text>
                </TouchableOpacity>
              }
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (view === "forgot") {
    return (
      <SafeAreaView style={s.container} edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={s.headerPlaceholder}>
            <TouchableOpacity
              onPress={() => switchView("login")}
              style={s.headerSpacer}
              hitSlop={8}
            >
              <Text style={s.backBtnText}>{t.back_btn}</Text>
            </TouchableOpacity>
            <View style={s.headerMenuSlot}>
              <MenuButton />
            </View>
          </View>

          <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
            <Text style={s.formTitle}>{t.brand_title}</Text>
            <Text style={s.formHeadline}>{t.forgot_headline}</Text>

            {forgotSuccess ? (
              <>
                <Text style={s.successText}>{t.forgot_success}</Text>
                <TouchableOpacity onPress={() => switchView("login")}>
                  <Text style={s.link}>{t.back_to_login}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.googleHint}>{t.forgot_hint}</Text>

                {error && <Text style={s.errorText}>{error}</Text>}

                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>E-Mail</Text>
                  <TextInput
                    style={s.input}
                    placeholder="deine@email.de"
                    placeholderTextColor="rgba(24, 23, 22, 0.5)"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>

                <TouchableOpacity
                  style={[s.button, isLoading && s.buttonDisabled]}
                  onPress={handleForgotPassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fc6c14" />
                  ) : (
                    <Text style={s.buttonText}>{t.forgot_btn}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const isReg = view === "register";
  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={s.headerPlaceholder}>
          <TouchableOpacity
            onPress={() => switchView("welcome")}
            style={s.headerSpacer}
            hitSlop={8}
          >
            <Text style={s.backBtnText}>{t.back_btn}</Text>
          </TouchableOpacity>
          <View style={s.headerMenuSlot}>
            <MenuButton />
          </View>
        </View>

        <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
          <Text style={s.formTitle}>{t.brand_title}</Text>
          <Text style={s.formHeadline}>{isReg ? t.headline_register : t.headline_login}</Text>

          <View style={s.tabRow}>
            <TouchableOpacity style={s.tabBtn} onPress={() => switchView("login")}>
              <Text style={[s.tabBtnText, !isReg && s.tabBtnTextActive]}>{t.tab_login}</Text>
              {!isReg && <View style={s.tabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity style={s.tabBtn} onPress={() => switchView("register")}>
              <Text style={[s.tabBtnText, isReg && s.tabBtnTextActive]}>{t.tab_register}</Text>
              {isReg && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          </View>

          {error && <Text style={s.errorText}>{error}</Text>}

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>E-Mail</Text>
            <TextInput
              style={s.input}
              placeholder="deine@email.de"
              placeholderTextColor="rgba(24, 23, 22, 0.5)"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Passwort</Text>
            <PasswordInput
              style={s.input}
              placeholder="min. 8 Zeichen"
              placeholderTextColor="rgba(24, 23, 22, 0.5)"
              value={password}
              onChangeText={setPassword}
              autoComplete={isReg ? "new-password" : "password"}
            />
            {isReg && (
              <Text style={s.fieldHint}>
                Mindestens 8 Zeichen mit Groß- und Kleinbuchstaben, einer Zahl und einem
                Sonderzeichen (z. B. !, @, #). Wähle ein einzigartiges Passwort – wir empfehlen
                einen Passwort-Manager (z. B. Dashlane, 1Password) zum Erstellen sicherer
                Passwörter.
              </Text>
            )}
          </View>

          {isReg && (
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Passwort wiederholen</Text>
              <PasswordInput
                style={s.input}
                placeholder="Passwort bestätigen"
                placeholderTextColor="rgba(24, 23, 22, 0.5)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoComplete="new-password"
              />
            </View>
          )}

          {isReg && (
            <TouchableOpacity
              style={s.consentRow}
              onPress={() => setConsentAccepted((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[s.checkbox, consentAccepted && s.checkboxChecked]}>
                {consentAccepted && <Text style={s.checkmark}>✓</Text>}
              </View>
              <Text style={s.consentText}>
                Ich habe die{" "}
                <Text style={s.consentLink} onPress={() => router.push("/(drawer)/agb")}>
                  Nutzungsbedingungen
                </Text>{" "}
                und die{" "}
                <Text style={s.consentLink} onPress={() => router.push("/(drawer)/datenschutz")}>
                  Datenschutzerklärung
                </Text>{" "}
                gelesen und stimme ihnen zu.
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.button, isLoading && s.buttonDisabled]}
            onPress={isReg ? handleRegister : handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fc6c14" />
            ) : (
              <Text style={s.buttonText}>{isReg ? t.btn_register : t.btn_login}</Text>
            )}
          </TouchableOpacity>

          {!isReg && (
            <TouchableOpacity onPress={() => switchView("forgot")} hitSlop={8}>
              <Text style={s.forgotLink}>{t.forgot_link}</Text>
            </TouchableOpacity>
          )}

          <Text style={s.partnerInfo}>
            {t.partner_info}{" "}
            <Text
              style={s.partnerLink}
              onPress={() => Linking.openURL("https://www.fairfuehrer.guide/partner-werden")}
            >
              {t.partner_link}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centerContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 16,
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
  fieldHint: {
    fontSize: 12,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#212358",
    paddingLeft: 4,
    lineHeight: 17,
  },
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
  headerPlaceholder: {
    height: 110,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  headerSpacer: { width: 72, justifyContent: "center" },
  headerMenuSlot: { width: 72, alignItems: "flex-end" },
  formContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 16,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#181716",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: "#fc6c14",
    borderColor: "#fc6c14",
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "FiraSansCondensed_700Bold",
    lineHeight: 16,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: "#555",
    fontFamily: "FiraSansCondensed_400Regular",
    lineHeight: 19,
  },
  consentLink: {
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_600SemiBold",
    textDecorationLine: "underline",
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
  welcomeContent: {
    paddingBottom: 48,
  },
  welcomeHero: {
    minHeight: 420,
    justifyContent: "flex-end",
  },
  welcomeMenuBtn: {
    position: "absolute",
    top: 52,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    padding: 6,
    zIndex: 10,
  },
  welcomeHeroContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    gap: 14,
  },
  welcomeEyebrow: {
    fontSize: 11,
    fontFamily: "FiraSansCondensed_700Bold",
    color: "#fc6c14",
    letterSpacing: 2.5,
  },
  welcomeHeadline: {
    fontFamily: "Anton_400Regular",
    fontSize: 52,
    color: "#fff",
    lineHeight: 54,
    letterSpacing: 1,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 22,
  },
  welcomeBtnPrimary: {
    backgroundColor: "#fc6c14",
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: "center",
    marginTop: 4,
  },
  welcomeBtnPrimaryText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  welcomeBtnSecondary: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  welcomeBtnSecondaryText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
  welcomeValueSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 16,
  },
  welcomeBtnPremium: {
    backgroundColor: "#181716",
    borderRadius: 12,
    paddingTop: 12,
    paddingBottom: 16,
    alignItems: "center",
    marginTop: 8,
  },
  welcomeBtnPremiumText: {
    color: "#fc6c14",
    fontSize: 20,
    fontFamily: "FiraSansCondensed_700Bold",
    letterSpacing: 0.5,
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: "FiraSansCondensed_600SemiBold",
    color: "#fc6c14",
  },
  partnerInfo: {
    fontSize: 16,
    fontFamily: "FiraSansCondensed_400Regular",
    color: "#000000",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 40,
    marginBottom: 20,
  },
  partnerLink: {
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_600SemiBold",
    textDecorationLine: "underline",
  },
  formTitle: {
    fontFamily: "Anton_400Regular",
    fontSize: 40,
    color: "#fc6c14",
    textAlign: "center",
    letterSpacing: 3,
  },
  formHeadline: {
    fontSize: 28,
    fontFamily: "Anton_400Regular",
    color: "#111",
    letterSpacing: 1,
    alignSelf: "center",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#f0e8e0",
  },
  dividerText: {
    color: "#999",
    fontSize: 13,
    fontFamily: "FiraSansCondensed_400Regular",
  },
  googleHint: {
    fontSize: 13,
    color: "#666",
    fontFamily: "FiraSansCondensed_400Regular",
    textAlign: "center",
    lineHeight: 18,
    width: "100%",
  },
  forgotLink: {
    fontSize: 14,
    color: "#fc6c14",
    fontFamily: "FiraSansCondensed_600SemiBold",
    textAlign: "center",
  },
});
