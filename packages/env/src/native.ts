import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "EXPO_PUBLIC_",
  client: {
    EXPO_PUBLIC_SERVER_URL: z.url(),
    // Realtime SSE service (news/quotes). Optional: live updates are skipped
    // when unset, falling back to the oRPC feed only.
    EXPO_PUBLIC_REALTIME_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
