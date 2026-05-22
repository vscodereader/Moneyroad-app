export interface Quote {
  change?: number;
  changeRate?: number;
  price: number;
  symbol: string;
  ts: number;
  volume?: number;
}

/**
 * Upstream real-time market-data source. A single feed instance backs the whole
 * process (Phase 1: one KIS connection per service instance). The hub registers
 * symbols on demand and receives ticks via `onQuote`.
 */
export interface MarketDataFeed {
  onQuote(handler: (quote: Quote) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(symbol: string): void;
  unsubscribe(symbol: string): void;
}
