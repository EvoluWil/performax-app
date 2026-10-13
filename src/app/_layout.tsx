import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { QueryClientProvider } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/constants/theme';
import { NotificationBridge } from '@/features/notification/notification-bridge';
import { BrandProvider } from '@/providers/brand-provider';
import { CompanyProvider, SessionProvider, useSession } from '@/providers/session-provider';
import { queryClient } from '@/services/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <CompanyProvider>
          <BrandProvider>
            <RootNavigation fontsReady={fontsLoaded || Boolean(fontError)} />
          </BrandProvider>
        </CompanyProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootNavigation({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = useSession();

  useEffect(() => {
    if (ready && fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady, ready]);

  if (!ready || !fontsReady) return <BootSplash />;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SessionGate />
      <NotificationBridge />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.color.background },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="companies" />
        <Stack.Screen name="task/[taskId]" />
        <Stack.Screen name="notifications" />
      </Stack>
    </View>
  );
}

function BootSplash() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.splash}>
      <StatusBar style="light" />
      <Image
        source={require('../../assets/images/splash.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
    </View>
  );
}

function SessionGate() {
  const { ready, tokens } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const atLogin = segments[0] === 'login';
    if (!tokens && !atLogin) router.replace('/login');
    if (tokens && atLogin) router.replace('/');
  }, [ready, router, segments, tokens]);

  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  splash: {
    flex: 1,
    backgroundColor: theme.color.primary,
  },
});
