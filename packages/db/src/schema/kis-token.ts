import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Persists the KIS REST OAuth access token so it survives container restarts and
// redeploys. KIS issues tokens ~1/day (24h validity) and rate-limits reissue, so
// the realtime service reuses this row until the token nears expiry instead of
// minting a fresh one on every boot.
export const kisToken = pgTable("kis_token", {
  /** KIS 환경 (prod | paper) — 환경별 appkey가 달라 토큰도 분리한다. */
  env: text("env").primaryKey(),
  accessToken: text("access_token").notNull(),
  /** 실제 토큰 만료 시각 (KIS expires_in 기준). */
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
