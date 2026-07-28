/** Serializable signal-feed refresh signal pushed over SSE. */
export interface SignalFeedEvent {
  id: string;
  refreshedAt: string;
}

export interface SignalFeedClient {
  readonly id: string;
  send(event: SignalFeedEvent): void;
}

/**
 * In-memory fan-out of signal-feed refresh signals to SSE clients (Phase 1,
 * single instance). Like {@link DiscussionHub} — and unlike {@link NewsHub} —
 * there is no per-client filter: `signal.feed`/`signal.counts` are
 * `publicProcedure`, so every write nudges every client to refetch.
 */
export class SignalFeedHub {
  private readonly clients = new Set<SignalFeedClient>();
  private seq = 0;

  get clientCount(): number {
    return this.clients.size;
  }

  addClient(send: (event: SignalFeedEvent) => void): SignalFeedClient {
    this.seq += 1;
    const client: SignalFeedClient = {
      id: `s${this.seq}`,
      send,
    };
    this.clients.add(client);
    return client;
  }

  removeClient(client: SignalFeedClient): void {
    this.clients.delete(client);
  }

  /**
   * Nudge EVERY connected client to refetch the signal feed. The payload is
   * ignored by the client, which just invalidates its feed+counts cache, so one
   * event refreshes the list and the tab counters together.
   */
  broadcastRefresh(): void {
    const now = new Date().toISOString();
    const event: SignalFeedEvent = {
      id: `refresh-${now}`,
      refreshedAt: now,
    };
    for (const client of this.clients) {
      client.send(event);
    }
  }
}
