import { env } from "@moneyroad-app/env/realtime";
import { KisFeed } from "./kis";
import { MockFeed } from "./mock";
import type { MarketDataFeed } from "./types";

export function createFeed(): MarketDataFeed {
  if (env.FEED === "kis") {
    return new KisFeed();
  }
  return new MockFeed(env.MOCK_INTERVAL_MS);
}
