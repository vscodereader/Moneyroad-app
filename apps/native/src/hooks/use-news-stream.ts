import { env } from "@moneyroad-app/env/native";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import EventSource from "react-native-sse";

import { useAppStateResume } from "@/hooks/use-app-state-resume";
import { authClient } from "@/lib/auth-client";
import { fetchStreamToken } from "@/lib/stream-token";
import { orpc } from "@/utils/orpc";

export type NewsTab = "watch" | "all" | "industry" | "market" | "policy";

const INVALIDATE_DEBOUNCE_MS = 800;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

// Our category taxonomy filter per screen tab. `all`/`watch` subscribe to
// everything; the feed refetch re-applies the precise (watchlist) filter.
function streamCategories(tab: NewsTab): string | undefined {
  switch (tab) {
    case "industry":
      return "sector";
    case "market":
      return "market,global";
    case "policy":
      return "other";
    default:
      return;
  }
}

/**
 * Subscribes to the realtime news SSE stream for the active tab and refetches
 * the oRPC feed when new items arrive (debounced). Using invalidation keeps the
 * server-side NewsItem mapping as the single source of truth — no client-side
 * remap of the raw event. No-op when `EXPO_PUBLIC_REALTIME_URL` is unset.
 */
export function useNewsStream(tab: NewsTab): void {
  const queryClient = useQueryClient();
  // The realtime stream token requires a session; only connect when signed in.
  // Anonymous users still get the (public) oRPC feed, just without live updates.
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  // 백그라운드 복귀 시 활성 effect가 등록해 둔 강제 재연결 함수를 호출한다.
  const forceReconnectRef = useRef<() => void>(() => undefined);
  useAppStateResume(() => forceReconnectRef.current());

  useEffect(() => {
    const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
    if (!(baseUrl && userId)) {
      return;
    }

    let source: EventSource<"news"> | null = null;
    let closed = false;
    let backoff = RECONNECT_BASE_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidateFeed = () => {
      if (invalidateTimer) {
        return;
      }
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        // Partial-match key covers the infinite feed query across all pages.
        queryClient.invalidateQueries({ queryKey: orpc.news.feed.key() });
      }, INVALIDATE_DEBOUNCE_MS);
    };

    const scheduleReconnect = () => {
      if (closed || reconnectTimer) {
        return;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, backoff);
      backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
    };

    const connect = async () => {
      if (closed) {
        return;
      }
      const token = await fetchStreamToken();
      if (closed || !token) {
        scheduleReconnect();
        return;
      }
      const params = new URLSearchParams({ token });
      const categories = streamCategories(tab);
      if (categories) {
        params.set("categories", categories);
      }
      // pollingInterval: 0 disables the library's auto-reconnect so we can
      // reconnect with a freshly-minted (unexpired) token ourselves.
      source = new EventSource<"news">(
        `${baseUrl}/stream/news?${params.toString()}`,
        { pollingInterval: 0 }
      );
      source.addEventListener("open", () => {
        backoff = RECONNECT_BASE_MS;
      });
      source.addEventListener("news", () => invalidateFeed());
      source.addEventListener("error", () => {
        source?.removeAllEventListeners();
        source?.close();
        source = null;
        scheduleReconnect();
      });
    };

    // 백그라운드 복귀 시 좀비 연결을 끊고 새 토큰으로 즉시 재연결한다.
    forceReconnectRef.current = () => {
      if (closed) {
        return;
      }
      source?.removeAllEventListeners();
      source?.close();
      source = null;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      backoff = RECONNECT_BASE_MS;
      connect();
    };

    connect();

    return () => {
      closed = true;
      forceReconnectRef.current = () => undefined;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (invalidateTimer) {
        clearTimeout(invalidateTimer);
      }
      source?.removeAllEventListeners();
      source?.close();
    };
  }, [tab, userId, queryClient]);
}
