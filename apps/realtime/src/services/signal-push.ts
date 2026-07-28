import {
  stockMaster,
  userNotificationSetting,
  userWatchlist,
} from "@moneyroad-app/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { log } from "evlog";

import { getDb } from "./news/db";
import { sendPushToUser } from "./news/expo-push";

/**
 * 관리자가 작성한 시그널. 자동생성 엔진은 아직 없어서(docs/realtime/plan.md
 * §시그널 엔진 — "엔진(생성기)만 남았다") 지금은 이 경로가 유일하다.
 */
export interface SignalPushInput {
  action: "buy" | "sell" | "hold";
  signalId: string;
  stockCode: string;
  title: string;
}

// 액션별 (알림설정 컬럼, 알림 타입, 화면 문구).
// 관망(hold)이 빠진 이유: notification_type enum 에 hold_signal 이 없어
// notification_history 에 기록 자체가 불가능하다. 넣으려면 DB 마이그레이션이
// 필요해 이번 범위에서 뺐다(RFC 0007 §4-4, D1). 팀장님 지침도
// buy_signal/sell_signal 만 명시했고 설정 기본값도 관망만 false 다.
const ACTION_META = {
  buy: { type: "buy_signal", label: "매수" },
  sell: { type: "sell_signal", label: "매도" },
} as const;

type PushableAction = keyof typeof ACTION_META;

function isPushable(
  action: SignalPushInput["action"]
): action is PushableAction {
  return action in ACTION_META;
}

/**
 * 시그널이 등록된 직후 호출된다. 뉴스 속보 경로(news/push.ts)를 그대로 옮겼고
 * 설정 컬럼만 액션별로 바뀐다 — 팀장님 지침 "뉴스 속보 경로 재사용"
 * (docs/realtime/plan.md:22).
 *
 * 대상은 그 종목을 관심종목에 넣고 해당 알림을 켜 둔 사용자다. 발송 실패는
 * 삼켜서 시그널 생성을 실패시키지 않는다.
 */
export async function notifySignal(input: SignalPushInput): Promise<void> {
  if (!isPushable(input.action)) {
    return;
  }
  const meta = ACTION_META[input.action];
  const db = getDb();

  // user_watchlist.type 은 enum('signal','news') 이지만 앱은 'news' 만 쓴다
  // (watchlist.ts 의 WATCH_TYPE 이 고정). 시그널 알림이라고 'signal' 을 보면
  // 대상이 0명이 된다 — 직관과 어긋나는 지점이라 남겨 둔다.
  const watchers = await db
    .select({ userId: userWatchlist.userId })
    .from(userWatchlist)
    .where(
      and(
        eq(userWatchlist.stockCode, input.stockCode),
        eq(userWatchlist.type, "news")
      )
    );

  const candidateUserIds = [...new Set(watchers.map((w) => w.userId))];
  if (candidateUserIds.length === 0) {
    return;
  }

  const settings = await db
    .select({
      userId: userNotificationSetting.userId,
      buySignal: userNotificationSetting.buySignal,
      sellSignal: userNotificationSetting.sellSignal,
    })
    .from(userNotificationSetting)
    .where(inArray(userNotificationSetting.userId, candidateUserIds));

  const settingsMap = new Map(settings.map((s) => [s.userId, s]));

  const enabledUserIds = candidateUserIds.filter((uid) => {
    const s = settingsMap.get(uid);
    if (!s) {
      return true; // 설정 행이 없으면 ON — 컬럼 기본값이 true 라 속보와 동일
    }
    return input.action === "buy" ? s.buySignal : s.sellSignal;
  });

  if (enabledUserIds.length === 0) {
    return;
  }

  const [stock] = await db
    .select({ name: stockMaster.htsKorIsnm })
    .from(stockMaster)
    .where(eq(stockMaster.mkscShrnIscd, input.stockCode))
    .limit(1);

  const stockName = stock?.name ?? input.stockCode;
  const title = `${stockName} ${meta.label} 시그널`;

  await Promise.allSettled(
    enabledUserIds.map((uid) =>
      sendPushToUser(uid, title, input.title, {
        type: meta.type,
        signalId: input.signalId,
        stockCode: input.stockCode,
      }).catch((err) => {
        log.error({
          err,
          signal: {
            event: "push_failed",
            userId: uid,
            signalId: input.signalId,
          },
        });
      })
    )
  );

  log.info({
    signal: {
      event: "push_sent",
      signalId: input.signalId,
      stockCode: input.stockCode,
      action: input.action,
      sentCount: enabledUserIds.length,
    },
  });
}
