import { db } from "@moneyroad-app/db";
import {
  stockMaster,
  stockResource,
  userWatchlist,
} from "@moneyroad-app/db/schema";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure } from "../index";
import { refreshRealtimePins } from "../lib/realtime-trigger";
import {
  buildStockResourceUrl,
  STOCK_ICON_RESOURCE_TYPE,
  STOCK_RESOURCE_READY_STATUS,
} from "../lib/stock-resource";
import { insertNewsWatchlist, WATCHLIST_NEWS_TYPE } from "../lib/watchlist";

export const watchlistRouter = {
  // Current user's watchlist, newest first, joined with the stock name/market.
  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const rows = await db
      .select({
        code: userWatchlist.stockCode,
        name: stockMaster.htsKorIsnm,
        market: stockMaster.marketType,
        iconStorageBucket: stockResource.storageBucket,
        iconStorageKey: stockResource.storageKey,
        createdAt: userWatchlist.createdAt,
      })
      .from(userWatchlist)
      .innerJoin(
        stockMaster,
        eq(userWatchlist.stockCode, stockMaster.mkscShrnIscd)
      )
      .leftJoin(
        stockResource,
        and(
          eq(stockResource.stockCode, userWatchlist.stockCode),
          eq(stockResource.resourceType, STOCK_ICON_RESOURCE_TYPE),
          eq(stockResource.status, STOCK_RESOURCE_READY_STATUS)
        )
      )
      .where(
        and(
          eq(userWatchlist.userId, userId),
          eq(userWatchlist.type, WATCHLIST_NEWS_TYPE)
        )
      )
      .orderBy(desc(userWatchlist.createdAt));
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      market: r.market,
      iconUrl: buildStockResourceUrl({
        storageBucket: r.iconStorageBucket,
        storageKey: r.iconStorageKey,
      }),
      createdAt: r.createdAt.toISOString(),
    }));
  }),

  add: protectedProcedure
    .input(z.object({ stockCode: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await insertNewsWatchlist(db, userId, [input.stockCode]);
      // Newly watched stock → pin it on realtime now so quotes stream at once.
      refreshRealtimePins("watchlist.add");
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ stockCode: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await db
        .delete(userWatchlist)
        .where(
          and(
            eq(userWatchlist.userId, userId),
            eq(userWatchlist.stockCode, input.stockCode),
            eq(userWatchlist.type, WATCHLIST_NEWS_TYPE)
          )
        );
      // Possibly the last watcher → let realtime unpin promptly.
      refreshRealtimePins("watchlist.remove");
      return { ok: true };
    }),
};
