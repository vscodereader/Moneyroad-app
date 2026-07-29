import { db } from "@moneyroad-app/db";
import {
  discussionFileAttachment,
  discussionMessage,
  discussionMessageImage,
  discussionRoom,
  discussionRoomBlock,
  discussionRoomFavorite,
  discussionRoomLike,
  discussionRoomMember,
  moneyroadImage,
  stockMaster,
  user,
  userWatchlist,
} from "@moneyroad-app/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  type SQL,
  sql,
} from "drizzle-orm";
import z from "zod";

import { adminProcedure, protectedProcedure, publicProcedure } from "../index";
import { refreshRealtimeDiscussion } from "../lib/realtime-trigger";

// ── shared types & helpers ───────────────────────────────────────────

const tabSchema = z.enum(["hot", "watch", "recent", "favorite"]);
const sentimentSchema = z.enum(["up", "neutral", "down"]);

const MS = { min: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  if (diff < MS.min) {
    return "방금";
  }
  if (diff < MS.hour) {
    return `${Math.floor(diff / MS.min)}분 전`;
  }
  if (diff < MS.day) {
    return `${Math.floor(diff / MS.hour)}시간 전`;
  }
  return `${Math.floor(diff / MS.day)}일 전`;
}

// Correlated subquery snippets re-used in both list and detail queries.
function counts(roomIdRef: SQL<number>) {
  return {
    likesCount: sql<number>`(SELECT COUNT(*)::int FROM ${discussionRoomLike} WHERE ${discussionRoomLike.roomId} = ${roomIdRef})`,
    membersCount: sql<number>`(SELECT COUNT(*)::int FROM ${discussionRoomMember} WHERE ${discussionRoomMember.roomId} = ${roomIdRef})`,
    repliesCount: sql<number>`(SELECT COUNT(*)::int FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${roomIdRef} AND ${discussionMessage.deletedAt} IS NULL AND ${discussionMessage.blindedAt} IS NULL)`,
    // Raw sql subquery: pg returns a tz-naive string, not a Date. Decode it the
    // same way drizzle decodes a `timestamp` column (treat as UTC) so callers can
    // safely call `.toISOString()` / pass it to `relativeTime`.
    lastMessageAt:
      sql<Date | null>`(SELECT MAX(${discussionMessage.createdAt}) FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${roomIdRef})`.mapWith(
        (value) => (value == null ? null : new Date(`${value as string}+0000`))
      ),
  };
}

function likedExpr(userId: string | null): SQL<boolean> {
  if (!userId) {
    return sql<boolean>`false`;
  }
  return sql<boolean>`EXISTS (SELECT 1 FROM ${discussionRoomLike} WHERE ${discussionRoomLike.roomId} = ${discussionRoom.id} AND ${discussionRoomLike.userId} = ${userId})`;
}

function favoritedExpr(userId: string | null): SQL<boolean> {
  if (!userId) {
    return sql<boolean>`false`;
  }
  return sql<boolean>`EXISTS (SELECT 1 FROM ${discussionRoomFavorite} WHERE ${discussionRoomFavorite.roomId} = ${discussionRoom.id} AND ${discussionRoomFavorite.userId} = ${userId})`;
}

// Whether the user has an active (not-yet-expired) block on the current room.
function blockedExpr(userId: string | null): SQL<boolean> {
  if (!userId) {
    return sql<boolean>`false`;
  }
  return sql<boolean>`EXISTS (SELECT 1 FROM ${discussionRoomBlock} WHERE ${discussionRoomBlock.roomId} = ${discussionRoom.id} AND ${discussionRoomBlock.userId} = ${userId} AND ${discussionRoomBlock.blockedUntil} > now())`;
}

/**
 * Public room reads remain anonymous, but an authenticated user with an active
 * per-room block must not bypass the app UI by calling message RPCs directly.
 */
async function assertRoomReadable(
  userId: string | null,
  roomId: number
): Promise<void> {
  if (!userId) {
    return;
  }
  const [blocked] = await db
    .select({ userId: discussionRoomBlock.userId })
    .from(discussionRoomBlock)
    .where(
      and(
        eq(discussionRoomBlock.userId, userId),
        eq(discussionRoomBlock.roomId, roomId),
        sql`${discussionRoomBlock.blockedUntil} > now()`
      )
    )
    .limit(1);
  if (blocked) {
    throw new ORPCError("FORBIDDEN", { message: "차단된 방입니다." });
  }
}

// Duration caps (docs/rfcs/0004 기능4). value+unit are collapsed to hours here.
const MUTE_MAX_HOURS = 24; // 1일
const BLOCK_MAX_HOURS = 168; // 7일
const HOURS_PER_DAY = 24;

function toHours(value: number, unit: "hour" | "day"): number {
  return value * (unit === "day" ? HOURS_PER_DAY : 1);
}

// ── domain functions (transport-agnostic, see docs/adr/0001 #4) ──────

// Max images per image message (docs/rfcs/0004 기능5).
const MAX_MESSAGE_IMAGES = 8;
const MAX_MESSAGE_IMAGE_BYTES = 10 * 1024 * 1024;

type MessageType = "text" | "image" | "file";

type DiscussionTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

async function getAvailableFileAttachment(
  tx: DiscussionTransaction,
  type: MessageType,
  fileAttachmentId: string | undefined,
  userId: string
) {
  if (type !== "file") {
    return;
  }
  const [fileAttachment] = await tx
    .select({
      id: discussionFileAttachment.id,
      bucket: discussionFileAttachment.bucket,
      objectKey: discussionFileAttachment.objectKey,
      mime: discussionFileAttachment.mime,
      byteSize: discussionFileAttachment.byteSize,
      fileName: discussionFileAttachment.fileName,
    })
    .from(discussionFileAttachment)
    .where(
      and(
        eq(discussionFileAttachment.id, fileAttachmentId ?? ""),
        eq(discussionFileAttachment.uploaderId, userId),
        isNull(discussionFileAttachment.messageId)
      )
    )
    .limit(1);
  return fileAttachment;
}

/**
 * Insert a message. First send into a room implicitly joins the user
 * (docs/adr/0002). Future ws handlers call this same function.
 *
 * Attachments (docs/rfcs/0004 기능5): pass `imageIds` (already uploaded via
 * POST /upload/discussion-image, must belong to the sender) for an image
 * message, or an opaque `fileAttachmentId` returned by the file upload route.
 * The message `type` is derived from what's attached.
 */
