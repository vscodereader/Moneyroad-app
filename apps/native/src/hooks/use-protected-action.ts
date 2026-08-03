import { useCallback } from "react";

import { useOnboardingStatus } from "@/hooks/use-onboarding-status";
import type { MoneyRoadReturnTo } from "@/utils/auth-navigation";
import { nav } from "@/utils/nav";

export function useProtectedAction() {
  const { completed, isAuthenticated, isPending } = useOnboardingStatus();

  const runProtected = useCallback(
    ({
      action,
      returnTo,
    }: {
      action: () => void;
      returnTo: MoneyRoadReturnTo;
    }) => {
      if (isPending) {
        return;
      }
      if (!isAuthenticated) {
        nav.openLogin({ returnTo });
        return;
      }
      if (!completed) {
        nav.openOnboarding();
        return;
      }
      action();
    },
    [completed, isAuthenticated, isPending]
  );

  return {
    canRun: isAuthenticated && completed,
    isPending,
    runProtected,
  };
}
