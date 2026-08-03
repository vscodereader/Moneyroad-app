import { useQueryClient } from "@tanstack/react-query";

import { useRefreshStream } from "@/hooks/use-refresh-stream";
import { orpc } from "@/utils/orpc";

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
 *
 * 연결·재연결·디바운스는 `useRefreshStream` 이 담당한다 — signal-feed 채널과
 * 한 글자도 다르지 않던 부분이라 합쳤다.
 */
export function useDiscussionListStream(): void {
  const queryClient = useQueryClient();

  useRefreshStream("discussion-list", () => {
    // Partial-match key covers the rooms query across all tab/search inputs.
    queryClient.invalidateQueries({
      queryKey: orpc.discussion.rooms.key(),
    });
  });
}
