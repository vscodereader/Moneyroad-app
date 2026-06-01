import type { MarketDataFeed, Quote } from "./feed/types";

export interface Client {
  readonly id: string;
  send(quote: Quote): void;
  readonly symbols: ReadonlySet<string>;
}

/**
 * In-memory fan-out (Phase 1, single instance). Tracks which clients want which
 * symbols, registers a symbol upstream on first interest and unregisters it when
 * the last interested client leaves. Phase 2 replaces the in-process maps with a
 * Redis pub/sub backplane shared across instances.
 *
 * Pinned symbols are a second source of interest independent of SSE clients —
 * the watchlist poller pins the union of all users' watchlists so those symbols
 * stay subscribed upstream even when nobody is connected (alarm evaluators need
 * the ticks). Upstream subscribe/unsubscribe fires only when a symbol enters or
 * leaves the union of (subscribers ∪ pinned).
 */
export class QuoteHub {
  private readonly subscribers = new Map<string, Set<Client>>();
  private readonly clients = new Set<Client>();
  private readonly pinned = new Set<string>();
  private readonly feed: MarketDataFeed;
  private seq = 0;

  constructor(feed: MarketDataFeed) {
    this.feed = feed;
    feed.onQuote((quote) => this.broadcast(quote));
  }

  get clientCount(): number {
    return this.clients.size;
  }

  get pinnedCount(): number {
    return this.pinned.size;
  }

  addClient(symbols: string[], send: (quote: Quote) => void): Client {
    this.seq += 1;
    const client: Client = {
      id: `c${this.seq}`,
      symbols: new Set(symbols),
      send,
    };
    this.clients.add(client);
    for (const symbol of client.symbols) {
      let set = this.subscribers.get(symbol);
      if (!set) {
        set = new Set();
        this.subscribers.set(symbol, set);
        // Already pinned → upstream subscription is held; don't double-subscribe.
        if (!this.pinned.has(symbol)) {
          this.feed.subscribe(symbol);
        }
      }
      set.add(client);
    }
    return client;
  }

  removeClient(client: Client): void {
    this.clients.delete(client);
    for (const symbol of client.symbols) {
      const set = this.subscribers.get(symbol);
      if (!set) {
        continue;
      }
      set.delete(client);
      if (set.size === 0) {
        this.subscribers.delete(symbol);
        // Pinned holds the upstream subscription open for alarm evaluation.
        if (!this.pinned.has(symbol)) {
          this.feed.unsubscribe(symbol);
        }
      }
    }
  }

  /**
   * Replaces the pinned symbol set in one call (intended for the watchlist
   * poller). Returns counts so the caller can log the diff. Pinned symbols stay
   * subscribed upstream regardless of SSE client presence.
   */
  setPins(next: Iterable<string>): { added: number; removed: number } {
    const desired = new Set(next);
    let added = 0;
    let removed = 0;

    for (const symbol of desired) {
      if (this.pinned.has(symbol)) {
        continue;
      }
      this.pinned.add(symbol);
      // Subscribers may already hold this symbol; only request upstream when
      // pinned is the first interest.
      if (!this.subscribers.has(symbol)) {
        this.feed.subscribe(symbol);
      }
      added += 1;
    }

    const toRemove: string[] = [];
    for (const symbol of this.pinned) {
      if (!desired.has(symbol)) {
        toRemove.push(symbol);
      }
    }
    for (const symbol of toRemove) {
      this.pinned.delete(symbol);
      // Still wanted by an SSE client → keep upstream subscription.
      if (!this.subscribers.has(symbol)) {
        this.feed.unsubscribe(symbol);
      }
      removed += 1;
    }

    return { added, removed };
  }

  private broadcast(quote: Quote): void {
    const set = this.subscribers.get(quote.symbol);
    if (!set) {
      return;
    }
    for (const client of set) {
      client.send(quote);
    }
  }
}
