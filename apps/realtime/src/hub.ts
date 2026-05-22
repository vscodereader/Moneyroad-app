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
 */
export class QuoteHub {
  private readonly subscribers = new Map<string, Set<Client>>();
  private readonly clients = new Set<Client>();
  private readonly feed: MarketDataFeed;
  private seq = 0;

  constructor(feed: MarketDataFeed) {
    this.feed = feed;
    feed.onQuote((quote) => this.broadcast(quote));
  }

  get clientCount(): number {
    return this.clients.size;
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
        this.feed.subscribe(symbol);
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
        this.feed.unsubscribe(symbol);
      }
    }
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
