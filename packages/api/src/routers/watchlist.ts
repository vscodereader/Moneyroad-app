import { db } from "@moneyroad-app/db";
import { stockMaster, userWatchlist } from "@moneyroad-app/db/schema";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure } from "../index";
import { refreshRealtimePins } from "../lib/realtime-trigger";

// The app's watchlist powers news features (watch tab + breaking push), so
// entries are stored as type='news'. A signal-type watch is future work.
const WATCH_TYPE = "news" as const;

export const watchlistRouter = {
  // Current user's watchlist, newest first, joined with the stock name/market.
  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const rows = await db
      .select({
        code: userWatchlist.stockCode,
        name: stockMaster.htsKorIsnm,
        market: stockMaster.marketType,
        createdAt: userWatchlist.createdAt,
      })
      .from(userWatchlist)
      .innerJoin(
        stockMaster,
        eq(userWatchlist.stockCode, stockMaster.mkscShrnIscd)
      )
      .where(
        and(
          eq(userWatchlist.userId, userId),
          eq(userWatchlist.type, WATCH_TYPE)
        )
      )
      .orderBy(desc(userWatchlist.createdAt));
    return rows.map((r) => ({
      code: r.code,
      name: r.name,
      market: r.market,
      createdAt: r.createdAt.toISOString(),
    }));
  }),

  add: protectedProcedure
    .input(z.object({ stockCode: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await db
        .insert(userWatchlist)
        .values({ userId, stockCode: input.stockCode, type: WATCH_TYPE })
        .onConflictDoNothing();
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
            eq(userWatchlist.type, WATCH_TYPE)
          )
        );
      // Possibly the last watcher → let realtime unpin promptly.
      refreshRealtimePins("watchlist.remove");
      return { ok: true };
    }),
};
