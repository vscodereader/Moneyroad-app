import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Cloud Run injects PORT (8080). Defaults to 3000 for local dev.
    PORT: z.coerce.number().default(3001),
    FEED: z.enum(["mock", "kis"]).default("mock"),
    // Shared with the API server; used to verify stream tokens (no DB needed).
    STREAM_TOKEN_SECRET: z.string().min(32),
    HEARTBEAT_MS: z.coerce.number().default(15_000),
    MOCK_INTERVAL_MS: z.coerce.number().default(1000),
    // KIS settings are only required when FEED=kis.
    KIS_ENV: z.enum(["prod", "paper"]).default("paper"),
    KIS_APP_KEY: z.string().optional(),
    KIS_APP_SECRET: z.string().optional(),

    // News collection (optional). The collector runs only when DATABASE_URL and
    // the Naver credentials are present; otherwise the realtime service stays a
    // pure quotes feed. Stock matching and breaking-news push need DATABASE_URL.
    DATABASE_URL: z.string().optional(),
    NAVER_CLIENT_ID: z.string().optional(),
    NAVER_CLIENT_SECRET: z.string().optional(),
    // Naver news search query polling interval.
    NEWS_FETCH_INTERVAL_MS: z.coerce.number().default(60_000),
    // AI summary/classification (optional). Skipped when the key is absent.
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    NEWS_AI_MODEL: z.string().default("gemini-2.5-flash"),
    // Max successful push of the same (user, type) per 5 min before throttling.
    NOTIFICATION_COOLDOWN_5M_MAX: z.coerce.number().default(5),

    // Daily stock_master refresh schedule (cron). Default 06:00 Asia/Seoul.
    STOCK_MASTER_CRON: z.string().default("0 6 * * *"),
    STOCK_MASTER_TZ: z.string().default("Asia/Seoul"),

    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
