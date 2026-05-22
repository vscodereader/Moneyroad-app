import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Cloud Run injects PORT (8080). Defaults to 3000 for local dev.
    PORT: z.coerce.number().default(3000),
    FEED: z.enum(["mock", "kis"]).default("mock"),
    HEARTBEAT_MS: z.coerce.number().default(15_000),
    MOCK_INTERVAL_MS: z.coerce.number().default(1000),
    // KIS settings are only required when FEED=kis.
    KIS_ENV: z.enum(["prod", "paper"]).default("paper"),
    KIS_APP_KEY: z.string().optional(),
    KIS_APP_SECRET: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
