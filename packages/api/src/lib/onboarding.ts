import { db } from "@moneyroad-app/db";
import { stockMaster, user } from "@moneyroad-app/db/schema";
import { ORPCError } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";

import { insertNewsWatchlist } from "./watchlist";

interface CompleteOnboardingResult {
  alreadyCompleted: boolean;
}

export async function completeOnboarding(
  userId: string,
  requestedStockCodes: string[]
): Promise<CompleteOnboardingResult> {
  const stockCodes = [
    ...new Set(requestedStockCodes.map((code) => code.trim()).filter(Boolean)),
  ];

  if (stockCodes.length > 0 && stockCodes.length < 3) {
    throw new ORPCError("BAD_REQUEST", {
      message: "관심 종목은 3개 이상 선택하거나 건너뛰어야 합니다.",
    });
  }

  return db.transaction(async (tx) => {
    const [account] = await tx
      .select({ onboardingCompletedAt: user.onboardingCompletedAt })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .for("update");

    if (!account) {
      throw new ORPCError("UNAUTHORIZED");
    }

    if (account.onboardingCompletedAt) {
      return { alreadyCompleted: true };
    }

    if (stockCodes.length > 0) {
      const existingStocks = await tx
        .select({ code: stockMaster.mkscShrnIscd })
        .from(stockMaster)
        .where(inArray(stockMaster.mkscShrnIscd, stockCodes));

      if (existingStocks.length !== stockCodes.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "존재하지 않는 종목이 포함되어 있습니다.",
        });
      }

      await insertNewsWatchlist(tx, userId, stockCodes);
    }

    await tx
      .update(user)
      .set({ onboardingCompletedAt: new Date() })
      .where(eq(user.id, userId));

    return { alreadyCompleted: false };
  });
}
