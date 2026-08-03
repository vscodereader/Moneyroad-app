import type { NewsEvent, NewsFilter } from "./news/types";

export interface NewsClient {
  readonly id: string;
  matches(event: NewsEvent): boolean;
  send(event: NewsEvent): void;
}

function matchesFilter(filter: NewsFilter, event: NewsEvent): boolean {
  if (filter.all) {
    return true;
  }
  if (event.stockCode && filter.symbols.has(event.stockCode)) {
    return true;
  }
  if (event.category && filter.categories.has(event.category)) {
    return true;
  }
  return false;
}

/**
 * In-memory fan-out of collected news to SSE clients (Phase 1, single instance).
 * Unlike {@link QuoteHub} there is no upstream subscription to ref-count: the
 * collector produces every item and each client filters by symbol/category.
 */
export class NewsHub {
  private readonly clients = new Set<NewsClient>();
  private seq = 0;

  get clientCount(): number {
    return this.clients.size;
  }

  addClient(filter: NewsFilter, send: (event: NewsEvent) => void): NewsClient {
    this.seq += 1;
    const client: NewsClient = {
      id: `n${this.seq}`,
      send,
      matches: (event) => matchesFilter(filter, event),
    };
    this.clients.add(client);
    return client;
  }

  removeClient(client: NewsClient): void {
    this.clients.delete(client);
  }

  broadcast(event: NewsEvent): void {
    for (const client of this.clients) {
      if (client.matches(event)) {
        client.send(event);
      }
    }
  }

  /**
   * Nudge EVERY connected client to refetch, bypassing per-client filters.
   * Used for admin news writes (RFC 0002 §4-6 B): the client ignores the
   * payload and just invalidates its feed cache, so one event refreshes all
   * tabs at once regardless of which category/symbol each client subscribed to.
   */
  broadcastRefresh(event: NewsEvent): void {
    for (const client of this.clients) {
      client.send(event);
    }
  }
}
