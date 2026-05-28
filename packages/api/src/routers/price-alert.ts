import { db } from "@moneyroad-app/db";
import { stockMaster, userPriceAlert } from "@moneyroad-app/db/schema";
import { and, desc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure } from "../index";

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
      return { id: row.id };
    }),

  setActive: protectedProcedure
    .input(z.object({ id: z.number().int(), active: z.boolean() }))
    .handler(async ({ context, input }) => {
      await db
        .update(userPriceAlert)
        .set({ active: input.active })
        .where(
          and(
            eq(userPriceAlert.id, input.id),
            eq(userPriceAlert.userId, context.session.user.id)
          )
        );
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
      return { ok: true };
    }),
};
