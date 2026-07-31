import { type Href, Redirect } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useMrTheme } from "@/hooks/use-mr-theme";
import { useOnboardingStatus } from "@/hooks/use-onboarding-status";
import {
  buildLoginHref,
  type MoneyRoadReturnTo,
} from "@/utils/auth-navigation";

const ONBOARDING_HREF = "/(moneyroad)/onboarding" as Href;

/**
 * Route guard for login-required screens. Use in the thin route file so screen
 * components can assume an authenticated user (per apps/native/CLAUDE.md).
 *
 * - session hydrating → blank themed screen (avoids a login flash for logged-in
 *   users on cold start)
 * - no session → redirect to the login screen
 * - authenticated → render children
 */
export function AuthGate({
  children,
  returnTo,
}: {
  children: ReactNode;
  returnTo: MoneyRoadReturnTo;
}) {
  const { t } = useMrTheme();
  const { completed, isAuthenticated, isPending } = useOnboardingStatus();

  if (isPending) {
    return <View style={{ backgroundColor: t.bg, flex: 1 }} />;
  }
  if (!isAuthenticated) {
    return <Redirect href={buildLoginHref(returnTo)} />;
  }
  if (!completed) {
    return <Redirect href={ONBOARDING_HREF} />;
  }
  return <>{children}</>;
}
