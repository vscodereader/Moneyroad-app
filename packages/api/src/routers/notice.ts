import { db } from "@moneyroad-app/db";
import { notice } from "@moneyroad-app/db/schema";
import { desc, eq } from "drizzle-orm";
import z from "zod";

import { adminProcedure, publicProcedure } from "../index";

const categorySchema = z.enum(["notice", "update", "event"]);

const MS = { min: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

// 목록의 상대 시간 라벨("3일 전"). 상세에서는 createdAt(ISO)로 정확한 날짜를 보여준다.
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

// Screen-facing item shape (mirrors apps/native notice list/detail).
export interface NoticeItem {
  body: string;
  category: z.infer<typeof categorySchema>;
  createdAt: string;
  id: number;
  pinned: boolean;
  time: string;
  title: string;
}

export const noticeRouter = {
  // Public notice list: pinned first, then newest. body included so the detail
  // drawer renders without a second round trip.
  list: publicProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional()
    )
    .handler(async ({ input }): Promise<NoticeItem[]> => {
      const limit = input?.limit ?? 50;
      const rows = await db
        .select({
          id: notice.id,
          category: notice.category,
          title: notice.title,
          body: notice.body,
          pinned: notice.pinned,
          createdAt: notice.createdAt,
        })
        .from(notice)
        .orderBy(desc(notice.pinned), desc(notice.createdAt))
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        body: r.body,
        pinned: r.pinned,
        time: relativeTime(r.createdAt),
        createdAt: r.createdAt.toISOString(),
      }));
    }),

  // Admin: publish a notice.
  create: adminProcedure
    .input(
      z.object({
        category: categorySchema.default("notice"),
        title: z.string().min(1).max(100),
        body: z.string().min(1).max(2000),
        pinned: z.boolean().default(false),
      })
    )
    .handler(async ({ context, input }) => {
      const [row] = await db
        .insert(notice)
        .values({
          category: input.category,
          title: input.title.trim(),
          body: input.body.trim(),
          pinned: input.pinned,
          createdBy: context.session.user.id,
        })
        .returning({ id: notice.id });
      if (!row) {
        throw new Error("공지 등록 실패");
      }
      return { id: row.id };
    }),

  // Admin: pin / unpin (toggles top-of-list placement).
  setPinned: adminProcedure
    .input(z.object({ id: z.number().int(), pinned: z.boolean() }))
    .handler(async ({ input }) => {
      await db
        .update(notice)
        .set({ pinned: input.pinned })
        .where(eq(notice.id, input.id));
      return { ok: true };
    }),

  // Admin: delete a notice.
  remove: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      await db.delete(notice).where(eq(notice.id, input.id));
      return { ok: true };
    }),
};