async function sendMessage(args: {
  roomId: number;
  userId: string;
  content: string;
  imageIds?: number[];
  fileAttachmentId?: string;
  /* ----(답글 부모 — RFC 0008)---- */
  parentId?: number;
  /* ----(~답글 부모 여기까지)---- */
}): Promise<{ id: number; createdAt: Date }> {
  const imageIds = args.imageIds ?? [];
  let type: MessageType = "text";
  if (args.fileAttachmentId) {
    type = "file";
  } else if (imageIds.length > 0) {
    type = "image";
  }

  if (imageIds.length > MAX_MESSAGE_IMAGES) {
    throw new ORPCError("BAD_REQUEST", {
      message: `이미지는 최대 ${MAX_MESSAGE_IMAGES}장까지 가능합니다.`,
    });
  }
  if (type === "text" && args.content.length === 0) {
    throw new ORPCError("BAD_REQUEST", { message: "빈 메시지입니다." });
  }

  const room = await db
    .select({ id: discussionRoom.id })
    .from(discussionRoom)
    .where(eq(discussionRoom.id, args.roomId))
    .limit(1);
  if (room.length === 0) {
    throw new ORPCError("NOT_FOUND", { message: "토론방이 없습니다." });
  }

  await assertRoomReadable(args.userId, args.roomId);
  // An active mute still permits reads but bars every message type.
  const [muted] = await db
    .select({ userId: discussionRoomMember.userId })
    .from(discussionRoomMember)
    .where(
      and(
        eq(discussionRoomMember.userId, args.userId),
        eq(discussionRoomMember.roomId, args.roomId),
        sql`${discussionRoomMember.mutedUntil} > now()`
      )
    )
    .limit(1);
  if (muted) {
    throw new ORPCError("FORBIDDEN", { message: "뮤트 상태입니다." });
  }

  // Images must reference the sender's own uploads. The original byte count is
  // used for RFC 0004's per-message 10MB limit; older rows fall back to the
  // stored output size because they predate originalByteSize.
  if (type === "image") {
    const owned = await db
      .select({
        id: moneyroadImage.id,
        byteSize: moneyroadImage.byteSize,
        originalByteSize: moneyroadImage.originalByteSize,
      })
      .from(moneyroadImage)
      .where(
        and(
          inArray(moneyroadImage.id, imageIds),
          eq(moneyroadImage.uploaderId, args.userId)
        )
      );
    if (owned.length !== imageIds.length) {
      throw new ORPCError("BAD_REQUEST", {
        message: "첨부한 이미지를 찾을 수 없습니다.",
      });
    }
    const totalBytes = owned.reduce(
      (sum, image) => sum + (image.originalByteSize ?? image.byteSize),
      0
    );
    if (totalBytes > MAX_MESSAGE_IMAGE_BYTES) {
      throw new ORPCError("BAD_REQUEST", {
        message: "이미지 원본 크기 합계는 10MB 이하여야 합니다.",
      });
    }
  }

  /* ----(답글 부모 검증 — RFC 0008)---- */
  // 부모는 같은 방의 살아 있는 메시지여야 한다. 다른 방 메시지를 부모로 넘기면
  // 인용이 방 경계를 넘어 새어 나가고, 삭제·가림된 메시지에 답글을 허용하면
  // 마스킹된 본문이 인용을 통해 되살아난다(RFC 0004 기능5와 같은 이유).
  if (args.parentId !== undefined) {
    const [parent] = await db
      .select({
        id: discussionMessage.id,
        roomId: discussionMessage.roomId,
        deletedAt: discussionMessage.deletedAt,
        blindedAt: discussionMessage.blindedAt,
      })
      .from(discussionMessage)
      .where(eq(discussionMessage.id, args.parentId))
      .limit(1);
    if (!parent || parent.roomId !== args.roomId) {
      throw new ORPCError("NOT_FOUND", {
        message: "답글 대상 메시지가 없습니다.",
      });
    }
    if (parent.deletedAt || parent.blindedAt) {
      throw new ORPCError("BAD_REQUEST", {
        message: "삭제되었거나 가려진 메시지에는 답글을 달 수 없습니다.",
      });
    }
  }
  /* ----(~답글 부모 검증 여기까지)---- */

  // Implicit join.
  await db
    .insert(discussionRoomMember)
    .values({ userId: args.userId, roomId: args.roomId })
    .onConflictDoNothing();

  const row = await db.transaction(async (tx) => {
    const fileAttachment = await getAvailableFileAttachment(
      tx,
      type,
      args.fileAttachmentId,
      args.userId
    );
    if (type === "file" && !fileAttachment) {
      throw new ORPCError("BAD_REQUEST", {
        message: "첨부한 파일을 찾을 수 없습니다.",
      });
    }

    const [inserted] = await tx
      .insert(discussionMessage)
      .values({
        roomId: args.roomId,
        userId: args.userId,
        content: args.content,
        type,
        fileBucket: fileAttachment?.bucket ?? null,
        fileKey: fileAttachment?.objectKey ?? null,
        fileMime: fileAttachment?.mime ?? null,
        fileSize: fileAttachment?.byteSize ?? null,
        fileName: fileAttachment?.fileName ?? null,
        /* ----(답글 부모 — RFC 0008)---- */
        parentId: args.parentId ?? null,
        /* ----(~답글 부모 여기까지)---- */
      })
      .returning({
        id: discussionMessage.id,
        createdAt: discussionMessage.createdAt,
      });

    if (!inserted) {
      throw new Error("메시지 저장 실패");
    }

    if (fileAttachment) {
      const [claimed] = await tx
        .update(discussionFileAttachment)
        .set({ messageId: inserted.id })
        .where(
          and(
            eq(discussionFileAttachment.id, fileAttachment.id),
            eq(discussionFileAttachment.uploaderId, args.userId),
            isNull(discussionFileAttachment.messageId)
          )
        )
        .returning({ id: discussionFileAttachment.id });
      if (!claimed) {
        // A concurrent request already used this upload. Throwing rolls back the
        // message insert, so one upload can never back multiple messages.
        throw new ORPCError("BAD_REQUEST", {
          message: "이미 사용된 파일입니다.",
        });
      }
    }

    if (type === "image") {
      await tx.insert(discussionMessageImage).values(
        imageIds.map((imageId, index) => ({
          messageId: inserted.id,
          imageId,
          sortOrder: index,
        }))
      );
    }
    return inserted;
  });

  return row;
}

/**
 * Soft-delete a message. Author or admin only.
 */
async function deleteMessage(args: {
  messageId: number;
  actorUserId: string;
  actorRole: string;
}): Promise<void> {
  const [row] = await db
    .select({
      id: discussionMessage.id,
      userId: discussionMessage.userId,
      deletedAt: discussionMessage.deletedAt,
    })
    .from(discussionMessage)
    .where(eq(discussionMessage.id, args.messageId))
    .limit(1);
  if (!row) {
    throw new ORPCError("NOT_FOUND", { message: "메시지가 없습니다." });
  }
  if (row.deletedAt) {
    return; // already deleted; idempotent
  }
  const isOwner = row.userId === args.actorUserId;
  const isAdmin = args.actorRole === "admin";
  if (!(isOwner || isAdmin)) {
    throw new ORPCError("FORBIDDEN", {
      message: "본인 메시지 또는 관리자만 삭제할 수 있습니다.",
    });
  }
  await db
    .update(discussionMessage)
    .set({ deletedAt: new Date() })
    .where(eq(discussionMessage.id, args.messageId));
}

/**
 * Admin bulk blind (가림). Masks the given messages for everyone; rows survive.
 * Scoped to the room and idempotent (skips already-blinded rows).
 */
