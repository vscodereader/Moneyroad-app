import { env } from "@moneyroad-app/env/native";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import EventSource from "react-native-sse";

import { useAppStateResume } from "@/hooks/use-app-state-resume";
import { fetchStreamToken } from "@/lib/stream-token";
import { orpc } from "@/utils/orpc";

const INVALIDATE_DEBOUNCE_MS = 800;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

/**
 * Subscribes to the realtime signal-feed SSE stream and refetches the oRPC
 * `signal.feed` + `signal.counts` queries when a signal is added or removed
 * (debounced). Using invalidation keeps the server-side SignalItem mapping as
 * the single source of truth — no client-side remap of the raw event, per
 * docs/adr/0001 constraint 3. No-op when `EXPO_PUBLIC_REALTIME_URL` is unset.
 *
 * Like the discussion-list stream (and unlike the news stream) this endpoint
 * allows anonymous connections: `signal.feed`/`signal.counts` are
 * `publicProcedure`, so a missing/failed token must not block the subscription.
 */
export function useSignalStream(): void {
  const queryClient = useQueryClient();

  // 백그라운드 복귀 시 활성 effect가 등록해 둔 강제 재연결 함수를 호출한다.
  const forceReconnectRef = useRef<() => void>(() => undefined);
  useAppStateResume(() => forceReconnectRef.current());

  useEffect(() => {
    const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
    if (!baseUrl) {
      return;
    }

    let source: EventSource<"signal-feed"> | null = null;
    let closed = false;
    let backoff = RECONNECT_BASE_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidateSignals = () => {
      if (invalidateTimer) {
        return;
      }
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        // 목록과 필터 칩 건수는 같은 쓰기에서 함께 틀어지므로 한 이벤트로 둘 다
        // 무효화한다. 부분 일치 키라 window/action 조합 전부를 덮는다.
        queryClient.invalidateQueries({ queryKey: orpc.signal.feed.key() });
        queryClient.invalidateQueries({ queryKey: orpc.signal.counts.key() });
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
      // Anonymous connections are allowed; attach a token only if we get one.
      const token = await fetchStreamToken();
      if (closed) {
        return;
      }
      const params = new URLSearchParams();
      if (token) {
        params.set("token", token);
      }
      const queryString = params.toString();
      const url = queryString
        ? `${baseUrl}/stream/signal-feed?${queryString}`
        : `${baseUrl}/stream/signal-feed`;
      // pollingInterval: 0 disables the library's auto-reconnect so we can
      // reconnect with a freshly-minted (unexpired) token ourselves.
      source = new EventSource<"signal-feed">(url, { pollingInterval: 0 });
      source.addEventListener("open", () => {
        backoff = RECONNECT_BASE_MS;
      });
      source.addEventListener("signal-feed", () => invalidateSignals());
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
  }, [queryClient]);
}
