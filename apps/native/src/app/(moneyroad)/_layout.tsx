import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { useMrTheme } from "@/hooks/use-mr-theme";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function MoneyRoadLayout() {
  const { isDark } = useMrTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="login" />
        <Stack.Screen name="watchlist" />
        <Stack.Screen name="search" />
        <Stack.Screen name="alerts" />
        <Stack.Screen name="stock/[code]" />
        <Stack.Screen name="discussion-room/[id]" />
        <Stack.Screen name="discussion-room/new" />
        <Stack.Screen name="signal/new" />
        <Stack.Screen name="signal/manage" />
        <Stack.Screen name="notice/new" />
        <Stack.Screen
          name="settings/[page]"
          options={{ presentation: "transparentModal", animation: "fade" }}
        />
      </Stack>
    </>
  );
}
