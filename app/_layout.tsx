import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { useFonts, Anton_400Regular } from "@expo-google-fonts/anton";
import {
  FiraSansCondensed_400Regular,
  FiraSansCondensed_500Medium,
  FiraSansCondensed_600SemiBold,
  FiraSansCondensed_700Bold,
} from "@expo-google-fonts/fira-sans-condensed";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DrawerProvider, useDrawer } from "@/context/DrawerContext";
import { usePlacesStore } from "@/stores/placesStore";
import { useAuthFlowStore } from "@/stores/authFlowStore";
import AnimatedSplash from "@/components/AnimatedSplash";
import AppDrawer from "@/components/AppDrawer";
import { initializePurchases } from "@/lib/revenuecat";
import { supabase } from "@/lib/supabase";

SplashScreen.preventAutoHideAsync();
initializePurchases();

function RootLayoutNav() {
  const { session, isLoading, isPro } = useAuth();
  const { isOpen, closeDrawer } = useDrawer();
  const segments = useSegments();
  const router = useRouter();
  const { status, fetchAll } = usePlacesStore();
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  // Daten erst laden, wenn der Auth-Status (inkl. isPro) feststeht — sonst
  // würde der Offline-Cache-Fallback bei Premium-Nutzern fälschlich
  // übersprungen, weil isPro anfangs noch false ist.
  useEffect(() => {
    if (isLoading) return;
    fetchAll(isPro);
  }, [isLoading, isPro, fetchAll]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, segments, router]);

  // Deep-Link-Handler: verarbeitet Links aus Bestätigungs- und Reset-E-Mails
  // (fairfuhrer://auth/callback?code=...&type=...).
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      const { queryParams } = Linking.parse(url);
      const code = typeof queryParams?.code === "string" ? queryParams.code : null;
      const type = typeof queryParams?.type === "string" ? queryParams.type : null;
      if (!code) return;

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return;

      // Passwort-Reset: in den "reset"-Modus des AuthScreen leiten.
      // Bei Bestätigung (signup) reicht die Session – der Nutzer ist eingeloggt.
      if (type === "recovery") {
        useAuthFlowStore.getState().setPendingPasswordReset(true);
        router.replace("/(tabs)/profil");
      }
    };

    // Kaltstart: App wurde durch den Link geöffnet.
    Linking.getInitialURL().then(handleUrl);

    // App lief bereits im Hintergrund.
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);

  const dataReady = status === "success" || status === "error";

  useEffect(() => {
    if (dataReady && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [dataReady, isLoading]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="place/[id]"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
            gestureEnabled: true,
            gestureDirection: "vertical",
          }}
        />
        <Stack.Screen
          name="custom-paywall"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
            gestureEnabled: true,
            gestureDirection: "vertical",
          }}
        />
        <Stack.Screen
          name="(drawer)"
          options={{ presentation: "card", animation: "slide_from_right" }}
        />
      </Stack>

      <AppDrawer visible={isOpen} onClose={closeDrawer} />

      {showAnimatedSplash && dataReady && !isLoading && (
        <AnimatedSplash onFinished={() => setShowAnimatedSplash(false)} />
      )}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    FiraSansCondensed_400Regular,
    FiraSansCondensed_500Medium,
    FiraSansCondensed_600SemiBold,
    FiraSansCondensed_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
  }

  return (
    <AuthProvider>
      <DrawerProvider>
        <StatusBar style="auto" />
        <RootLayoutNav />
      </DrawerProvider>
    </AuthProvider>
  );
}
