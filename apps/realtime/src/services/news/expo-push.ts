import { notificationHistory, userPushToken } from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { and, eq, gt, inArray } from "drizzle-orm";
import { log } from "evlog";
import Expo, {
  type ExpoPushMessage,
  type ExpoPushTicket,
} from "expo-server-sdk";

import { getDb } from "./db";

const COOLDOWN_WINDOW_MS = 5 * 60 * 1000;

const expo = new Expo();

type NotificationType = typeof notificationHistory.$inferInsert.type;

/**
 * Finalizes notification_history from the send tickets. A single "ok" ticket
 * marks the row sent (its id is kept for later receipt lookups); otherwise the
 * row is marked failed with the best available reason.
 */
async function updateHistoryFromTickets(
  historyId: string,
  tickets: ExpoPushTicket[],
  sendError: unknown
): Promise<void> {
  const db = getDb();
  const okTicket = tickets.find(
    (t): t is Extract<ExpoPushTicket, { status: "ok" }> => t.status === "ok"
  );

  if (okTicket) {
    await db
      .update(notificationHistory)
      .set({ deliveryStatus: "sent", ticketId: okTicket.id })
      .where(eq(notificationHistory.id, historyId));
    return;
  }

  const errorTicket = tickets.find(
    (t): t is Extract<ExpoPushTicket, { status: "error" }> =>
      t.status === "error"
  );
  const reason =
    sendError instanceof Error
      ? sendError.message
      : (errorTicket?.message ?? "no ticket returned");

  await db
    .update(notificationHistory)
    .set({ deliveryStatus: "failed", failedReason: reason })
    .where(eq(notificationHistory.id, historyId));
}

/**
 * Notification fatigue guard: skip when the same (user, type) already had
 * `NOTIFICATION_COOLDOWN_5M_MAX` successful sends in the last 5 minutes.
 */
async function isCooldownExceeded(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  const cooldownSince = new Date(Date.now() - COOLDOWN_WINDOW_MS);
  const recent = await getDb()
    .select({ id: notificationHistory.id })
    .from(notificationHistory)
    .where(
      and(
        eq(notificationHistory.userId, userId),
        eq(notificationHistory.type, type),
        eq(notificationHistory.deliveryStatus, "sent"),
        gt(notificationHistory.createdAt, cooldownSince)
      )
    )
    .limit(env.NOTIFICATION_COOLDOWN_5M_MAX);
  return recent.length >= env.NOTIFICATION_COOLDOWN_5M_MAX;
}

/**
 * Sends a push to all of a user's registered devices, recording the attempt in
 * notification_history and pruning tokens Expo reports as unregistered.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const type = (data?.type as NotificationType) ?? "buy_signal";

  if (await isCooldownExceeded(userId, type)) {
    log.info({
      news: { event: "push_cooldown", userId, type },
    });
    return;
  }

  const tokens = await db
    .select({ token: userPushToken.token })
    .from(userPushToken)
    .where(eq(userPushToken.userId, userId));

  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.token));
  const recipientCount = validTokens.length;

  const [history] = await db
    .insert(notificationHistory)
    .values({
      userId,
      type,
      title,
      body,
      data,
      deliveryStatus: "pending",
      recipientCount,
    })
    .returning({ id: notificationHistory.id });

  const historyId = history?.id;

  if (validTokens.length === 0) {
    if (historyId) {
      await db
        .update(notificationHistory)
        .set({
          deliveryStatus: "no_recipients",
          failedReason: "no valid push tokens",
        })
        .where(eq(notificationHistory.id, historyId));
    }
    return;
  }

  const messages: ExpoPushMessage[] = validTokens.map((t) => ({
    to: t.token,
    sound: "default" as const,
    title,
    body,
    data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];
  let sendError: unknown;

  for (const chunk of chunks) {
    try {
      const result = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...result);
    } catch (err) {
      sendError = err;
      log.error({ err, news: { event: "push_send_failed", userId, type } });
    }
  }

  if (historyId) {
    await updateHistoryFromTickets(historyId, tickets, sendError);
  }

  // Prune tokens Expo flagged as no longer registered on a device.
  const invalidTokens: string[] = [];
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const msg = messages[i];
    if (
      ticket &&
      msg &&
      ticket.status === "error" &&
      "details" in ticket &&
      ticket.details?.error === "DeviceNotRegistered"
    ) {
      invalidTokens.push(msg.to as string);
    }
  }

  if (invalidTokens.length > 0) {
    await db
      .delete(userPushToken)
      .where(inArray(userPushToken.token, invalidTokens));
    log.info({
      news: {
        event: "push_token_pruned",
        userId,
        count: invalidTokens.length,
      },
    });
  }
}
