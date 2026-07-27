import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Cloud Run injects PORT (8080). Defaults to 3000 for local dev.
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    STREAM_TOKEN_SECRET: z.string().min(32),

    // Object-storage bucket for DiscussionRoom attachments (message images /
    // files, docs/rfcs/0004 기능5). Optional — attachment features stay off
    // until a bucket is configured. The bucket *value* is a GCP resource name
    // and is independent of this key.
    DISCUSSION_ATTACHMENT_BUCKET: z.string().optional(),

    // Realtime service base URL for internal triggers. After a watchlist/signal
    // write the API nudges this URL so the realtime poller re-pins immediately
    // instead of waiting for its ~10s interval. Auth reuses STREAM_TOKEN_SECRET.
    // Defaults to the local dev port so a monorepo `pnpm dev` needs no extra
    // config; override per environment. Best-effort — failures fall back to the
    // poller, so a wrong/unreachable URL only loses the speedup, not correctness.
    REALTIME_INTERNAL_URL: z.url().default("http://localhost:3001"),

    // Social login (all optional — each provider activates only when its keys
    // are set). Google/Apple are built-in; Naver/Kakao via genericOAuth plugin.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    // Apple: clientSecret is a pre-generated ES256 JWT (Apple max TTL 6 months,
    // regenerate before expiry). appBundleIdentifier needed for iOS idToken.
    APPLE_CLIENT_ID: z.string().optional(),
    APPLE_CLIENT_SECRET: z.string().optional(),
    APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
    // Naver login (한 앱에서 검색 API와 동일 자격증명 사용 가능).
    NAVER_CLIENT_ID: z.string().optional(),
    NAVER_CLIENT_SECRET: z.string().optional(),
    // Kakao: clientId = REST API 키. clientSecret은 콘솔에서 활성화 시 필요.
    KAKAO_CLIENT_ID: z.string().optional(),
    KAKAO_CLIENT_SECRET: z.string().optional(),

    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
