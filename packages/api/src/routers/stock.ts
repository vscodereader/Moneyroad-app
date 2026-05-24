import { db } from "@moneyroad-app/db";
import { stockMaster } from "@moneyroad-app/db/schema";
import { ilike, or } from "drizzle-orm";
import z from "zod";

import { publicProcedure } from "../index";

export const stockRouter = {
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
