import { db } from "@moneyroad-app/db";
import { inquiry } from "@moneyroad-app/db/schema";
import z from "zod";

import { protectedProcedure } from "../index";

const typeSchema = z.enum(["signal", "subscription", "account", "etc"]);

export const inquiryRouter = {
  // Submit a 1:1 support inquiry. Persisted for the support team to follow up.
  create: protectedProcedure
    .input(
      z.object({
        type: typeSchema.default("etc"),
        title: z.string().min(1).max(100),
        content: z.string().min(1).max(2000),
        contactEmail: z.string().email().optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const [row] = await db
        .insert(inquiry)
        .values({
          userId: context.session.user.id,
          contactEmail: input.contactEmail ?? context.session.user.email,
          type: input.type,
          title: input.title.trim(),
          content: input.content.trim(),
        })
        .returning({ id: inquiry.id });
      if (!row) {
        throw new Error("문의 접수 실패");
      }
      return { id: row.id };
    }),
};
