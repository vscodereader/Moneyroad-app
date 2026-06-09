import { db } from "@moneyroad-app/db";
import { waitlist } from "@moneyroad-app/db/schema";
import z from "zod";

import { publicProcedure } from "../index";

export const waitlistRouter = {
  // Register a pre-launch waitlist signup from the web landing page.
  // Public — no auth. Idempotent: re-registering the same email is a no-op.
  join: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .handler(async ({ input }) => {
      const email = input.email.trim().toLowerCase();
      await db
        .insert(waitlist)
        .values({ email })
        .onConflictDoNothing({ target: waitlist.email });
      return { ok: true };
    }),
};
