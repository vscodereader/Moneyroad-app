import {
  signal,
  userPriceAlert,
  userWatchlist,
} from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { and, eq, isNull } from "drizzle-orm";
import { log } from "evlog";

import { getDb, isNewsDbConfigured } from "@/services/news/db";
import { quoteHub } from "@/services/quotes";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
// A refresh requested while a sync is in flight (e.g. the API trigger landing
// mid-poll) sets this so pollOnce runs one more pass — the just-written row is
// never missed between the DB read and the next interval tick.
let pendingRerun = false;

// 관리자 등록 시그널 종목 — anonymous(비로그인) 클라이언트도 시세 구독을 허용하는
// 화이트리스트. 홈에서 노출되는 limited 시그널은 비로그인도 시세를 볼 수 있어야
// 하므로 quotes.ts 플러그인이 이 셋을 보고 authorize 한다. pinned-poller가 매
// 주기마다 갱신한다.
export const publicSignalSymbols = new Set<string>();

// Reads the (watchlist ∪ signal) stock codes and syncs the pinned set +
// anonymous public signal whitelist. GROUP BY 로 distinct stock_code 추출
// (SELECT DISTINCT 도 동등하지만 drizzle 버전 의존성을 피해 명시적 그룹핑).
async function syncPins(): Promise<void> {
  const db = getDb();
  const [watchlistRows, signalRows, alertRows] = await Promise.all([
    db
      .select({ stockCode: userWatchlist.stockCode })
      .from(userWatchlist)
      .groupBy(userWatchlist.stockCode),
    db
      .select({ stockCode: signal.stockCode })
      .from(signal)
      .groupBy(signal.stockCode),
    // 활성·미발화 가격 알림 종목 — 평가기가 도달가 교차를 보려면 상시 구독돼야 한다.
    db
      .select({ stockCode: userPriceAlert.stockCode })
      .from(userPriceAlert)
      .where(
        and(eq(userPriceAlert.active, true), isNull(userPriceAlert.triggeredAt))
      )
      .groupBy(userPriceAlert.stockCode),
  ]);
  const signalCodes = signalRows.map((r) => r.stockCode);
  // 화이트리스트 동기화: 비로그인도 시세를 볼 수 있는 시그널 종목.
  publicSignalSymbols.clear();
  for (const code of signalCodes) {
    publicSignalSymbols.add(code);
  }
  const symbols = Array.from(
    new Set([
      ...watchlistRows.map((r) => r.stockCode),
      ...signalCodes,
      ...alertRows.map((r) => r.stockCode),
    ])
  );
  const { added, removed } = quoteHub.setPins(symbols);
  if (added > 0 || removed > 0) {
    log.info({
      pinned: {
        event: "pins_updated",
        total: symbols.length,
        watchlist: watchlistRows.length,
        signals: signalRows.length,
        alerts: alertRows.length,
        added,
        removed,
      },
    });
  }
}

async function pollOnce(): Promise<void> {
  // Single-flight: a concurrent call records a rerun instead of overlapping, so
  // the trigger that lands mid-poll still gets a fresh pass afterwards.
  if (running) {
    pendingRerun = true;
    return;
  }
  running = true;
  try {
    do {
      pendingRerun = false;
      try {
        await syncPins();
      } catch (error) {
        log.warn({ pinned: { event: "pins_poll_failed" }, error });
      }
    } while (pendingRerun);
  } finally {
    running = false;
  }
}

/**
 * Runs a pin sync immediately, bypassing the interval. The API server calls the
 * internal endpoint backing this right after a watchlist/signal write so newly
 * referenced stocks are pinned (and signal stocks whitelisted) within
 * milliseconds instead of up to one poll interval. No-op without a DB.
 */
export async function triggerPinsRefresh(): Promise<void> {
  if (!isNewsDbConfigured()) {
    return;
  }
  await pollOnce();
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
