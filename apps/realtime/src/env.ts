import { z } from "zod";

const schema = z.object({
  // Cloud Run injects PORT (8080). Defaults to 3000 for local dev.
  PORT: z.coerce.number().default(3000),
  FEED: z.enum(["mock", "kis"]).default("mock"),
  HEARTBEAT_MS: z.coerce.number().default(15_000),
  MOCK_INTERVAL_MS: z.coerce.number().default(1000),
  // KIS settings are only required when FEED=kis.
  KIS_ENV: z.enum(["prod", "paper"]).default("paper"),
  KIS_APP_KEY: z.string().optional(),
  KIS_APP_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export const env: Env = schema.parse(process.env);
