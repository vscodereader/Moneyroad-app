import { timingSafeEqual } from "node:crypto";
import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";

import { triggerPinsRefresh } from "@/services/pinned-poller";
import { refreshPriceAlerts } from "@/services/price-alert/evaluator";
import { signalFeedHub } from "@/services/signal";

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

  // ----(시그널 목록 실시간 갱신)----
  // 관리자가 시그널을 추가/삭제한 뒤 전 클라이언트에 즉시 feed refetch를 유발한다.
  // 위 refresh-pins 와 혼동하지 말 것 — 그쪽은 "어느 종목의 시세를 흘려보낼지"(심볼셋)를
  // 갱신할 뿐이라 목록 화면은 그대로였다. 그래서 유저 화면이 안 바뀌었다.
  // signal.feed/counts 는 publicProcedure 라 필터 없이 전역 broadcast 한다.
  app.post<{ Headers: { "x-internal-secret"?: string } }>(
    "/internal/refresh-signal",
    (request, reply) => {
      if (!secretMatches(request.headers["x-internal-secret"])) {
        log.warn({ internal: { event: "refresh_signal_unauthorized" } });
        reply
          .code(401)
          .send({ error: "Unauthorized", code: "INVALID_INTERNAL_SECRET" });
        return;
      }
      signalFeedHub.broadcastRefresh();
      log.info({
        internal: {
          event: "refresh_signal",
          clients: signalFeedHub.clientCount,
        },
      });
      reply.send({ ok: true });
    }
  );
  // ----(끝)----
}
