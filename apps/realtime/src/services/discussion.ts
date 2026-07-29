import { type DiscussionEvent, DiscussionHub } from "./discussion-hub";

// Singleton wiring: one hub per process. The API server triggers a refresh via
// POST /internal/refresh-discussion-list, which fans out to every SSE client.
export const discussionHub = new DiscussionHub();

/**
 * Bridges the push-based hub to an async generator for `reply.sse.send(...)`.
 * Runs until the client disconnects (signal aborted), keeping the SSE handler
 * pending and the connection open. Mirrors `streamNews`, minus the filter.
 */
export async function* streamDiscussionList(
  signal: AbortSignal
): AsyncGenerator<{ event: string; data: DiscussionEvent }> {
  const queue: DiscussionEvent[] = [];
  let wake: (() => void) | null = null;

  const wakeUp = () => {
    const resolve = wake;
    wake = null;
    resolve?.();
  };

  const client = discussionHub.addClient((event) => {
    queue.push(event);
    wakeUp();
  });
  signal.addEventListener("abort", wakeUp);

  try {
    while (!signal.aborted) {
      while (queue.length > 0) {
        const event = queue.shift();
        if (event) {
          yield { event: "discussion-list", data: event };
        }
      }
      if (signal.aborted) {
        break;
      }
      await new Promise<void>((resolve) => {
        if (queue.length > 0 || signal.aborted) {
          resolve();
          return;
        }
        wake = resolve;
      });
    }
  } finally {
    signal.removeEventListener("abort", wakeUp);
    discussionHub.removeClient(client);
  }
}