async function hideMessages(args: {
  roomId: number;
  messageIds: number[];
  actorId: string;
  reason: string;
}): Promise<void> {
  if (args.messageIds.length === 0) {
    return;
  }
  await db
    .update(discussionMessage)
    .set({
      blindedAt: new Date(),
      blindedBy: args.actorId,
      blindReason: args.reason,
    })
    .where(
      and(
        inArray(discussionMessage.id, args.messageIds),
        eq(discussionMessage.roomId, args.roomId),
        isNull(discussionMessage.blindedAt)
      )
    );
}

/**
 * Admin bulk un-blind — clears the three blind fields. Scoped to the room.
 */
async function unhideMessages(args: {
  roomId: number;
  messageIds: number[];
}): Promise<void> {
  if (args.messageIds.length === 0) {
    return;
  }
  await db
    .update(discussionMessage)
    .set({ blindedAt: null, blindedBy: null, blindReason: null })
    .where(
      and(
        inArray(discussionMessage.id, args.messageIds),
        eq(discussionMessage.roomId, args.roomId)
      )
    );
}

/**
 * Admin bulk soft-delete. Mirrors deleteMessage but over a set; scoped to the
 * room and idempotent (skips already-deleted rows).
 */
async function deleteMessages(args: {
  roomId: number;
  messageIds: number[];
}): Promise<void> {
  if (args.messageIds.length === 0) {
    return;
  }
  await db
    .update(discussionMessage)
    .set({ deletedAt: new Date() })
    .where(
      and(
        inArray(discussionMessage.id, args.messageIds),
        eq(discussionMessage.roomId, args.roomId),
        isNull(discussionMessage.deletedAt)
      )
    );
}

/**
 * Toggle a per-user room like. Returns the new state.
 */
async function toggleLike(args: {
  roomId: number;
  userId: string;
}): Promise<{ liked: boolean; likesCount: number }> {
  const existing = await db
    .select({ userId: discussionRoomLike.userId })
    .from(discussionRoomLike)
    .where(
      and(
        eq(discussionRoomLike.userId, args.userId),
        eq(discussionRoomLike.roomId, args.roomId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(discussionRoomLike)
      .where(
        and(
          eq(discussionRoomLike.userId, args.userId),
          eq(discussionRoomLike.roomId, args.roomId)
        )
      );
  } else {
    await db
      .insert(discussionRoomLike)
      .values({ userId: args.userId, roomId: args.roomId })
      .onConflictDoNothing();
  }

  const [row] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(discussionRoomLike)
    .where(eq(discussionRoomLike.roomId, args.roomId));

  return { liked: existing.length === 0, likesCount: row?.count ?? 0 };
}

/**
 * Toggle a per-user room favorite (별). Returns the new state.
 */
async function toggleFavorite(args: {
  roomId: number;
  userId: string;
}): Promise<{ favorited: boolean }> {
  const existing = await db
    .select({ userId: discussionRoomFavorite.userId })
    .from(discussionRoomFavorite)
    .where(
      and(
        eq(discussionRoomFavorite.userId, args.userId),
        eq(discussionRoomFavorite.roomId, args.roomId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .delete(discussionRoomFavorite)
      .where(
        and(
          eq(discussionRoomFavorite.userId, args.userId),
          eq(discussionRoomFavorite.roomId, args.roomId)
        )
      );
  } else {
    await db
      .insert(discussionRoomFavorite)
      .values({ userId: args.userId, roomId: args.roomId })
      .onConflictDoNothing();
  }

  return { favorited: existing.length === 0 };
}

/**
 * Active room members for the admin moderation panel. Blocked users are stored
 * outside this table and are returned by blockedRoomMembers below.
 */
async function roomMembers(args: { roomId: number }): Promise<
  {
    userId: string;
    name: string;
    role: string;
    joinedAt: string;
    mutedUntil: string | null;
    blocked: boolean;
  }[]
> {
  const rows = await db
    .select({
      userId: discussionRoomMember.userId,
      name: user.name,
      role: user.role,
      joinedAt: discussionRoomMember.joinedAt,
      mutedUntil: discussionRoomMember.mutedUntil,
    })
    .from(discussionRoomMember)
    .innerJoin(user, eq(discussionRoomMember.userId, user.id))
    .where(eq(discussionRoomMember.roomId, args.roomId))
    .orderBy(desc(discussionRoomMember.joinedAt));

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    role: r.role,
    joinedAt: r.joinedAt.toISOString(),
    mutedUntil: r.mutedUntil?.toISOString() ?? null,
    blocked: false,
  }));
}

/**
 * Active blocks are sourced from discussion_room_block, because blocking
 * deliberately removes the corresponding member row.
 */
async function blockedRoomMembers(args: { roomId: number }): Promise<
  {
    userId: string;
    name: string;
    role: string;
    blockedAt: string;
    blockedUntil: string;
  }[]
> {
  const rows = await db
    .select({
      userId: discussionRoomBlock.userId,
      name: user.name,
      role: user.role,
      blockedAt: discussionRoomBlock.blockedAt,
      blockedUntil: discussionRoomBlock.blockedUntil,
    })
    .from(discussionRoomBlock)
    .innerJoin(user, eq(discussionRoomBlock.userId, user.id))
    .where(
      and(
        eq(discussionRoomBlock.roomId, args.roomId),
        sql`${discussionRoomBlock.blockedUntil} > now()`
      )
    )
    .orderBy(desc(discussionRoomBlock.blockedAt));

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    role: row.role,
    blockedAt: row.blockedAt.toISOString(),
    blockedUntil: row.blockedUntil.toISOString(),
  }));
}

/**
 * Guard shared by mute/block: an admin may not moderate themselves or a fellow
 * admin (docs/rfcs/0004 기능4).
 */
async function assertModeratable(args: {
  actorId: string;
  targetUserId: string;
}): Promise<void> {
  if (args.targetUserId === args.actorId) {
    throw new ORPCError("FORBIDDEN", {
      message: "자기 자신에게는 할 수 없습니다.",
    });
  }
  const [target] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, args.targetUserId))
    .limit(1);
  if (!target) {
    throw new ORPCError("NOT_FOUND", { message: "유저가 없습니다." });
  }
  if (target.role === "admin") {
    throw new ORPCError("FORBIDDEN", {
      message: "관리자는 대상이 될 수 없습니다.",
    });
  }
}

/**
 * Temporarily mute an existing member (뮤트) — total duration capped at 1 day.
 * A moderation action must never manufacture membership.
 */
async function muteMember(args: {
  roomId: number;
  userId: string;
  hours: number;
  actorId: string;
}): Promise<void> {
  if (args.hours > MUTE_MAX_HOURS) {
    throw new ORPCError("BAD_REQUEST", {
      message: "뮤트는 최대 1일까지 가능합니다.",
    });
  }
  await assertModeratable({ actorId: args.actorId, targetUserId: args.userId });

  const mutedUntil = new Date(Date.now() + args.hours * MS.hour);
  const [updated] = await db
    .update(discussionRoomMember)
    .set({ mutedUntil, mutedBy: args.actorId })
    .where(
      and(
        eq(discussionRoomMember.userId, args.userId),
        eq(discussionRoomMember.roomId, args.roomId)
      )
    )
    .returning({ userId: discussionRoomMember.userId });
  if (!updated) {
    throw new ORPCError("NOT_FOUND", { message: "방 멤버가 아닙니다." });
  }
}

