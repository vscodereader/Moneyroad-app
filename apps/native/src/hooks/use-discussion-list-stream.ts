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
 * Subscribes to the realtime discussion-list SSE stream and refetches the oRPC
 * `discussion.rooms` query when the list changes (debounced). Using
 * invalidation keeps the server-side room mapping as the single source of truth
 * — no client-side remap of the raw event. No-op when `EXPO_PUBLIC_REALTIME_URL`
 * is unset.
 *
 * Unlike the news stream, this endpoint allows anonymous connections: we still
 * mint a stream token when a session exists (attaching it as `?token=`), but a
 * missing/failed token does not block the subscription.
 */
export function useDiscussionListStream(): void {
  const queryClient = useQueryClient();

  // 백그라운드 복귀 시 활성 effect가 등록해 둔 강제 재연결 함수를 호출한다.
  const forceReconnectRef = useRef<() => void>(() => undefined);
  useAppStateResume(() => forceReconnectRef.current());

  useEffect(() => {
    const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
    if (!baseUrl) {
      return;
    }

    let source: EventSource<"discussion-list"> | null = null;
    let closed = false;
    let backoff = RECONNECT_BASE_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidateRooms = () => {
      if (invalidateTimer) {
        return;
      }
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        // Partial-match key covers the rooms query across all tab/search inputs.
        queryClient.invalidateQueries({
          queryKey: orpc.discussion.rooms.key(),
        });
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
        ? `${baseUrl}/stream/discussion-list?${queryString}`
        : `${baseUrl}/stream/discussion-list`;
      // pollingInterval: 0 disables the library's auto-reconnect so we can
      // reconnect with a freshly-minted (unexpired) token ourselves.
      source = new EventSource<"discussion-list">(url, { pollingInterval: 0 });
      source.addEventListener("open", () => {
        backoff = RECONNECT_BASE_MS;
      });
      source.addEventListener("discussion-list", () => invalidateRooms());
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
