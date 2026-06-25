import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import AuthScreen from "@/components/auth/AuthScreen";

// Modal-Route — wird vom Paywall geöffnet, wenn der Nutzer kein Konto hat.
// Liegt VOR dem Paywall im Stack: nach erfolgreicher Anmeldung schließt sich
// das Modal automatisch (router.back), der Paywall darunter behält seinen
// State (gewähltes Paket) und kann den Kauf direkt fortsetzen.
//
// Wir starten den AuthScreen sofort im Login-View (skipWelcome) — Welcome
// mit den PlanCompareCards würde wie ein zweiter Paywall wirken und den
// Nutzer verwirren.
export default function AuthModal() {
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    if (session) {
      router.back();
    }
  }, [session, router]);

  return (
    <View style={styles.container}>
      <AuthScreen skipWelcome />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
});
