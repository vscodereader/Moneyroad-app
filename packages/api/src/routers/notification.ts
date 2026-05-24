import { db } from "@moneyroad-app/db";
import { userNotificationSetting } from "@moneyroad-app/db/schema";
import { eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure } from "../index";

// Normalized boolean shape returned to clients (no userId/updatedAt).
interface NotificationSettings {
  breakingNews: boolean;
  buySignal: boolean;
  holdSignal: boolean;
  marketSummary: boolean;
  priceAlert: boolean;
  sellSignal: boolean;
}

const DEFAULTS: NotificationSettings = {
  buySignal: true,
  sellSignal: true,
  holdSignal: false,
  priceAlert: true,
  breakingNews: true,
  marketSummary: false,
};

const updateSchema = z
  .object({
    buySignal: z.boolean(),
    sellSignal: z.boolean(),
    holdSignal: z.boolean(),
    priceAlert: z.boolean(),
    breakingNews: z.boolean(),
    marketSummary: z.boolean(),
  })
  .partial();

function normalize(
  row: typeof userNotificationSetting.$inferSelect
): NotificationSettings {
  return {
    buySignal: row.buySignal,
    sellSignal: row.sellSignal,
    holdSignal: row.holdSignal,
    priceAlert: row.priceAlert,
    breakingNews: row.breakingNews,
    marketSummary: row.marketSummary,
  };
}

export const notificationRouter = {
  // Current user's settings; returns defaults when no row exists yet.
  getSettings: protectedProcedure.handler(
    async ({ context }): Promise<NotificationSettings> => {
      const userId = context.session.user.id;
      const [row] = await db
        .select()
        .from(userNotificationSetting)
        .where(eq(userNotificationSetting.userId, userId))
        .limit(1);
      return row ? normalize(row) : DEFAULTS;
    }
  ),

  // Upsert a partial change for the current user; returns the full settings.
  updateSettings: protectedProcedure
    .input(updateSchema)
    .handler(async ({ context, input }): Promise<NotificationSettings> => {
      const userId = context.session.user.id;
      const [row] = await db
        .insert(userNotificationSetting)
        .values({ userId, ...input })
        .onConflictDoUpdate({
          target: userNotificationSetting.userId,
          set: { ...input, updatedAt: new Date() },
        })
        .returning();
      return row ? normalize(row) : { ...DEFAULTS, ...input };
    }),
};
