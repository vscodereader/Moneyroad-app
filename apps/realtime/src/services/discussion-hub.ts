/** Serializable discussion-list refresh signal pushed over SSE. */
export interface DiscussionEvent {
  id: string;
  refreshedAt: string;
}

export interface DiscussionClient {
  readonly id: string;
  send(event: DiscussionEvent): void;
}

/**
 * In-memory fan-out of discussion-list refresh signals to SSE clients (Phase 1,
 * single instance). Unlike {@link NewsHub} there is no per-client filter: the
 * discussion list is global/public, so every write nudges every client to
 * refetch. Mirrors {@link NewsHub}'s `broadcastRefresh` without the filtered
 * `broadcast` path.
 */
export class DiscussionHub {
  private readonly clients = new Set<DiscussionClient>();
  private seq = 0;

  get clientCount(): number {
    return this.clients.size;
  }

  addClient(send: (event: DiscussionEvent) => void): DiscussionClient {
    this.seq += 1;
    const client: DiscussionClient = {
      id: `d${this.seq}`,
      send,
    };
    this.clients.add(client);
    return client;
  }

  removeClient(client: DiscussionClient): void {
    this.clients.delete(client);
  }

  /**
   * Nudge EVERY connected client to refetch the discussion list. The payload is
   * ignored by the client, which just invalidates its list cache, so one event
   * refreshes all tabs at once. No filter — the discussion list is public.
   */
  broadcastRefresh(): void {
    const now = new Date().toISOString();
    const event: DiscussionEvent = {
      id: `refresh-${now}`,
      refreshedAt: now,
    };
    for (const client of this.clients) {
      client.send(event);
    }
  }
}
