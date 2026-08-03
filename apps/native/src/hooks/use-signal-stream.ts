import { useQueryClient } from "@tanstack/react-query";

import { useRefreshStream } from "@/hooks/use-refresh-stream";
import { orpc } from "@/utils/orpc";

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
 *
 * 연결·재연결·디바운스는 `useRefreshStream` 이 담당한다.
 */
export function useSignalStream(): void {
  const queryClient = useQueryClient();

  useRefreshStream("signal-feed", () => {
    // 목록과 필터 칩 건수는 같은 쓰기에서 함께 틀어지므로 한 이벤트로 둘 다
    // 무효화한다. 부분 일치 키라 window/action 조합 전부를 덮는다.
    queryClient.invalidateQueries({ queryKey: orpc.signal.feed.key() });
    queryClient.invalidateQueries({ queryKey: orpc.signal.counts.key() });
  });
}
