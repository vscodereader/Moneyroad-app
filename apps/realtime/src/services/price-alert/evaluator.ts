import {
  stockMaster,
  userNotificationSetting,
  userPriceAlert,
} from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { and, eq, isNull } from "drizzle-orm";
import { log } from "evlog";

import type { Quote } from "@/services/feed/types";
import { getDb, isNewsDbConfigured } from "@/services/news/db";
import { sendPushToUser } from "@/services/news/expo-push";
import { quoteHub } from "@/services/quotes";

type Direction = "above" | "below";

interface ActiveAlert {
  direction: Direction;
  id: number;
  stockCode: string;
  targetPrice: number;
  userId: string;
}

// stockCode → 활성·미발화 알림들. 틱마다 동기적으로 조회하므로 인메모리에 둔다.
const alertsBySymbol = new Map<string, ActiveAlert[]>();

let timer: ReturnType<typeof setInterval> | null = null;
let unsubscribe: (() => void) | null = null;

function isCrossed(
  direction: Direction,
  targetPrice: number,
  price: number
): boolean {
  return direction === "above" ? price >= targetPrice : price <= targetPrice;
}

/**
 * 활성(active=true)·미발화(triggered_at IS NULL) 알림을 모두 읽어 stockCode별
 * 인메모리 인덱스를 새로 구성한다. 부팅 시 1회 + 주기 백스톱 + 알림 생성/삭제 시
 * 내부 트리거에서 호출한다. await(DB 조회) 성공 후에만 clear 하므로 조회 실패 시
 * 기존 인덱스는 보존된다. No-op without DATABASE_URL.
 */
export async function refreshPriceAlerts(): Promise<void> {
  if (!isNewsDbConfigured()) {
    return;
  }
  const rows = await getDb()
    .select({
      direction: userPriceAlert.direction,
      id: userPriceAlert.id,
      stockCode: userPriceAlert.stockCode,
      targetPrice: userPriceAlert.targetPrice,
      userId: userPriceAlert.userId,
    })
    .from(userPriceAlert)
    .where(
      and(eq(userPriceAlert.active, true), isNull(userPriceAlert.triggeredAt))
    );

  alertsBySymbol.clear();
  for (const row of rows) {
    const list = alertsBySymbol.get(row.stockCode);
    if (list) {
      list.push(row);
    } else {
      alertsBySymbol.set(row.stockCode, [row]);
    }
  }
}

function handleQuote(quote: Quote): void {
  const alerts = alertsBySymbol.get(quote.symbol);
  if (!alerts || alerts.length === 0) {
    return;
  }
  const price = quote.price;
  const crossed = alerts.filter((a) =>
    isCrossed(a.direction, a.targetPrice, price)
  );
  if (crossed.length === 0) {
    return;
  }
  // 동기적으로 인메모리에서 제거 — 후속 틱이 같은 알림을 중복 발화하지 않게 한다.
  // (DB triggered_at 커밋 전 refresh가 재추가하더라도 fireAlert의 원자적 업데이트가
  // 최종 single-fire를 보장한다.)
  const remaining = alerts.filter((a) => !crossed.includes(a));
  if (remaining.length > 0) {
    alertsBySymbol.set(quote.symbol, remaining);
  } else {
    alertsBySymbol.delete(quote.symbol);
  }
  for (const alert of crossed) {
    fireAlert(alert, price).catch(() => {
      // fireAlert logs its own errors and never rejects.
    });
  }
}

async function fireAlert(alert: ActiveAlert, price: number): Promise<void> {
  const db = getDb();
  const roundedPrice = Math.round(price);
  try {
    // 원자적 single-fire: triggered_at을 처음 찍은 쪽만 푸시를 보낸다(중복/멀티
    // 인스턴스 방지). 발화 시 active=false로 내려 핀/평가 대상에서도 빠진다.
    const won = await db
      .update(userPriceAlert)
      .set({ active: false, triggeredAt: new Date() })
      .where(
        and(eq(userPriceAlert.id, alert.id), isNull(userPriceAlert.triggeredAt))
      )
      .returning({ id: userPriceAlert.id });
    if (won.length === 0) {
      return;
    }

    // 사용자별 가격 알림 토글 존중(설정 행이 없으면 기본 ON).
    const [setting] = await db
      .select({ priceAlert: userNotificationSetting.priceAlert })
      .from(userNotificationSetting)
      .where(eq(userNotificationSetting.userId, alert.userId))
      .limit(1);
    if (setting && !setting.priceAlert) {
      return;
    }

    const [stock] = await db
      .select({ name: stockMaster.htsKorIsnm })
      .from(stockMaster)
      .where(eq(stockMaster.mkscShrnIscd, alert.stockCode))
      .limit(1);
    const stockName = stock?.name ?? alert.stockCode;
    const target = alert.targetPrice.toLocaleString("ko-KR");
    const current = roundedPrice.toLocaleString("ko-KR");
    const title = `${stockName} 가격 알림`;
    const body =
      alert.direction === "above"
        ? `목표가 ${target}원 이상 도달했어요. 현재가 ${current}원`
        : `목표가 ${target}원 이하로 내려왔어요. 현재가 ${current}원`;

    await sendPushToUser(alert.userId, title, body, {
      type: "price_alert",
      alertId: alert.id,
      stockCode: alert.stockCode,
      direction: alert.direction,
      targetPrice: alert.targetPrice,
      price: roundedPrice,
    });

    log.info({
      priceAlert: {
        event: "fired",
        alertId: alert.id,
        userId: alert.userId,
        stockCode: alert.stockCode,
        direction: alert.direction,
        targetPrice: alert.targetPrice,
        price: roundedPrice,
      },
    });
  } catch (err) {
    log.error({ err, priceAlert: { event: "fire_failed", alertId: alert.id } });
  }
}

/**
 * 가격 알림 평가기를 시작한다. QuoteHub 틱을 구독해 활성 알림의 도달가 교차를
 * 감지하고, 처음 도달하는 순간 1회 푸시를 보낸다. 인메모리 인덱스는 부팅 시 1회 +
 * 주기 백스톱으로 갱신하며, 알림 생성/삭제 시 내부 트리거가 즉시 갱신한다.
 * 평가 대상 종목은 pinned-poller가 상시 구독으로 핀해 둔다. No-op without DATABASE_URL.
 */
export function startPriceAlertEvaluator(): void {
  if (!isNewsDbConfigured() || timer) {
    return;
  }
  refreshPriceAlerts().catch((err) => {
    log.error({ err, priceAlert: { event: "initial_refresh_failed" } });
  });
  unsubscribe = quoteHub.onQuote(handleQuote);
  timer = setInterval(() => {
    refreshPriceAlerts().catch((err) => {
      log.error({ err, priceAlert: { event: "refresh_failed" } });
    });
  }, env.PRICE_ALERT_REFRESH_INTERVAL_MS);
  log.info({
    priceAlert: {
      event: "evaluator_started",
      intervalMs: env.PRICE_ALERT_REFRESH_INTERVAL_MS,
    },
  });
}

export function stopPriceAlertEvaluator(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  alertsBySymbol.clear();
}
