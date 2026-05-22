import type { MarketDataFeed, Quote } from "./types";

const BASE_MIN = 10_000;
const BASE_RANGE = 90_000;
const VOLATILITY = 0.002;

/**
 * Random-walk feed for local development and tests. Lets the SSE pipeline run
 * end-to-end without KIS credentials.
 */
export class MockFeed implements MarketDataFeed {
  private readonly prices = new Map<string, number>();
  private readonly intervalMs: number;
  private handler: ((quote: Quote) => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs;
  }

  start(): Promise<void> {
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    return Promise.resolve();
  }

  stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return Promise.resolve();
  }

  subscribe(symbol: string): void {
    if (!this.prices.has(symbol)) {
      this.prices.set(
        symbol,
        Math.floor(BASE_MIN + Math.random() * BASE_RANGE)
      );
    }
  }

  unsubscribe(symbol: string): void {
    this.prices.delete(symbol);
  }

  onQuote(handler: (quote: Quote) => void): void {
    this.handler = handler;
  }

  private tick(): void {
    const handler = this.handler;
    if (!handler) {
      return;
    }
    for (const [symbol, prev] of this.prices) {
      const delta = Math.round((Math.random() - 0.5) * prev * VOLATILITY * 2);
      const price = Math.max(1, prev + delta);
      this.prices.set(symbol, price);
      handler({ symbol, price, change: price - prev, ts: Date.now() });
    }
  }
}
