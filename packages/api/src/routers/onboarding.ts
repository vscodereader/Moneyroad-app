import { db } from "@moneyroad-app/db";
import { user } from "@moneyroad-app/db/schema";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure } from "../index";
import { completeOnboarding } from "../lib/onboarding";
import { refreshRealtimePins } from "../lib/realtime-trigger";

export const onboardingRouter = {
  status: protectedProcedure.handler(async ({ context }) => {
    const [account] = await db
      .select({ onboardingCompletedAt: user.onboardingCompletedAt })
      .from(user)
      .where(eq(user.id, context.session.user.id))
      .limit(1);

    if (!account) {
      throw new ORPCError("UNAUTHORIZED");
    }

    return {
      completed: account.onboardingCompletedAt !== null,
      completedAt: account.onboardingCompletedAt?.toISOString() ?? null,
    };
  }),

  complete: protectedProcedure
    .input(z.object({ stockCodes: z.array(z.string()) }))
    .handler(async ({ context, input }) => {
      const result = await completeOnboarding(
        context.session.user.id,
        input.stockCodes
      );

      if (!result.alreadyCompleted) {
        refreshRealtimePins("onboarding.complete");
      }

      return { ok: true as const, alreadyCompleted: result.alreadyCompleted };
    }),
};
