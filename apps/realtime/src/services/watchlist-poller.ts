import { userWatchlist } from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";

import { getDb, isNewsDbConfigured } from "@/services/news/db";
import { quoteHub } from "@/services/quotes";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function pollOnce(): Promise<void> {
  // GROUP BY 로 distinct stock_code 추출. SELECT DISTINCT 도 동등하지만
  // drizzle 버전 의존성을 피해 명시적 그룹핑을 쓴다.
  if (running) {
    return;
  }
  running = true;
  try {
    const rows = await getDb()
      .select({ stockCode: userWatchlist.stockCode })
      .from(userWatchlist)
      .groupBy(userWatchlist.stockCode);
    const symbols = rows.map((r) => r.stockCode);
    const { added, removed } = quoteHub.setPins(symbols);
    if (added > 0 || removed > 0) {
      log.info({
        watchlist: {
          event: "pins_updated",
          total: symbols.length,
          added,
          removed,
        },
      });
    }
  } catch (error) {
    log.warn({ watchlist: { event: "pins_poll_failed" }, error });
  } finally {
    running = false;
  }
}

/**
 * Periodically pins the union of all users' watchlist symbols on QuoteHub so
 * those symbols stay subscribed upstream regardless of SSE clients — the
 * alarm evaluator (next phase) consumes those ticks. No-op without
 * DATABASE_URL so the realtime service remains usable as a pure quotes feed.
 */
export function startWatchlistPoller(): void {
  if (!isNewsDbConfigured() || timer) {
    return;
  }
  // 즉시 1회 수행해 부팅 직후부터 상시 구독을 채운다.
  pollOnce();
  timer = setInterval(pollOnce, env.WATCHLIST_POLL_INTERVAL_MS);
  log.info({
    watchlist: {
      event: "poller_started",
      intervalMs: env.WATCHLIST_POLL_INTERVAL_MS,
    },
  });
}

export function stopWatchlistPoller(): void {
  if (!timer) {
    return;
  }
  clearInterval(timer);
  timer = null;
  log.info({ watchlist: { event: "poller_stopped" } });
}
