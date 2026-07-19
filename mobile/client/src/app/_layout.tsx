/**
 * Root Layout — uses Stack navigation (no bottom tabs).
 * Auth screens (landing, sign-in, register) are full-screen.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    // Hide the splash screen once the layout is mounted
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="vendor-register" />
      </Stack>
    </>
  );
}
