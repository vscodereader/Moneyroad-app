import { type RefreshEvent, RefreshHub, streamRefresh } from "./refresh-hub";

// Singleton wiring: one hub per process. The API server triggers a refresh via
// POST /internal/refresh-discussion-list, which fans out to every SSE client.
export const discussionHub = new RefreshHub("d");

/**
 * Bridges the push-based hub to an async generator for `reply.sse.send(...)`.
 * Runs until the client disconnects (signal aborted), keeping the SSE handler
 * pending and the connection open. Mirrors `streamNews`, minus the filter.
 */
export function streamDiscussionList(
  signal: AbortSignal
): AsyncGenerator<{ event: string; data: RefreshEvent }> {
  return streamRefresh(discussionHub, "discussion-list", signal);
}
