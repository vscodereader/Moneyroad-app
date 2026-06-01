import { useEffect, useRef } from "react";

import { authClient } from "@/lib/auth-client";
import { setQuotesManagerUser, startQuotesManager } from "@/stores/quotes-sse";

/**
 * Boots the singleton SSE pipeline backing the quotes store and keeps it in
 * sync with the current session. Call once near the root of the tree.
 */
export function useQuotesManager(): void {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;

  // Ref keeps the boot effect deps-empty (manager is a one-shot singleton) while
  // still letting `startQuotesManager` read the latest userId via the getter.
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    const stop = startQuotesManager(() => userIdRef.current);
    return stop;
  }, []);

  useEffect(() => {
    setQuotesManagerUser(userId);
  }, [userId]);
}
