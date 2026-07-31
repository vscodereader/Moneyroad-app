import { type Href, Redirect } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { useOnboardingStatus } from "@/hooks/use-onboarding-status";

const HOME_HREF = "/(moneyroad)/(tabs)" as Href;

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { t } = useMrTheme();
  const { completed, isAuthenticated, isPending } = useOnboardingStatus();

  if (isPending) {
    return <View style={{ backgroundColor: t.bg, flex: 1 }} />;
  }
  if (!isAuthenticated || completed) {
    return <Redirect href={HOME_HREF} />;
  }
  return <>{children}</>;
}
