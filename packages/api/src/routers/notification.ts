import { db } from "@moneyroad-app/db";
import {
  notificationHistory,
  userNotificationSetting,
  userPushToken,
} from "@moneyroad-app/db/schema";
import { and, count, desc, eq, lt } from "drizzle-orm";
import z from "zod";

import { protectedProcedure } from "../index";

const HISTORY_DEFAULT_LIMIT = 20;
const HISTORY_MAX_LIMIT = 50;

// Screen-facing inbox item (mirrors apps/native alerts screen).
export interface HistoryItem {
  body: string;
  createdAt: string;
  id: string;
  read: boolean;
  title: string;
  type: (typeof notificationHistory.$inferSelect)["type"];
}

// Normalized boolean shape returned to clients (no userId/updatedAt).
export interface NotificationSettings {
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

  // Count of the current user's delivered-but-unread notifications.
  unreadCount: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    const [row] = await db
      .select({ n: count() })
      .from(notificationHistory)
      .where(
        and(
          eq(notificationHistory.userId, userId),
          eq(notificationHistory.read, false),
          eq(notificationHistory.deliveryStatus, "sent")
        )
      );
    return row?.n ?? 0;
  }),

  // Current user's delivered notifications, newest first (keyset paginated).
  history: protectedProcedure
    .input(
      z.object({
        // Keyset cursor: createdAt (ISO) of the last item from the prev page.
        cursor: z.string().optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(HISTORY_MAX_LIMIT)
          .default(HISTORY_DEFAULT_LIMIT),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const filters = [
        eq(notificationHistory.userId, userId),
        eq(notificationHistory.deliveryStatus, "sent"),
      ];
      if (input.cursor) {
        const cursorDate = new Date(input.cursor);
        if (!Number.isNaN(cursorDate.getTime())) {
          filters.push(lt(notificationHistory.createdAt, cursorDate));
        }
      }
      const rows = await db
        .select({
          id: notificationHistory.id,
          type: notificationHistory.type,
          title: notificationHistory.title,
          body: notificationHistory.body,
          read: notificationHistory.read,
          createdAt: notificationHistory.createdAt,
        })
        .from(notificationHistory)
        .where(and(...filters))
        .orderBy(desc(notificationHistory.createdAt))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const items: HistoryItem[] = page.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        read: r.read,
        createdAt: r.createdAt.toISOString(),
      }));
      const last = page.at(-1);
      const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;
      return { items, nextCursor };
    }),

  // Marks a single notification read (no-op if it isn't the user's).
  markRead: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await db
        .update(notificationHistory)
        .set({ read: true })
        .where(
          and(
            eq(notificationHistory.id, input.id),
            eq(notificationHistory.userId, userId)
          )
        );
      return { ok: true };
    }),

  // Marks all of the current user's unread notifications read.
  markAllRead: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;
    await db
      .update(notificationHistory)
      .set({ read: true })
      .where(
        and(
          eq(notificationHistory.userId, userId),
          eq(notificationHistory.read, false)
        )
      );
    return { ok: true };
  }),

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

  // Registers an Expo push token for the current user (idempotent).
  registerPushToken: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await db
        .insert(userPushToken)
        .values({ userId, token: input.token })
        .onConflictDoUpdate({
          target: [userPushToken.userId, userPushToken.token],
          set: { updatedAt: new Date() },
        });
      return { ok: true };
    }),

  // Removes a push token (e.g. on logout) for the current user.
  unregisterPushToken: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      await db
        .delete(userPushToken)
        .where(
          and(
            eq(userPushToken.userId, userId),
            eq(userPushToken.token, input.token)
          )
        );
      return { ok: true };
    }),
};
