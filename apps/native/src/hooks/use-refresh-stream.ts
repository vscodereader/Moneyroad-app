import { env } from "@moneyroad-app/env/native";
import { useEffect, useRef } from "react";
import EventSource from "react-native-sse";

import { useAppStateResume } from "@/hooks/use-app-state-resume";
import { fetchStreamToken } from "@/lib/stream-token";

const INVALIDATE_DEBOUNCE_MS = 800;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

/**
 * 서버가 "다시 불러와라"만 알려 주는 SSE 채널 하나를 구독한다.
 *
 * 이벤트 payload 는 쓰지 않고 캐시 무효화만 한다 — 서버가 단일 진실이어야
 * 한다는 docs/adr/0001 제약 3(낙관적 append 금지)을 따른 것이다. 그래서 채널마다
 * 다른 것은 (1) 경로/이벤트 이름과 (2) 무엇을 무효화할지, 이 둘뿐이고 재연결·
 * 디바운스·토큰 처리는 전부 같다. 그 공통부가 여기 있다.
 *
 * 익명 연결을 허용한다: 세션이 있으면 스트림 토큰을 `?token=` 으로 붙이지만,
 * 토큰이 없거나 실패해도 구독을 막지 않는다. (토큰이 필수인 뉴스 스트림은
 * 필터 파라미터까지 있어 별도로 둔다.)
 *
 * `EXPO_PUBLIC_REALTIME_URL` 이 없으면 아무것도 하지 않는다.
 *
 * @param channel 경로와 이벤트 이름에 함께 쓰이는 채널 이름
 *                (`/stream/<channel>` 을 구독하고 `<channel>` 이벤트를 듣는다)
 * @param onRefresh 이벤트가 올 때 실행할 무효화. 매 렌더 새로 만들어도 된다.
 */
export function useRefreshStream<E extends string>(
  channel: E,
  onRefresh: () => void
): void {
  // 콜백을 effect 의존성에 넣으면 렌더마다 연결이 끊겼다 붙는다. ref 로 최신
  // 값만 넘겨 두고 effect 는 채널이 바뀔 때만 다시 돈다.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // 백그라운드 복귀 시 활성 effect가 등록해 둔 강제 재연결 함수를 호출한다.
  const forceReconnectRef = useRef<() => void>(() => undefined);
  useAppStateResume(() => forceReconnectRef.current());

  useEffect(() => {
    const baseUrl = env.EXPO_PUBLIC_REALTIME_URL;
    if (!baseUrl) {
      return;
    }

    let source: EventSource<E> | null = null;
    let closed = false;
    let backoff = RECONNECT_BASE_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidate = () => {
      if (invalidateTimer) {
        return;
      }
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        onRefreshRef.current();
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
        ? `${baseUrl}/stream/${channel}?${queryString}`
        : `${baseUrl}/stream/${channel}`;
      // pollingInterval: 0 disables the library's auto-reconnect so we can
      // reconnect with a freshly-minted (unexpired) token ourselves.
      source = new EventSource<E>(url, { pollingInterval: 0 });
      source.addEventListener("open", () => {
        backoff = RECONNECT_BASE_MS;
        // SSE carries only refresh pings and has no replay cursor. Refetch once
        // after every successful connection to recover events missed offline.
        invalidate();
      });
      source.addEventListener(channel, () => invalidate());
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
      // Refresh immediately on foreground; the subsequent open invalidation is
      // coalesced by INVALIDATE_DEBOUNCE_MS.
      invalidate();
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
  }, [channel]);
}
