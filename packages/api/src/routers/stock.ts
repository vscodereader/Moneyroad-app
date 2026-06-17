import { db } from "@moneyroad-app/db";
import { stockMaster, stockResource } from "@moneyroad-app/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";
import z from "zod";

import { publicProcedure } from "../index";
import {
  buildStockResourceUrl,
  STOCK_ICON_RESOURCE_TYPE,
  STOCK_RESOURCE_READY_STATUS,
} from "../lib/stock-resource";

export const stockRouter = {
  detail: publicProcedure
    .input(z.object({ code: z.string().min(1) }))
    .handler(async ({ input }) => {
      const rows = await db
        .select({
          code: stockMaster.mkscShrnIscd,
          name: stockMaster.htsKorIsnm,
          market: stockMaster.marketType,
          iconStorageBucket: stockResource.storageBucket,
          iconStorageKey: stockResource.storageKey,
        })
        .from(stockMaster)
        .leftJoin(
          stockResource,
          and(
            eq(stockResource.stockCode, stockMaster.mkscShrnIscd),
            eq(stockResource.resourceType, STOCK_ICON_RESOURCE_TYPE),
            eq(stockResource.status, STOCK_RESOURCE_READY_STATUS)
          )
        )
        .where(eq(stockMaster.mkscShrnIscd, input.code))
        .limit(1);
      const stock = rows[0];

      if (!stock) {
        return null;
      }

      return {
        code: stock.code,
        name: stock.name,
        market: stock.market,
        iconUrl: buildStockResourceUrl({
          storageBucket: stock.iconStorageBucket,
          storageKey: stock.iconStorageKey,
        }),
      };
    }),

  // Search stock_master by Korean name (contains) or short code (prefix).
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(30).default(20),
      })
    )
    .handler(async ({ input }) => {
      const q = input.query.trim();
      if (!q) {
        return [];
      }
      const rows = await db
        .select({
          code: stockMaster.mkscShrnIscd,
          name: stockMaster.htsKorIsnm,
          market: stockMaster.marketType,
        })
        .from(stockMaster)
        .where(
          or(
            ilike(stockMaster.htsKorIsnm, `%${q}%`),
            ilike(stockMaster.mkscShrnIscd, `${q}%`)
          )
        )
        .orderBy(stockMaster.htsKorIsnm)
        .limit(input.limit);
      return rows;
    }),
};
