import { timingSafeEqual } from "node:crypto";
import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";

import { triggerPinsRefresh } from "@/services/pinned-poller";
import { refreshPriceAlerts } from "@/services/price-alert/evaluator";
import { signalFeedHub } from "@/services/signal";
import { notifySignal } from "@/services/signal-push";

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

  // ----(시그널 푸시 알림 — RFC 0007)----
  // 관리자가 시그널을 작성하면 그 종목을 관심종목에 넣고 알림을 켜 둔 사용자에게
  // 푸시를 보낸다. 위 refresh-signal 과 분리한 이유: 저쪽은 "화면 새로고침해라"를
  // 전 클라이언트에 broadcast 하고 삭제 때도 불리지만, 이쪽은 특정 사용자에게만
  // 보내고 생성 때만 불린다(RFC 0007 §4-2).
  app.post<{
    Headers: { "x-internal-secret"?: string };
    Body: {
      action?: "buy" | "sell" | "hold";
      signalId?: string;
      stockCode?: string;
      title?: string;
    };
  }>("/internal/notify-signal", (request, reply) => {
    if (!secretMatches(request.headers["x-internal-secret"])) {
      log.warn({ internal: { event: "notify_signal_unauthorized" } });
      reply
        .code(401)
        .send({ error: "Unauthorized", code: "INVALID_INTERNAL_SECRET" });
      return;
    }
    const { action, signalId, stockCode, title } = request.body ?? {};
    if (!(action && signalId && stockCode && title)) {
      reply.code(400).send({ error: "Bad Request", code: "MISSING_FIELDS" });
      return;
    }
    // 발송을 기다리지 않고 응답한다 — 호출자(server)의 시그널 생성 응답이
    // 푸시 왕복만큼 늦어지면 안 된다. 실패는 notifySignal 안에서 로그로 남는다.
    notifySignal({ action, signalId, stockCode, title }).catch((err) => {
      log.error({ err, internal: { event: "notify_signal_failed", signalId } });
    });
    reply.send({ ok: true });
  });
  // ----(끝)----
}
