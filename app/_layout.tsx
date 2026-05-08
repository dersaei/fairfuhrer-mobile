import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import {
  FiraSansCondensed_400Regular,
  FiraSansCondensed_500Medium,
  FiraSansCondensed_600SemiBold,
  FiraSansCondensed_700Bold,
} from '@expo-google-fonts/fira-sans-condensed';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DrawerProvider, useDrawer } from '@/context/DrawerContext';
import { usePlacesStore } from '@/stores/placesStore';
import AnimatedSplash from '@/components/AnimatedSplash';
import AppDrawer from '@/components/AppDrawer';
import { initializePurchases } from '@/lib/revenuecat';

SplashScreen.preventAutoHideAsync();
initializePurchases();

function RootLayoutNav() {
  const { session, isLoading } = useAuth();
  const { isOpen, closeDrawer } = useDrawer();
  const segments = useSegments();
  const router = useRouter();
  const { status, fetchAll } = usePlacesStore();
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, router]);

  const dataReady = status === 'success' || status === 'error';

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
            presentation: 'modal',
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            gestureDirection: 'vertical',
          }}
        />
        <Stack.Screen
          name="(drawer)/datenschutz"
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="(drawer)/agb"
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="(drawer)/impressum"
          options={{ presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="(drawer)/hilfe"
          options={{ presentation: 'card', animation: 'slide_from_right' }}
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
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
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
