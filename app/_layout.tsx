import { useEffect, useState } from "react";
import { Stack, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
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
import AnimatedSplash from "@/components/AnimatedSplash";
import AppDrawer from "@/components/AppDrawer";
import { initializePurchases } from "@/lib/revenuecat";

// Tracing für die Navigation (expo-router nutzt React Navigation darunter).
// Wird unten via registerNavigationContainer mit dem Router verbunden.
const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

Sentry.init({
  dsn: "https://56408b4e34df2ce6230499434808286c@o4511537387339776.ingest.de.sentry.io/4511537588338768",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Performance Monitoring: 20 % der Transaktionen sampeln (in Produktion sinnvoll).
  tracesSampleRate: 0.2,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), navigationIntegration],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

SplashScreen.preventAutoHideAsync();
initializePurchases();

function RootLayoutNav() {
  const { isLoading, isPro } = useAuth();
  const { isOpen, closeDrawer } = useDrawer();
  const { status, fetchAll } = usePlacesStore();
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  // Daten erst laden, wenn der Auth-Status (inkl. isPro) feststeht — sonst
  // würde der Offline-Cache-Fallback bei Premium-Nutzern fälschlich
  // übersprungen, weil isPro anfangs noch false ist.
  useEffect(() => {
    if (isLoading) return;
    fetchAll(isPro);
  }, [isLoading, isPro, fetchAll]);

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
          name="auth-modal"
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

function RootLayout() {
  // Navigation-Container an Sentry binden, damit Routenwechsel als
  // Transaktionen erfasst werden (Performance-Tracing für expo-router).
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

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

  // GestureHandlerRootView ist Pflicht für react-native-gesture-handler
  // (z. B. ScrollView aus dieser Lib in SearchSection). expo-router fügt
  // ihn in SDK 55 NICHT mehr automatisch hinzu — daher hier explizit.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <DrawerProvider>
          <StatusBar style="auto" />
          <RootLayoutNav />
        </DrawerProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
