import type { Env } from "../env";
import { KisFeed } from "./kis";
import { MockFeed } from "./mock";
import type { MarketDataFeed } from "./types";

export function createFeed(env: Env): MarketDataFeed {
  if (env.FEED === "kis") {
    return new KisFeed(env);
  }
  return new MockFeed(env.MOCK_INTERVAL_MS);
}
