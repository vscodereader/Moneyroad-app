import { signal, userWatchlist } from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";

import { getDb, isNewsDbConfigured } from "@/services/news/db";
import { quoteHub } from "@/services/quotes";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

// 관리자 등록 시그널 종목 — anonymous(비로그인) 클라이언트도 시세 구독을 허용하는
// 화이트리스트. 홈에서 노출되는 limited 시그널은 비로그인도 시세를 볼 수 있어야
// 하므로 quotes.ts 플러그인이 이 셋을 보고 authorize 한다. pinned-poller가 매
// 주기마다 갱신한다.
export const publicSignalSymbols = new Set<string>();

async function pollOnce(): Promise<void> {
  // GROUP BY 로 distinct stock_code 추출. SELECT DISTINCT 도 동등하지만
  // drizzle 버전 의존성을 피해 명시적 그룹핑을 쓴다.
  if (running) {
    return;
  }
  running = true;
  try {
    const db = getDb();
    const [watchlistRows, signalRows] = await Promise.all([
      db
        .select({ stockCode: userWatchlist.stockCode })
        .from(userWatchlist)
        .groupBy(userWatchlist.stockCode),
      db
        .select({ stockCode: signal.stockCode })
        .from(signal)
        .groupBy(signal.stockCode),
    ]);
    const signalCodes = signalRows.map((r) => r.stockCode);
    // 화이트리스트 동기화: 비로그인도 시세를 볼 수 있는 시그널 종목.
    publicSignalSymbols.clear();
    for (const code of signalCodes) {
      publicSignalSymbols.add(code);
    }
    const symbols = Array.from(
      new Set([...watchlistRows.map((r) => r.stockCode), ...signalCodes])
    );
    const { added, removed } = quoteHub.setPins(symbols);
    if (added > 0 || removed > 0) {
      log.info({
        pinned: {
          event: "pins_updated",
          total: symbols.length,
          watchlist: watchlistRows.length,
          signals: signalRows.length,
          added,
          removed,
        },
      });
    }
  } catch (error) {
    log.warn({ pinned: { event: "pins_poll_failed" }, error });
  } finally {
    running = false;
  }
}

/**
 * Periodically pins the union of (사용자 관심 종목) + (관리자 등록 시그널 종목)
 * stock codes on QuoteHub so those symbols stay subscribed upstream regardless
 * of SSE clients — the alarm evaluator (next phase) consumes those ticks.
 * No-op without DATABASE_URL so the realtime service remains usable as a pure
 * quotes feed.
 */
export function startPinnedPoller(): void {
  if (!isNewsDbConfigured() || timer) {
    return;
  }
  // 즉시 1회 수행해 부팅 직후부터 상시 구독을 채운다.
  pollOnce();
  timer = setInterval(pollOnce, env.WATCHLIST_POLL_INTERVAL_MS);
  log.info({
    pinned: {
      event: "poller_started",
      intervalMs: env.WATCHLIST_POLL_INTERVAL_MS,
    },
  });
}

export function stopPinnedPoller(): void {
  if (!timer) {
    return;
  }
  clearInterval(timer);
  timer = null;
  log.info({ pinned: { event: "poller_stopped" } });
}
