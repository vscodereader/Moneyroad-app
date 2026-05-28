import type { MarketDataFeed, Quote } from "./types";

const BASE_MIN = 10_000;
const BASE_RANGE = 90_000;
const VOLATILITY = 0.002;
const PERCENT = 100;

// 지수 코드는 종목가와 자릿수가 달라, 현실적인 기준값으로 시드해 둔다.
const INDEX_BASES: Record<string, number> = {
  "0001": 2742, // KOSPI
  "1001": 869, // KOSDAQ
};

/**
 * Random-walk feed for local development and tests. Lets the SSE pipeline run
 * end-to-end without KIS credentials.
 */
export class MockFeed implements MarketDataFeed {
  private readonly prices = new Map<string, number>();
  // 전일 종가 대용 기준값. change/changeRate를 이 값 기준으로 산출한다.
  private readonly bases = new Map<string, number>();
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

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  subscribe(symbol: string): void {
    if (!this.prices.has(symbol)) {
      const seed =
        INDEX_BASES[symbol] ??
        Math.floor(BASE_MIN + Math.random() * BASE_RANGE);
      this.prices.set(symbol, seed);
      this.bases.set(symbol, seed);
    }
  }

  unsubscribe(symbol: string): void {
    this.prices.delete(symbol);
    this.bases.delete(symbol);
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
      const base = this.bases.get(symbol) ?? price;
      const change = price - base;
      handler({
        symbol,
        price,
        change,
        changeRate: base ? (change / base) * PERCENT : 0,
        ts: Date.now(),
      });
    }
  }
}
