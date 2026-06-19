import { db } from "@moneyroad-app/db";
import { stockMaster, userPriceAlert } from "@moneyroad-app/db/schema";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure } from "../index";
import { refreshRealtimePins } from "../lib/realtime-trigger";

const directionSchema = z.enum(["above", "below"]);

export const priceAlertRouter = {
  // The signed-in user's price alerts, newest first.
  list: protectedProcedure.handler(async ({ context }) => {
    const rows = await db
      .select({
        id: userPriceAlert.id,
        stockCode: userPriceAlert.stockCode,
        stockName: stockMaster.htsKorIsnm,
        direction: userPriceAlert.direction,
        targetPrice: userPriceAlert.targetPrice,
        active: userPriceAlert.active,
        triggeredAt: userPriceAlert.triggeredAt,
        createdAt: userPriceAlert.createdAt,
      })
      .from(userPriceAlert)
      .leftJoin(
        stockMaster,
        eq(userPriceAlert.stockCode, stockMaster.mkscShrnIscd)
      )
      .where(eq(userPriceAlert.userId, context.session.user.id))
      .orderBy(desc(userPriceAlert.createdAt));

    return rows.map((r) => ({
      id: r.id,
      stockCode: r.stockCode,
      stockName: r.stockName,
      direction: r.direction,
      targetPrice: r.targetPrice,
      active: r.active,
      triggeredAt: r.triggeredAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        stockCode: z.string().min(1),
        direction: directionSchema,
        targetPrice: z.number().int().positive(),
      })
    )
    .handler(async ({ context, input }) => {
      const [row] = await db
        .insert(userPriceAlert)
        .values({
          userId: context.session.user.id,
          stockCode: input.stockCode,
          direction: input.direction,
          targetPrice: input.targetPrice,
        })
        .returning({ id: userPriceAlert.id });
      if (!row) {
        throw new Error("가격 알림 생성 실패");
      }
      // 새 알림 종목을 realtime에 즉시 핀 + 평가 인덱스 갱신.
      refreshRealtimePins("priceAlert.create");
      return { id: row.id };
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.number().int(), active: z.boolean() }))
    .handler(async ({ context, input }) => {
      await db
        .update(userPriceAlert)
        // 재활성 시 triggered_at을 비워 다시 울릴 수 있게 재무장한다.
        .set(
          input.active ? { active: true, triggeredAt: null } : { active: false }
        )
        .where(
          and(
            eq(userPriceAlert.id, input.id),
            eq(userPriceAlert.userId, context.session.user.id)
          )
        );
      refreshRealtimePins("priceAlert.setActive");
      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ context, input }) => {
      await db
        .delete(userPriceAlert)
        .where(
          and(
            eq(userPriceAlert.id, input.id),
            eq(userPriceAlert.userId, context.session.user.id)
          )
        );
      // 마지막 알림이 사라졌을 수 있으니 핀에서 promptly 제거되게 트리거.
      refreshRealtimePins("priceAlert.remove");
      return { ok: true };
    }),
};
