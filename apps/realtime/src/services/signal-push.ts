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

/* ----(액션별 알림 메타 — 매수·매도·관망)---- */
// 팀장님 문서가 "액션(매수/매도/관망)은 알림 설정(buySignal/sellSignal/
// holdSignal)과 일치한다"고 정의하므로 3종 모두 발송한다
// (docs/native/api/signals.md). 관망은 notification_type enum 에 hold_signal
// 이 없어 한동안 빠져 있었다 — 마이그레이션 0013 으로 추가했다(RFC 0007 D1).
//
// defaultOn: 설정 행이 아직 없는 사용자에게 보낼지. user_notification_setting
// 의 컬럼 기본값과 맞춘 값이다 — 매수/매도는 true, 관망만 false. 관망까지
// true 로 두면 토글을 켠 적 없는 사용자에게 관망 알림이 가 버린다.
const ACTION_META = {
  buy: {
    column: "buySignal",
    defaultOn: true,
    type: "buy_signal",
    label: "매수",
  },
  sell: {
    column: "sellSignal",
    defaultOn: true,
    type: "sell_signal",
    label: "매도",
  },
  hold: {
    column: "holdSignal",
    defaultOn: false,
    type: "hold_signal",
    label: "관망",
  },
} as const;
/* ----(~액션별 알림 메타 여기까지)---- */

/**
 * 시그널이 등록된 직후 호출된다. 뉴스 속보 경로(news/push.ts)를 그대로 옮겼고
 * 설정 컬럼만 액션별로 바뀐다 — 팀장님 지침 "뉴스 속보 경로 재사용"
 * (docs/realtime/plan.md:22).
 *
 * 대상은 그 종목을 관심종목에 넣고 해당 알림을 켜 둔 사용자다. 발송 실패는
 * 삼켜서 시그널 생성을 실패시키지 않는다.
 */
export async function notifySignal(input: SignalPushInput): Promise<void> {
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
      /* ----(관망 설정 조회)---- */
      holdSignal: userNotificationSetting.holdSignal,
      /* ----(~관망 설정 조회 여기까지)---- */
    })
    .from(userNotificationSetting)
    .where(inArray(userNotificationSetting.userId, candidateUserIds));

  const settingsMap = new Map(settings.map((s) => [s.userId, s]));

  const enabledUserIds = candidateUserIds.filter((uid) => {
    const s = settingsMap.get(uid);
    /* ----(설정 행이 없을 때 — 액션별로 다르다)---- */
    // 매수/매도는 컬럼 기본값이 true 라 보내고(속보와 동일), 관망은 false 라
    // 보내지 않는다. 여기서 일괄 true 로 두면 관망을 켠 적 없는 사용자에게
    // 관망 알림이 간다.
    if (!s) {
      return meta.defaultOn;
    }
    return s[meta.column];
    /* ----(~설정 행이 없을 때 여기까지)---- */
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
