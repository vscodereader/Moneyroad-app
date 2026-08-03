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
    // 뉴스 라벨 분류 전용 모델. flash = 노이즈 게이팅 품질 우선. 배치 분류라
    // 호출 수가 적어(사이클당 ~2회) 무료 20 RPM 안에서 넉넉히 돈다.
    // "-latest" 별칭 → 고정 버전(예: gemini-2.5-flash-lite)처럼 폐기되지 않음.
    NEWS_AI_MODEL: z.string().default("gemini-flash-latest"),
    // Max successful push of the same (user, type) per 5 min before throttling.
    NOTIFICATION_COOLDOWN_5M_MAX: z.coerce.number().default(5),

    // Daily stock_master refresh schedule (cron). Default 06:00 Asia/Seoul.
    STOCK_MASTER_CRON: z.string().default("0 6 * * *"),
    STOCK_MASTER_TZ: z.string().default("Asia/Seoul"),
    // 종목 아이콘 자동 sync 대상 GCS 버킷. 설정 시 stock_master 갱신 크론 직후
    // "아이콘 없는 종목"만 토스→GCS로 sync한다. 미설정 시 아이콘 자동 sync 비활성.
    STOCK_ICON_BUCKET: z.string().optional(),
    // 뉴스 자동 기사 썸네일(og:image)을 재호스팅할 GCS 버킷. 설정 시 수집기가
    // 네이버 기사 대표 이미지를 다운로드→리사이즈→업로드하고 news_thumbnail에
    // 공개 URL을 저장한다. 미설정 시 썸네일 수집 skip(전부 텍스트 폴백).
    NEWS_THUMBNAIL_BUCKET: z.string().optional(),

    // Watchlist union poll interval. The poller reads user_watchlist and pins
    // the unique stock_code set on QuoteHub so those symbols stay subscribed
    // upstream even when no SSE client is connected (alarm evaluation needs
    // the ticks). No-op without DATABASE_URL.
    WATCHLIST_POLL_INTERVAL_MS: z.coerce.number().default(10_000),

    // Backstop refresh cadence for the price-alert evaluator's in-memory index.
    // Alert create/delete also triggers an immediate refresh via the internal
    // refresh endpoint; this interval is the safety net if that fire-and-forget
    // trigger is missed. No-op without DATABASE_URL.
    PRICE_ALERT_REFRESH_INTERVAL_MS: z.coerce.number().default(15_000),

    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
