import { startCollector, stopCollector } from "./news/collector";
import type { NewsEvent, NewsFilter } from "./news/types";
import { NewsHub } from "./news-hub";

// Singleton wiring: one hub per process. The collector pushes every newly
// stored item into the hub, which fans out to interested SSE clients.
export const newsHub = new NewsHub();

export function startNews(): void {
  startCollector((event) => newsHub.broadcast(event));
}

export function stopNews(): void {
  stopCollector();
}

/**
 * Bridges the push-based hub to an async generator for `reply.sse.send(...)`.
 * Runs until the client disconnects (signal aborted), keeping the SSE handler
 * pending and the connection open. Mirrors `streamQuotes`.
 */
export async function* streamNews(
  filter: NewsFilter,
  signal: AbortSignal
): AsyncGenerator<{ event: string; data: NewsEvent }> {
  const queue: NewsEvent[] = [];
  let wake: (() => void) | null = null;

  const wakeUp = () => {
    const resolve = wake;
    wake = null;
    resolve?.();
  };

  const client = newsHub.addClient(filter, (event) => {
    queue.push(event);
    wakeUp();
  });
  signal.addEventListener("abort", wakeUp);

  try {
    while (!signal.aborted) {
      while (queue.length > 0) {
        const event = queue.shift();
        if (event) {
          yield { event: "news", data: event };
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
    newsHub.removeClient(client);
  }
}
