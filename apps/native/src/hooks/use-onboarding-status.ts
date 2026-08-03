import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export function useOnboardingStatus() {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const isAuthenticated = Boolean(userId);
  const statusOptions = orpc.onboarding.status.queryOptions({
    enabled: isAuthenticated,
  });
  const status = useQuery({
    ...statusOptions,
    // oRPC's procedure key is shared across sessions. Add the account id so a
    // completed account can never make a newly signed-in account look complete
    // from stale TanStack cache data.
    queryKey: [...statusOptions.queryKey, userId ?? "guest"],
  });

  return {
    completed: status.data?.completed ?? false,
    isAuthenticated,
    isPending: session.isPending || (isAuthenticated && status.isPending),
    session: session.data,
    status,
  };
}