/** Clear a member's mute. */
async function unmuteMember(args: {
  roomId: number;
  userId: string;
}): Promise<void> {
  const [updated] = await db
    .update(discussionRoomMember)
    .set({ mutedUntil: null, mutedBy: null })
    .where(
      and(
        eq(discussionRoomMember.userId, args.userId),
        eq(discussionRoomMember.roomId, args.roomId)
      )
    )
    .returning({ userId: discussionRoomMember.userId });
  if (!updated) {
    throw new ORPCError("NOT_FOUND", { message: "방 멤버가 아닙니다." });
  }
}

/**
 * Block a member (차단) — total duration capped at 7 days. Removes the member
 * row (like leaveRoom) and upserts a block row that gates re-entry.
 */
async function blockMember(args: {
  roomId: number;
  userId: string;
  hours: number;
  actorId: string;
}): Promise<void> {
  if (args.hours > BLOCK_MAX_HOURS) {
    throw new ORPCError("BAD_REQUEST", {
      message: "차단은 최대 7일까지 가능합니다.",
    });
  }
  await assertModeratable({ actorId: args.actorId, targetUserId: args.userId });

  const blockedUntil = new Date(Date.now() + args.hours * MS.hour);
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(discussionRoomMember)
      .where(
        and(
          eq(discussionRoomMember.userId, args.userId),
          eq(discussionRoomMember.roomId, args.roomId)
        )
      )
      .returning({ userId: discussionRoomMember.userId });
    if (!removed) {
      throw new ORPCError("NOT_FOUND", { message: "방 멤버가 아닙니다." });
    }

    await tx
      .insert(discussionRoomBlock)
      .values({
        userId: args.userId,
        roomId: args.roomId,
        blockedBy: args.actorId,
        blockedUntil,
      })
      .onConflictDoUpdate({
        target: [discussionRoomBlock.userId, discussionRoomBlock.roomId],
        set: { blockedBy: args.actorId, blockedUntil, blockedAt: new Date() },
      });
  });
}

/** Lift a member's block. */
async function unblockMember(args: {
  roomId: number;
  userId: string;
}): Promise<void> {
  const [removed] = await db
    .delete(discussionRoomBlock)
    .where(
      and(
        eq(discussionRoomBlock.userId, args.userId),
        eq(discussionRoomBlock.roomId, args.roomId)
      )
    )
    .returning({ userId: discussionRoomBlock.userId });
  if (!removed) {
    throw new ORPCError("NOT_FOUND", { message: "차단된 사용자가 아닙니다." });
  }
}

// ── router ───────────────────────────────────────────────────────────

/* ----(메시지 조회 공통부 — RFC 0008)---- */
// messages(양방향 커서)와 messagesAround(앵커 주변)가 같은 행 모양·같은 후처리를
// 쓰도록 한 곳에 모았다. 예전에는 messages 안에 인라인으로 있었는데, 앵커 조회가
// 생기면서 이미지 로딩·마스킹 규칙이 두 벌로 갈릴 위험이 생겼다.

const MESSAGE_COLUMNS = {
  id: discussionMessage.id,
  userId: discussionMessage.userId,
  userName: user.name,
  userImage: user.image,
  content: discussionMessage.content,
  type: discussionMessage.type,
  fileMime: discussionMessage.fileMime,
  fileSize: discussionMessage.fileSize,
  fileName: discussionMessage.fileName,
  createdAt: discussionMessage.createdAt,
  deletedAt: discussionMessage.deletedAt,
  blindedAt: discussionMessage.blindedAt,
  blindReason: discussionMessage.blindReason,
  parentId: discussionMessage.parentId,
} as const;

type RawMessageRow = {
  [K in keyof typeof MESSAGE_COLUMNS]: (typeof MESSAGE_COLUMNS)[K] extends {
    _: { data: infer D };
  }
    ? D
    : never;
};

/** 한 방의 메시지 행을 id 순으로 뽑는다. 방향·경계는 호출부가 정한다. */
function selectMessages(where: SQL, order: SQL, limit: number) {
  return db
    .select(MESSAGE_COLUMNS)
    .from(discussionMessage)
    .innerJoin(user, eq(discussionMessage.userId, user.id))
    .where(where)
    .orderBy(order)
    .limit(limit);
}

/** 인용에 실을 원문 스냅샷. 마스킹된 원문은 본문을 비워서 내보낸다. */
async function parentSnapshots(slice: RawMessageRow[]) {
  const parentIds = [
    ...new Set(
      slice
        .map((m) => m.parentId)
        .filter((id): id is number => typeof id === "number")
    ),
  ];
  const map = new Map<
    number,
    {
      id: number;
      userName: string;
      content: string | null;
      type: "text" | "image" | "file";
      fileName: string | null;
      masked: "deleted" | "blinded" | null;
    }
  >();
  if (parentIds.length === 0) {
    return map;
  }
  const rows = await db
    .select({
      id: discussionMessage.id,
      userName: user.name,
      content: discussionMessage.content,
      type: discussionMessage.type,
      fileName: discussionMessage.fileName,
      deletedAt: discussionMessage.deletedAt,
      blindedAt: discussionMessage.blindedAt,
    })
    .from(discussionMessage)
    .innerJoin(user, eq(discussionMessage.userId, user.id))
    .where(inArray(discussionMessage.id, parentIds));

  for (const r of rows) {
    // 삭제/가림된 원문의 본문은 응답에 싣지 않는다 — 인용을 통해 마스킹이
    // 우회되면 RFC 0004 기능5가 무의미해진다. 화면은 masked 값만 보고
    // "삭제된 글입니다"/"가려진 글입니다"를 그린다(RFC 0008 D7).
    let masked: "deleted" | "blinded" | null = null;
    if (r.deletedAt) {
      masked = "deleted";
    } else if (r.blindedAt) {
      masked = "blinded";
    }
    map.set(r.id, {
      id: r.id,
      userName: masked ? "" : r.userName,
      content: masked ? null : r.content,
      type: r.type,
      fileName: masked ? null : r.fileName,
      masked,
    });
  }
  return map;
}

