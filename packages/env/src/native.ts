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
  // Expo only inlines *direct* `process.env.EXPO_PUBLIC_*` member accesses at
  // build time. Passing the whole `process.env` makes t3-env read them via a
  // dynamic `process.env[key]` lookup, which the bundler leaves undefined in
  // release builds (the app then crashes on env validation at launch). List
  // each var explicitly so the value is statically inlined into the bundle.
  runtimeEnv: {
    EXPO_PUBLIC_SERVER_URL: process.env.EXPO_PUBLIC_SERVER_URL,
    EXPO_PUBLIC_REALTIME_URL: process.env.EXPO_PUBLIC_REALTIME_URL,
  },
  emptyStringAsUndefined: true,
});
