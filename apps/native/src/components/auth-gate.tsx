import { type Href, Redirect } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";

import { useMrTheme } from "@/hooks/use-mr-theme";
import { authClient } from "@/lib/auth-client";

const LOGIN_HREF = "/(moneyroad)/login" as Href;

/**
 * Route guard for login-required screens. Use in the thin route file so screen
 * components can assume an authenticated user (per apps/native/CLAUDE.md).
 *
 * - session hydrating → blank themed screen (avoids a login flash for logged-in
 *   users on cold start)
 * - no session → redirect to the login screen
 * - authenticated → render children
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useMrTheme();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <View style={{ backgroundColor: t.bg, flex: 1 }} />;
  }
  if (!session?.user) {
    return <Redirect href={LOGIN_HREF} />;
  }
  return <>{children}</>;
}