/** 각 메시지에 달린 **직속** 답글 수 (RFC 0008 D4). 삭제된 답글은 세지 않는다. */
async function replyCounts(ids: number[]) {
  const map = new Map<number, number>();
  if (ids.length === 0) {
    return map;
  }
  const rows = await db
    .select({
      parentId: discussionMessage.parentId,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(discussionMessage)
    .where(
      and(
        inArray(discussionMessage.parentId, ids),
        isNull(discussionMessage.deletedAt)
      )
    )
    .groupBy(discussionMessage.parentId);
  for (const r of rows) {
    if (r.parentId !== null) {
      map.set(r.parentId, r.n);
    }
  }
  return map;
}

/** 이미지 메시지의 첨부를 sortOrder 순으로 일괄 로드. 마스킹된 건 제외. */
async function imagesFor(slice: RawMessageRow[]) {
  const imageMessageIds = slice
    .filter((m) => m.type === "image" && !(m.deletedAt || m.blindedAt))
    .map((m) => m.id);
  const imagesByMessage = new Map<
    number,
    { imageId: number; url: string; mime: string }[]
  >();
  if (imageMessageIds.length === 0) {
    return imagesByMessage;
  }
  const links = await db
    .select({
      messageId: discussionMessageImage.messageId,
      imageId: discussionMessageImage.imageId,
      // The client needs the real type to pick a file extension before saving
      // to the gallery — MediaStore rejects an asset it can't type (RFC 0005 §4-1).
      mime: moneyroadImage.mime,
    })
    .from(discussionMessageImage)
    .innerJoin(
      moneyroadImage,
      eq(discussionMessageImage.imageId, moneyroadImage.id)
    )
    .where(inArray(discussionMessageImage.messageId, imageMessageIds))
    .orderBy(
      discussionMessageImage.messageId,
      discussionMessageImage.sortOrder
    );
  for (const link of links) {
    const list = imagesByMessage.get(link.messageId) ?? [];
    list.push({
      imageId: link.imageId,
      url: `/media/discussion-image/${link.imageId}`,
      mime: link.mime,
    });
    imagesByMessage.set(link.messageId, list);
  }
  return imagesByMessage;
}

/* ----(내 글·답글 목록 공통부 — RFC 0008)---- */
// 목록 2행의 날짜. my_chat_collect.jpg 처럼 "2026.07.28" 까지만 쓴다(D5).
// 시각은 서버 created_at 을 그대로 KST 로 포매팅한다 — docs/adr/0001 #1.
const listDateFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatListDate(date: Date): string {
  const parts = listDateFmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

/**
 * "내 글"/"답글" 목록. 둘은 `parent_id` 조건만 다르다 — 글은 NULL, 답글은 NOT NULL.
 * 삭제한 내 메시지는 제외한다(기존 myReplies 와 동일).
 */
async function myMessages(args: {
  userId: string;
  limit: number;
  kind: "post" | "reply";
}) {
  const rows = await db
    .select({
      id: discussionMessage.id,
      roomId: discussionRoom.id,
      roomName: discussionRoom.name,
      stockCode: discussionRoom.stockCode,
      stockName: stockMaster.htsKorIsnm,
      content: discussionMessage.content,
      type: discussionMessage.type,
      fileName: discussionMessage.fileName,
      createdAt: discussionMessage.createdAt,
    })
    .from(discussionMessage)
    .innerJoin(discussionRoom, eq(discussionMessage.roomId, discussionRoom.id))
    .leftJoin(
      stockMaster,
      eq(discussionRoom.stockCode, stockMaster.mkscShrnIscd)
    )
    .where(
      and(
        eq(discussionMessage.userId, args.userId),
        isNull(discussionMessage.deletedAt),
        args.kind === "post"
          ? isNull(discussionMessage.parentId)
          : isNotNull(discussionMessage.parentId)
      )
    )
    .orderBy(desc(discussionMessage.id))
    .limit(args.limit);

  // 각 항목에 달린 직속 답글 수 — 목록의 [n] (D4, D14).
  const counts = await replyCounts(rows.map((r) => r.id));

  return rows.map((r) => ({
    id: r.id,
    roomId: r.roomId,
    roomName: r.roomName,
    stockCode: r.stockCode,
    stockName: r.stockName,
    content: r.content,
    // 사진·파일 메시지는 본문이 비어 있을 수 있어 화면이 "사진"/"파일"로 대체한다(D8).
    type: r.type,
    fileName: r.fileName,
    replyCount: counts.get(r.id) ?? 0,
    date: formatListDate(r.createdAt),
    createdAt: r.createdAt.toISOString(),
  }));
}
/* ----(~내 글·답글 목록 공통부 여기까지)---- */

/** 원시 행 → 화면용 메시지. 마스킹·첨부·인용·답글수를 모두 적용한다. */
async function hydrateMessages(slice: RawMessageRow[]) {
  const [imagesByMessage, parents, counts_] = await Promise.all([
    imagesFor(slice),
    parentSnapshots(slice),
    replyCounts(slice.map((m) => m.id)),
  ]);

  return slice.map((m) => {
    const masked = Boolean(m.deletedAt || m.blindedAt);
    return {
      id: m.id,
      userId: m.userId,
      userName: m.userName,
      userImage: m.userImage,
      // Mask content when soft-deleted OR admin-blinded.
      content: masked ? null : m.content,
      type: m.type,
      images:
        m.type === "image" && !masked
          ? (imagesByMessage.get(m.id) ?? [])
          : null,
      file:
        m.type === "file" && !masked
          ? {
              url: `/media/discussion-file/${m.id}`,
              name: m.fileName ?? "",
              mime: m.fileMime ?? "application/octet-stream",
              size: m.fileSize ?? 0,
            }
          : null,
      createdAt: m.createdAt.toISOString(),
      deletedAt: m.deletedAt?.toISOString() ?? null,
      blindedAt: m.blindedAt?.toISOString() ?? null,
      blindReason: m.blindReason ?? null,
      parentId: m.parentId,
      parent: m.parentId === null ? null : (parents.get(m.parentId) ?? null),
      replyCount: counts_.get(m.id) ?? 0,
    };
  });
}
/* ----(~메시지 조회 공통부 여기까지)---- */

export const discussionRouter = {
  /**
   * Room list for the Discuss tab.
   *   - hot:    likes_count DESC, last_message_at DESC NULLS LAST
   *   - watch:  stockCode ∈ user.watchlist; logged-out → []
   *   - recent: last_message_at DESC NULLS LAST, created_at DESC
   */
  rooms: publicProcedure
    .input(
      z.object({
        tab: tabSchema.default("hot"),
        // Limit to one stock (used by the stock detail screen).
        stockCode: z.string().optional(),
        // Free-text search. When non-empty, overrides the tab and matches the
        // room name or its bound stock name (whitespace/case-insensitive).
        q: z.string().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session?.user?.id ?? null;
      const query = input.q?.trim() ?? "";
      const isSearch = query.length > 0;
      const filters: SQL[] = [];

      if (input.stockCode) {
        filters.push(eq(discussionRoom.stockCode, input.stockCode));
      }

      if (isSearch) {
        // Whitespace-insensitive, case-insensitive partial match on the room
        // name or its joined stock name. Overrides the tab.
        filters.push(
          sql`(replace(lower(${discussionRoom.name}), ' ', '') LIKE replace(lower('%' || ${query} || '%'), ' ', '') OR replace(lower(${stockMaster.htsKorIsnm}), ' ', '') LIKE replace(lower('%' || ${query} || '%'), ' ', ''))`
        );
      } else if (input.tab === "watch") {
        if (!userId) {
          return [];
        }
        const watched = await db
          .selectDistinct({ stockCode: userWatchlist.stockCode })
          .from(userWatchlist)
          .where(
            and(
              eq(userWatchlist.userId, userId),
              eq(userWatchlist.type, "news")
            )
          );
        const codes = watched.map((w) => w.stockCode);
        if (codes.length === 0) {
          return [];
        }
        filters.push(inArray(discussionRoom.stockCode, codes));
      } else if (input.tab === "favorite") {
        if (!userId) {
          return [];
        }
        // Rooms the signed-in user has favorited (별).
        filters.push(favoritedExpr(userId));
      }

      const c = counts(sql<number>`${discussionRoom.id}`);

      const baseQuery = db
        .select({
          id: discussionRoom.id,
          name: discussionRoom.name,
          description: discussionRoom.description,
          stockCode: discussionRoom.stockCode,
          stockName: stockMaster.htsKorIsnm,
          sentiment: discussionRoom.sentiment,
          createdAt: discussionRoom.createdAt,
          createdById: discussionRoom.createdBy,
          createdByName: user.name,
          likesCount: c.likesCount,
          membersCount: c.membersCount,
          repliesCount: c.repliesCount,
          lastMessageAt: c.lastMessageAt,
          liked: likedExpr(userId),
          favorited: favoritedExpr(userId),
        })
        .from(discussionRoom)
        .leftJoin(user, eq(discussionRoom.createdBy, user.id))
        .leftJoin(
          stockMaster,
          eq(discussionRoom.stockCode, stockMaster.mkscShrnIscd)
        );

      const filteredQuery =
        filters.length > 0 ? baseQuery.where(and(...filters)) : baseQuery;

      let rows: Awaited<typeof filteredQuery>;
      if (input.tab === "hot" && !isSearch) {
        rows = await filteredQuery.orderBy(
          desc(c.likesCount),
          sql`${c.lastMessageAt} DESC NULLS LAST`
        );
      } else {
        rows = await filteredQuery.orderBy(
          sql`${c.lastMessageAt} DESC NULLS LAST`,
          desc(discussionRoom.createdAt)
        );
      }

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        stockCode: r.stockCode,
        stockName: r.stockName,
        sentiment: r.sentiment,
        createdBy: r.createdById
          ? { id: r.createdById, name: r.createdByName ?? "" }
          : null,
        createdAt: r.createdAt.toISOString(),
        lastMessageAt: r.lastMessageAt?.toISOString() ?? null,
        // UI-ready relative label. Prefer last activity over creation.
        time: relativeTime(r.lastMessageAt ?? r.createdAt),
        likesCount: r.likesCount,
        membersCount: r.membersCount,
        repliesCount: r.repliesCount,
        liked: r.liked,
        favorited: r.favorited,
      }));
    }),

  /** Single room header — used by the DiscussionRoom screen. */
  room: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ context, input }) => {
      const userId = context.session?.user?.id ?? null;
      const c = counts(sql<number>`${discussionRoom.id}`);
      const [row] = await db
        .select({
          id: discussionRoom.id,
          name: discussionRoom.name,
          description: discussionRoom.description,
          stockCode: discussionRoom.stockCode,
          stockName: stockMaster.htsKorIsnm,
          sentiment: discussionRoom.sentiment,
          createdAt: discussionRoom.createdAt,
          createdById: discussionRoom.createdBy,
          createdByName: user.name,
          likesCount: c.likesCount,
          membersCount: c.membersCount,
          repliesCount: c.repliesCount,
          lastMessageAt: c.lastMessageAt,
          liked: likedExpr(userId),
          favorited: favoritedExpr(userId),
          blocked: blockedExpr(userId),
        })
        .from(discussionRoom)
        .leftJoin(user, eq(discussionRoom.createdBy, user.id))
        .leftJoin(
          stockMaster,
          eq(discussionRoom.stockCode, stockMaster.mkscShrnIscd)
        )
        .where(eq(discussionRoom.id, input.id))
        .limit(1);

      if (!row) {
        return null;
      }
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        stockCode: row.stockCode,
        stockName: row.stockName,
        sentiment: row.sentiment,
        createdBy: row.createdById
          ? { id: row.createdById, name: row.createdByName ?? "" }
          : null,
        createdAt: row.createdAt.toISOString(),
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
        time: relativeTime(row.lastMessageAt ?? row.createdAt),
        likesCount: row.likesCount,
        membersCount: row.membersCount,
        repliesCount: row.repliesCount,
        liked: row.liked,
        favorited: row.favorited,
        blocked: row.blocked,
      };
    }),

  /**
   * Message list — cursor pagination (id desc). Returns oldest-first so the
   * chat screen can append without re-sort. Soft-deleted rows are returned
   * with deletedAt non-null so the client renders the placeholder.
   */
  messages: publicProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        // 과거 방향(위로 스크롤). id < cursor
        cursor: z.number().int().optional(),
        /* ----(최신 방향 커서 — RFC 0008 D15)---- */
        // 앵커로 진입하면 아래쪽도 잘려 있어서 최신 방향으로도 이어 붙여야 한다.
        // id > after. cursor 와 동시에 주면 after 가 우선한다.
        after: z.number().int().optional(),
        /* ----(~최신 방향 커서 여기까지)---- */
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .handler(async ({ context, input }) => {
      await assertRoomReadable(context.session?.user?.id ?? null, input.roomId);
      const inRoom = eq(discussionMessage.roomId, input.roomId);

      /* ----(방향별 조회 — RFC 0008 D15)---- */
      if (input.after !== undefined) {
        // 최신 방향: id 오름차순으로 뽑으면 그대로 화면 순서가 된다.
        const rows = (await selectMessages(
          and(inRoom, gt(discussionMessage.id, input.after)) as SQL,
          asc(discussionMessage.id),
          input.limit + 1
        )) as RawMessageRow[];
        const hasMore = rows.length > input.limit;
        const slice = hasMore ? rows.slice(0, input.limit) : rows;
        return {
          messages: await hydrateMessages(slice),
          nextCursor: null,
          nextAfter: hasMore ? (slice.at(-1)?.id ?? null) : null,
        };
      }
      /* ----(~방향별 조회 여기까지)---- */

      const where = input.cursor
        ? (and(inRoom, lt(discussionMessage.id, input.cursor)) as SQL)
        : inRoom;
      const rows = (await selectMessages(
        where,
        desc(discussionMessage.id),
        input.limit + 1
      )) as RawMessageRow[];

      const hasMore = rows.length > input.limit;
      const slice = hasMore ? rows.slice(0, input.limit) : rows;
      // Oldest first for append-friendly rendering.
      slice.reverse();

      return {
        messages: await hydrateMessages(slice),
        nextCursor: hasMore ? (slice[0]?.id ?? null) : null,
        nextAfter: null,
      };
    }),

  /* ----(앵커 주변 조회 — RFC 0008 §4-3)---- */
  /**
   * "내 글·답글" 목록에서 항목을 눌렀을 때 쓴다. 그 메시지가 화면 가운데 오도록
   * **앵커를 포함한 과거 쪽 + 앵커보다 최신 쪽**을 한 번에 준다.
   *
   * 기존 messages 는 과거 방향으로만 커서를 밀 수 있어서, 오래된 메시지를 열려면
   * 맨 아래부터 수십 번 더 불러와야 했다. 인덱스는 (room_id, id) 를 그대로 탄다.
   *
   * 앵커가 그 방에 없으면 NOT_FOUND — 다른 방 메시지 id 로 남의 방 내용을
   * 들여다볼 수 없게 한다.
   */
  messagesAround: publicProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        anchorId: z.number().int(),
        // 앵커 위/아래로 각각 이만큼. 총 반환은 최대 limit*2 + 1 근처가 된다.
        limit: z.number().int().min(1).max(50).default(25),
      })
    )
    .handler(async ({ context, input }) => {
      await assertRoomReadable(context.session?.user?.id ?? null, input.roomId);
      const inRoom = eq(discussionMessage.roomId, input.roomId);

      const [anchor] = await db
        .select({ id: discussionMessage.id })
        .from(discussionMessage)
        .where(and(inRoom, eq(discussionMessage.id, input.anchorId)))
        .limit(1);
      if (!anchor) {
        throw new ORPCError("NOT_FOUND", {
          message: "해당 메시지를 찾을 수 없습니다.",
        });
      }

      const [olderRaw, newerRaw] = await Promise.all([
        // 앵커 포함 과거 방향
        selectMessages(
          and(inRoom, lte(discussionMessage.id, input.anchorId)) as SQL,
          desc(discussionMessage.id),
          input.limit + 1
        ),
        // 앵커보다 최신
        selectMessages(
          and(inRoom, gt(discussionMessage.id, input.anchorId)) as SQL,
          asc(discussionMessage.id),
          input.limit + 1
        ),
      ]);

      const hasOlder = olderRaw.length > input.limit;
      const older = (
        hasOlder ? olderRaw.slice(0, input.limit) : olderRaw
      ) as RawMessageRow[];
      older.reverse(); // 오래된 것부터

      const hasNewer = newerRaw.length > input.limit;
      const newer = (
        hasNewer ? newerRaw.slice(0, input.limit) : newerRaw
      ) as RawMessageRow[];

      const slice = [...older, ...newer];

      return {
        messages: await hydrateMessages(slice),
        // 위로 더 있으면 이 id 를 messages({ cursor }) 로 넘긴다.
        nextCursor: hasOlder ? (slice[0]?.id ?? null) : null,
        // 아래로 더 있으면 이 id 를 messages({ after }) 로 넘긴다.
        nextAfter: hasNewer ? (slice.at(-1)?.id ?? null) : null,
        anchorId: input.anchorId,
      };
    }),
  /* ----(~앵커 주변 조회 여기까지)---- */

  /**
   * "내가 쓴 글" — distinct rooms the signed-in user has posted a (non-deleted)
   * message in, ordered by the user's most recent activity in each. Rooms are
   * admin-created, so a user's "글" here means the threads they participate in.
   * Shaped like a room card (name + stock + like/reply counts).
   */
  myRooms: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional()
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const limit = input?.limit ?? 50;
      const c = counts(sql<number>`${discussionRoom.id}`);
      // The user's own last message time in each room (drives ordering + label).
      const myLastAt =
        sql<Date | null>`(SELECT MAX(${discussionMessage.createdAt}) FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${discussionRoom.id} AND ${discussionMessage.userId} = ${userId} AND ${discussionMessage.deletedAt} IS NULL)`.mapWith(
          (value) =>
            value == null ? null : new Date(`${value as string}+0000`)
        );
      const mine = sql`EXISTS (SELECT 1 FROM ${discussionMessage} WHERE ${discussionMessage.roomId} = ${discussionRoom.id} AND ${discussionMessage.userId} = ${userId} AND ${discussionMessage.deletedAt} IS NULL)`;

      const rows = await db
        .select({
          id: discussionRoom.id,
          name: discussionRoom.name,
          stockCode: discussionRoom.stockCode,
          stockName: stockMaster.htsKorIsnm,
          sentiment: discussionRoom.sentiment,
          likesCount: c.likesCount,
          repliesCount: c.repliesCount,
          favorited: favoritedExpr(userId),
          myLastAt,
        })
        .from(discussionRoom)
        .leftJoin(
          stockMaster,
          eq(discussionRoom.stockCode, stockMaster.mkscShrnIscd)
        )
        .where(mine)
        .orderBy(sql`${myLastAt} DESC NULLS LAST`)
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        stockCode: r.stockCode,
        stockName: r.stockName,
        sentiment: r.sentiment,
        likesCount: r.likesCount,
        repliesCount: r.repliesCount,
        favorited: r.favorited,
        time: r.myLastAt ? relativeTime(r.myLastAt) : "",
      }));
    }),

  /**
   * "답글" — the signed-in user's own (non-deleted) messages, newest first,
   * each joined with its room for context (room name + stock chip + link).
   */
  /* ----(내 글·답글 — RFC 0008 §2-2)---- */
  /**
   * "내 글" — 내가 **순수하게 올린 글**(`parent_id IS NULL`)만. 답글은 여기 안 나온다.
   *
   * 예전 `myRooms`는 "내가 참여한 토론방 목록"을 돌려줬는데, 글 내용이 아니라 방
   * 카드가 나와 화면 이름("내가 쓴 글")과 어긋났다. 그건 남겨 두되(D12) 화면은
   * 이걸 쓴다.
   */
  myPosts: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional()
    )
    .handler(async ({ context, input }) =>
      myMessages({
        userId: context.session.user.id,
        limit: input?.limit ?? 50,
        kind: "post",
      })
    ),

  /**
   * "답글" — 내가 **답글로 단 글**(`parent_id IS NOT NULL`)만.
   *
   * 예전에는 조건이 "내 메시지 전부"라 "아 졸려" 같은 혼잣말도 답글로 잡혔다.
   */
  myReplies: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional()
    )
    .handler(async ({ context, input }) =>
      myMessages({
        userId: context.session.user.id,
        limit: input?.limit ?? 50,
        kind: "reply",
      })
    ),
  /* ----(~내 글·답글 여기까지)---- */

  send: protectedProcedure
    .input(
      z
        .object({
          roomId: z.number().int(),
          // Empty allowed only when an attachment is present (checked below).
          content: z.string().max(1000).default(""),
          // Explicit kind is optional — the actual type is derived from what's
          // attached (docs/rfcs/0004 기능5).
          type: z.enum(["text", "image", "file"]).optional(),
          // Image message: ids from POST /upload/discussion-image (sender's own).
          imageIds: z
            .array(z.number().int())
            .max(MAX_MESSAGE_IMAGES)
            .optional(),
          // File message: opaque id returned by POST /upload/discussion-file.
          fileAttachmentId: z.string().uuid().optional(),
          /* ----(답글 부모 — RFC 0008)---- */
          // 있으면 답글, 없으면 글. 부모는 "직전에 롱프레스한 그 메시지"다.
          parentId: z.number().int().optional(),
          /* ----(~답글 부모 여기까지)---- */
        })
        .refine(
          (v) =>
            v.content.trim().length > 0 ||
            (v.imageIds?.length ?? 0) > 0 ||
            v.fileAttachmentId !== undefined,
          { message: "내용 또는 첨부가 필요합니다." }
        )
    )
    .handler(async ({ context, input }) => {
      const result = await sendMessage({
        roomId: input.roomId,
        userId: context.session.user.id,
        content: input.content.trim(),
        imageIds: input.imageIds,
        fileAttachmentId: input.fileAttachmentId,
        /* ----(답글 부모 — RFC 0008)---- */
        parentId: input.parentId,
        /* ----(~답글 부모 여기까지)---- */
      });
      refreshRealtimeDiscussion("discussion.send");
      return {
        id: result.id,
        createdAt: result.createdAt.toISOString(),
      };
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.number().int() }))
    .handler(async ({ context, input }) => {
      await deleteMessage({
        messageId: input.messageId,
        actorUserId: context.session.user.id,
        actorRole: context.session.user.role ?? "user",
      });
      refreshRealtimeDiscussion("discussion.deleteMessage");
      return { ok: true };
    }),

  toggleLike: protectedProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(async ({ context, input }) => {
      const result = await toggleLike({
        roomId: input.roomId,
        userId: context.session.user.id,
      });
      refreshRealtimeDiscussion("discussion.toggleLike");
      return result;
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(
      async ({ context, input }) =>
        await toggleFavorite({
          roomId: input.roomId,
          userId: context.session.user.id,
        })
    ),

  /** Explicit leave — removes the user from `discussion_room_member`. */
  leaveRoom: protectedProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(async ({ context, input }) => {
      await db
        .delete(discussionRoomMember)
        .where(
          and(
            eq(discussionRoomMember.userId, context.session.user.id),
            eq(discussionRoomMember.roomId, input.roomId)
          )
        );
      refreshRealtimeDiscussion("discussion.leaveRoom");
      return { ok: true };
    }),

  // ── admin ─────────────────────────────────────────────────────────

  createRoom: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50),
        description: z.string().max(200).default(""),
        stockCode: z.string().nullable().default(null),
        sentiment: sentimentSchema.default("neutral"),
      })
    )
    .handler(async ({ context, input }) => {
      const [room] = await db
        .insert(discussionRoom)
        .values({
          name: input.name.trim(),
          description: input.description.trim(),
          stockCode: input.stockCode,
          sentiment: input.sentiment,
          createdBy: context.session.user.id,
        })
        .returning({ id: discussionRoom.id });
      if (!room) {
        throw new Error("토론방 생성 실패");
      }
      refreshRealtimeDiscussion("discussion.createRoom");
      return { id: room.id };
    }),

  updateRoom: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(50).optional(),
        description: z.string().max(200).optional(),
        stockCode: z.string().nullable().optional(),
        sentiment: sentimentSchema.optional(),
      })
    )
    .handler(async ({ input }) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) {
        patch.name = input.name.trim();
      }
      if (input.description !== undefined) {
        patch.description = input.description.trim();
      }
      if (input.stockCode !== undefined) {
        patch.stockCode = input.stockCode;
      }
      if (input.sentiment !== undefined) {
        patch.sentiment = input.sentiment;
      }
      if (Object.keys(patch).length === 0) {
        return { ok: true };
      }
      await db
        .update(discussionRoom)
        .set(patch)
        .where(eq(discussionRoom.id, input.id));
      refreshRealtimeDiscussion("discussion.updateRoom");
      return { ok: true };
    }),

  deleteRoom: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db.delete(discussionRoom).where(eq(discussionRoom.id, input.id));
      refreshRealtimeDiscussion("discussion.deleteRoom");
      return { ok: true };
    }),

  /** Admin bulk blind (가림) — masks the selected messages for everyone. */
  hideMessages: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        messageIds: z.array(z.number().int()).min(1),
        reason: z.string().min(1).max(200),
      })
    )
    .handler(async ({ context, input }) => {
      await hideMessages({
        roomId: input.roomId,
        messageIds: input.messageIds,
        actorId: context.session.user.id,
        reason: input.reason.trim(),
      });
      refreshRealtimeDiscussion("discussion.hideMessages");
      return { ok: true };
    }),

  /** Admin bulk un-blind — restores the selected messages. */
  unhideMessages: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        messageIds: z.array(z.number().int()).min(1),
      })
    )
    .handler(async ({ input }) => {
      await unhideMessages({
        roomId: input.roomId,
        messageIds: input.messageIds,
      });
      refreshRealtimeDiscussion("discussion.unhideMessages");
      return { ok: true };
    }),

  /** Admin bulk soft-delete. */
  deleteMessages: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        messageIds: z.array(z.number().int()).min(1),
      })
    )
    .handler(async ({ input }) => {
      await deleteMessages({
        roomId: input.roomId,
        messageIds: input.messageIds,
      });
      refreshRealtimeDiscussion("discussion.deleteMessages");
      return { ok: true };
    }),

  /** Admin roster for the moderation panel — members + mute/block state. */
  roomMembers: adminProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(async ({ input }) => await roomMembers({ roomId: input.roomId })),

  /** Active blocks for the separate admin blocked-user section. */
  blockedRoomMembers: adminProcedure
    .input(z.object({ roomId: z.number().int() }))
    .handler(
      async ({ input }) => await blockedRoomMembers({ roomId: input.roomId })
    ),

  /** Admin mute (뮤트) — value+unit, total capped at 1 day. */
  muteMember: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        userId: z.string(),
        value: z.number().int().min(1),
        unit: z.enum(["hour", "day"]),
      })
    )
    .handler(async ({ context, input }) => {
      await muteMember({
        roomId: input.roomId,
        userId: input.userId,
        hours: toHours(input.value, input.unit),
        actorId: context.session.user.id,
      });
      refreshRealtimeDiscussion("discussion.muteMember");
      return { ok: true };
    }),

  /** Admin unmute. */
  unmuteMember: adminProcedure
    .input(z.object({ roomId: z.number().int(), userId: z.string() }))
    .handler(async ({ input }) => {
      await unmuteMember({ roomId: input.roomId, userId: input.userId });
      refreshRealtimeDiscussion("discussion.unmuteMember");
      return { ok: true };
    }),

  /** Admin block (차단) — value+unit, total capped at 7 days. */
  blockMember: adminProcedure
    .input(
      z.object({
        roomId: z.number().int(),
        userId: z.string(),
        value: z.number().int().min(1),
        unit: z.enum(["hour", "day"]),
      })
    )
    .handler(async ({ context, input }) => {
      await blockMember({
        roomId: input.roomId,
        userId: input.userId,
        hours: toHours(input.value, input.unit),
        actorId: context.session.user.id,
      });
      refreshRealtimeDiscussion("discussion.blockMember");
      return { ok: true };
    }),

  /** Admin unblock. */
  unblockMember: adminProcedure
    .input(z.object({ roomId: z.number().int(), userId: z.string() }))
    .handler(async ({ input }) => {
      await unblockMember({ roomId: input.roomId, userId: input.userId });
      refreshRealtimeDiscussion("discussion.unblockMember");
      return { ok: true };
    }),
};

// Re-export domain functions so future ws handlers can call them without
// going through the RPC layer (docs/adr/0001 #4).
export const discussionDomain = {
  sendMessage,
  deleteMessage,
  hideMessages,
  unhideMessages,
  deleteMessages,
  toggleLike,
  toggleFavorite,
  roomMembers,
  blockedRoomMembers,
  muteMember,
  unmuteMember,
  blockMember,
  unblockMember,
};
