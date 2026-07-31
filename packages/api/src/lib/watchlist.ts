import type { Db } from "@moneyroad-app/db";
import { userWatchlist } from "@moneyroad-app/db/schema";

export const WATCHLIST_NEWS_TYPE = "news" as const;

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type WatchlistWriter = Db | DbTransaction;

export async function insertNewsWatchlist(
  writer: WatchlistWriter,
  userId: string,
  stockCodes: string[]
): Promise<void> {
  if (stockCodes.length === 0) {
    return;
  }

  await writer
    .insert(userWatchlist)
    .values(
      stockCodes.map((stockCode) => ({
        userId,
        stockCode,
        type: WATCHLIST_NEWS_TYPE,
      }))
    )
    .onConflictDoNothing();
}
