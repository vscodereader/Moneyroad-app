import "@/polyfills";
import "@/global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { useLogCurrentScreen } from "@/hooks/use-log-current-screen";
import { usePushRegistration } from "@/hooks/use-push-registration";
import { useQuotesManager } from "@/hooks/use-quotes-manager";
import { hydrateOnboarding } from "@/utils/onboarding";
import { queryClient } from "@/utils/orpc";

export const unstable_settings = {
  initialRouteName: "(moneyroad)",
};

function StackLayout() {
  // Register the device's push token once the user is signed in.
  usePushRegistration();
  // Singleton SSE pipeline driving the global quotes store.
  useQuotesManager();
  // Dev-only: log the active route to the Metro console.
  useLogCurrentScreen();
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen name="(moneyroad)" options={{ headerShown: false }} />
      {/*<Stack.Screen name="(drawer)" options={{ headerShown: false }} />*/}
      <Stack.Screen
        name="modal"
        options={{ title: "Modal", presentation: "modal" }}
      />
    </Stack>
  );
}

export default function Layout() {
  useEffect(() => {
    hydrateOnboarding();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <StackLayout />
            </HeroUINativeProvider>
          </AppThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
