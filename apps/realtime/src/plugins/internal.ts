import { timingSafeEqual } from "node:crypto";
import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";

import { discussionHub } from "@/services/discussion";
import { newsHub } from "@/services/news";
import type { NewsEvent } from "@/services/news/types";
import { triggerPinsRefresh } from "@/services/pinned-poller";
import { refreshPriceAlerts } from "@/services/price-alert/evaluator";

// Constant-time compare of the shared secret. Length-guarded since
// timingSafeEqual throws on length mismatch.
function secretMatches(provided: string | undefined): boolean {
  if (!provided) {
    return false;
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(env.STREAM_TOKEN_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Internal-only endpoints, authed with the shared STREAM_TOKEN_SECRET. The API
 * server calls POST /internal/refresh-pins right after a watchlist/signal write
 * so the pinned set + anonymous signal whitelist refresh immediately instead of
 * waiting for the ~10s poll. Must NOT be exposed to the public internet.
 */
export function registerInternalPlugin(app: FastifyInstance) {
  app.post<{ Headers: { "x-internal-secret"?: string } }>(
    "/internal/refresh-pins",
    async (request, reply) => {
      if (!secretMatches(request.headers["x-internal-secret"])) {
        log.warn({ internal: { event: "refresh_pins_unauthorized" } });
        reply
          .code(401)
          .send({ error: "Unauthorized", code: "INVALID_INTERNAL_SECRET" });
        return;
      }
      await Promise.all([
        triggerPinsRefresh(),
        refreshPriceAlerts().catch((err) => {
          log.warn({ err, internal: { event: "refresh_price_alerts_failed" } });
        }),
      ]);
      reply.send({ ok: true });
    }
  );

  // 관리자 뉴스 작성/수정/삭제 후 전 클라이언트에 즉시 refetch를 유발(RFC 0002 §4-6 B).
  // payload는 무시되고 "news" 이벤트 자체가 피드 캐시 무효화를 트리거한다.
  app.post<{ Headers: { "x-internal-secret"?: string } }>(
    "/internal/refresh-news",
    (request, reply) => {
      if (!secretMatches(request.headers["x-internal-secret"])) {
        log.warn({ internal: { event: "refresh_news_unauthorized" } });
        reply
          .code(401)
          .send({ error: "Unauthorized", code: "INVALID_INTERNAL_SECRET" });
        return;
      }
      const now = new Date().toISOString();
      const refresh: NewsEvent = {
        id: `refresh-${now}`,
        category: null,
        createdAt: now,
        description: "",
        link: null,
        pubDate: now,
        query: null,
        source: null,
        stockCode: null,
        summary: null,
        tags: null,
        title: "",
      };
      newsHub.broadcastRefresh(refresh);
      log.info({
        internal: { event: "refresh_news", clients: newsHub.clientCount },
      });
      reply.send({ ok: true });
    }
  );

  // 토론 작성/수정/삭제 후 전 클라이언트에 즉시 discussion-list refetch를 유발
  // (RFC 0004 기능1). payload는 무시되고 "discussion-list" 이벤트 자체가 목록
  // 캐시 무효화를 트리거한다. 토론 목록은 public이라 필터 없이 전역 broadcast.
  app.post<{ Headers: { "x-internal-secret"?: string } }>(
    "/internal/refresh-discussion-list",
    (request, reply) => {
      if (!secretMatches(request.headers["x-internal-secret"])) {
        log.warn({
          internal: { event: "refresh_discussion_list_unauthorized" },
        });
        reply
          .code(401)
          .send({ error: "Unauthorized", code: "INVALID_INTERNAL_SECRET" });
        return;
      }
      discussionHub.broadcastRefresh();
      log.info({
        internal: {
          event: "refresh_discussion_list",
          clients: discussionHub.clientCount,
        },
      });
      reply.send({ ok: true });
    }
  );
}
