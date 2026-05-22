import { createFeed } from "./feed/create";
import type { Quote } from "./feed/types";
import { QuoteHub } from "./hub";

// Singleton wiring: one feed (KIS connection / mock) + one hub per process.
// Shared by the SSE plugin (routing) and index.ts (lifecycle).
const feed = createFeed();

export const quoteHub = new QuoteHub(feed);

export function startQuotes(): Promise<void> {
  return feed.start();
}

export function stopQuotes(): void {
  feed.stop();
}

/**
 * Bridges the push-based hub to an async generator so it can be handed to
 * `reply.sse.send(...)`. The generator runs until the client disconnects
 * (signal aborted), keeping the SSE handler pending and the connection open.
 */
export async function* streamQuotes(
  symbols: string[],
  signal: AbortSignal
): AsyncGenerator<{ event: string; data: Quote }> {
  const queue: Quote[] = [];
  let wake: (() => void) | null = null;

  const wakeUp = () => {
    const resolve = wake;
    wake = null;
    resolve?.();
  };

  const client = quoteHub.addClient(symbols, (quote) => {
    queue.push(quote);
    wakeUp();
  });
  signal.addEventListener("abort", wakeUp);

  try {
    while (!signal.aborted) {
      while (queue.length > 0) {
        const quote = queue.shift();
        if (quote) {
          yield { event: "quote", data: quote };
        }
      }
      if (signal.aborted) {
        break;
      }
      await new Promise<void>((resolve) => {
        // Re-check to avoid a lost wake-up between draining and waiting.
        if (queue.length > 0 || signal.aborted) {
          resolve();
          return;
        }
        wake = resolve;
      });
    }
  } finally {
    signal.removeEventListener("abort", wakeUp);
    quoteHub.removeClient(client);
  }
}
