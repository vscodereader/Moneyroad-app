import { db } from "@moneyroad-app/db";
import { stockMaster, stockResource } from "@moneyroad-app/db/schema";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import z from "zod";

import { publicProcedure } from "../index";
import {
  buildStockResourceUrl,
  STOCK_ICON_RESOURCE_TYPE,
  STOCK_RESOURCE_READY_STATUS,
} from "../lib/stock-resource";

// ----(추가: 노출 종목 필터 — 증권그룹구분코드 ST(주권)·EF(ETF)만 보인다.
//  EN(ETN)·RT(리츠)·BC(수익증권)·MF/IF(펀드)·SW/SR(신주인수권) 등은 제외)----
const VISIBLE_SECURITY_GROUPS = ["ST", "EF"];
// ----(추가 끝)----

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
          // ----(추가: 검색 결과에도 종목 아이콘 — ready 리소스 조인(detail과 동일))----
          iconStorageBucket: stockResource.storageBucket,
          iconStorageKey: stockResource.storageKey,
          // ----(추가 끝)----
        })
        .from(stockMaster)
        // ----(추가: 종목 아이콘 리소스 조인)----
        .leftJoin(
          stockResource,
          and(
            eq(stockResource.stockCode, stockMaster.mkscShrnIscd),
            eq(stockResource.resourceType, STOCK_ICON_RESOURCE_TYPE),
            eq(stockResource.status, STOCK_RESOURCE_READY_STATUS)
          )
        )
        // ----(추가 끝)----
        .where(
          and(
            // ----(추가: ST·EF만 검색 결과에 노출)----
            inArray(stockMaster.scrtGrpClsCode, VISIBLE_SECURITY_GROUPS),
            // ----(추가 끝)----
            or(
              ilike(stockMaster.htsKorIsnm, `%${q}%`),
              ilike(stockMaster.mkscShrnIscd, `${q}%`)
            )
          )
        )
        .orderBy(stockMaster.htsKorIsnm)
        .limit(input.limit);
      // ----(추가: storageBucket/Key → 공개 아이콘 URL 매핑)----
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        market: r.market,
        iconUrl: buildStockResourceUrl({
          storageBucket: r.iconStorageBucket,
          storageKey: r.iconStorageKey,
        }),
      }));
      // ----(추가 끝)----
    }),
};
