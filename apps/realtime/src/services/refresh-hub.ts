/** Serializable "refetch now" signal pushed over SSE. Carries no domain data. */
export interface RefreshEvent {
  id: string;
  refreshedAt: string;
}

export interface RefreshClient {
  readonly id: string;
  send(event: RefreshEvent): void;
}

/**
 * In-memory fan-out of contentless refresh signals to SSE clients (Phase 1,
 * single instance).
 *
 * Unlike {@link NewsHub} there is no per-client filter: the channels built on
 * this hub (discussion list, signal feed) are public, so every write nudges
 * every client to refetch. The payload is ignored by the client — it just
 * invalidates its cache — which is why one hub serves every such channel.
 *
 * NewsHub stays separate on purpose: it carries a real per-client `NewsFilter`
 * and a filtered `broadcast` path, and folding that in would push a filter
 * concept into channels that have none.
 */
export class RefreshHub {
  private readonly clients = new Set<RefreshClient>();
  private seq = 0;
  /** client id 접두어. 로그에서 어느 채널의 연결인지 구분한다. */
  private readonly idPrefix: string;

  constructor(idPrefix: string) {
    this.idPrefix = idPrefix;
  }

  get clientCount(): number {
    return this.clients.size;
  }

  addClient(send: (event: RefreshEvent) => void): RefreshClient {
    this.seq += 1;
    const client: RefreshClient = {
      id: `${this.idPrefix}${this.seq}`,
      send,
    };
    this.clients.add(client);
    return client;
  }

  removeClient(client: RefreshClient): void {
    this.clients.delete(client);
  }

  /** Nudge EVERY connected client to refetch. No filter — the data is public. */
  broadcastRefresh(): void {
    const now = new Date().toISOString();
    const event: RefreshEvent = {
      id: `refresh-${now}`,
      refreshedAt: now,
    };
    for (const client of this.clients) {
      client.send(event);
    }
  }
}

/**
 * Bridges the push-based hub to an async generator for `reply.sse.send(...)`.
 * Runs until the client disconnects (signal aborted), keeping the SSE handler
 * pending and the connection open. Mirrors `streamNews`, minus the filter.
 *
 * 이 경로에서 가장 까다로운 부분이다 — abort 리스너를 놓치거나 drain 루프에
 * wake 경쟁이 생기면 클라이언트마다 연결이 샌다. 채널마다 복사하지 말 것.
 */
export async function* streamRefresh(
  hub: RefreshHub,
  eventName: string,
  signal: AbortSignal
): AsyncGenerator<{ event: string; data: RefreshEvent }> {
  const queue: RefreshEvent[] = [];
  let wake: (() => void) | null = null;

  const wakeUp = () => {
    const resolve = wake;
    wake = null;
    resolve?.();
  };

  const client = hub.addClient((event) => {
    queue.push(event);
    wakeUp();
  });
  signal.addEventListener("abort", wakeUp);

  try {
    while (!signal.aborted) {
      while (queue.length > 0) {
        const event = queue.shift();
        if (event) {
          yield { event: eventName, data: event };
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
    hub.removeClient(client);
  }
}
