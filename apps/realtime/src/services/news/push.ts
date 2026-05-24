import {
  stockMaster,
  userNotificationSetting,
  userWatchlist,
} from "@moneyroad-app/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { log } from "evlog";

import { getDb } from "./db";
import { sendPushToUser } from "./expo-push";

interface BreakingNewsInput {
  description: string;
  id: string;
  stockCode: string | null;
  title: string;
}

/**
 * Breaking-news keywords. The news schema has no priority/importance column, so
 * we judge "breaking" heuristically from the title/body. False positives are
 * bounded by the per-user push cooldown.
 */
const BREAKING_KEYWORDS = [
  "속보",
  "긴급",
  "폭락",
  "폭등",
  "급락",
  "급등",
  "상한가",
  "하한가",
];

export function isBreakingNews(item: {
  title: string;
  description: string;
}): boolean {
  const text = `${item.title} ${item.description}`;
  return BREAKING_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Called right after a breaking news item is stored.
 * - Only items linked to a stock are targeted (untagged news has no audience).
 * - Sends to user_watchlist(type='news') subscribers whose breakingNews setting
 *   is ON (no setting row is treated as ON by default).
 *
 * @param opts.forced skips the keyword gate (e.g. admin manual publish).
 */
export async function notifyBreakingNews(
  newsItem: BreakingNewsInput,
  opts: { forced?: boolean } = {}
): Promise<void> {
  if (!newsItem.stockCode) {
    return;
  }
  if (!(opts.forced || isBreakingNews(newsItem))) {
    return;
  }

  const db = getDb();

  const watchers = await db
    .select({ userId: userWatchlist.userId })
    .from(userWatchlist)
    .where(
      and(
        eq(userWatchlist.stockCode, newsItem.stockCode),
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
      breakingNews: userNotificationSetting.breakingNews,
    })
    .from(userNotificationSetting)
    .where(inArray(userNotificationSetting.userId, candidateUserIds));

  const settingsMap = new Map(settings.map((s) => [s.userId, s]));

  const enabledUserIds = candidateUserIds.filter((uid) => {
    const s = settingsMap.get(uid);
    return s ? s.breakingNews : true; // default ON
  });

  if (enabledUserIds.length === 0) {
    return;
  }

  const [stock] = await db
    .select({ name: stockMaster.htsKorIsnm })
    .from(stockMaster)
    .where(eq(stockMaster.mkscShrnIscd, newsItem.stockCode))
    .limit(1);

  const stockName = stock?.name ?? newsItem.stockCode;
  const title = `${stockName} 속보`;
  const body = newsItem.title;

  await Promise.allSettled(
    enabledUserIds.map((uid) =>
      sendPushToUser(uid, title, body, {
        type: "breaking_news",
        newsId: newsItem.id,
        stockCode: newsItem.stockCode,
      }).catch((err) => {
        log.error({
          err,
          news: {
            event: "breaking_push_failed",
            userId: uid,
            newsId: newsItem.id,
          },
        });
      })
    )
  );

  log.info({
    news: {
      event: "breaking_push_sent",
      newsId: newsItem.id,
      stockCode: newsItem.stockCode,
      sentCount: enabledUserIds.length,
    },
  });
}
