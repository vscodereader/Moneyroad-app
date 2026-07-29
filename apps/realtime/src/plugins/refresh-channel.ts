import { env } from "@moneyroad-app/env/realtime";
import { verifyStreamToken } from "@moneyroad-app/stream-token";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import type { RefreshEvent } from "@/services/refresh-hub";

interface RefreshChannel {
  /** 경로와 이벤트 이름에 함께 쓰인다: `/stream/<channel>`, `/healthz/<channel>`. */
  channel: string;
  clientCount(): number;
  /** 로그 최상위 키. 채널별 로그 네임스페이스를 유지한다. */
  logKey: string;
  stream(signal: AbortSignal): AsyncGenerator<{
    event: string;
    data: RefreshEvent;
  }>;
}

/**
 * "다시 불러와라"만 보내는 공개 SSE 채널 하나를 등록한다.
 *
 *   GET /healthz/<channel>
 *   GET /stream/<channel>   (Accept: text/event-stream)
 *
 * 토큰은 **선택**이다 — 이 채널들이 실어 나르는 목록은 public 이라 익명 연결을
 * 허용하고, 유효한 토큰은 로그에 subject 를 남기는 용도로만 쓴다. (토큰이
 * 필수이고 카테고리 필터까지 받는 뉴스 스트림은 이 헬퍼를 쓰지 않는다.)
 */
export function registerRefreshChannel(
  app: FastifyInstance,
  { channel, logKey, clientCount, stream }: RefreshChannel
): void {
  app.get(`/healthz/${channel}`, () => ({
    status: "ok",
    clients: clientCount(),
  }));

  app.get<{ Querystring: { token?: string } }>(
    `/stream/${channel}`,
    { sse: true },
    async (request, reply) => {
      const payload = request.query.token
        ? verifyStreamToken(request.query.token, env.STREAM_TOKEN_SECRET)
        : null;

      // @fastify/sse only enables reply.sse when the client negotiates SSE.
      if (!request.headers.accept?.includes("text/event-stream")) {
        reply
          .code(406)
          .send({ error: "Accept: text/event-stream header is required" });
        return;
      }

      const user = payload?.sub ?? "anon";
      const startedAt = Date.now();
      log.info({ [logKey]: { event: "stream_open", user } });

      const controller = new AbortController();
      request.raw.on("close", () => {
        controller.abort();
        log.info({
          [logKey]: {
            event: "stream_close",
            user,
            durationMs: Date.now() - startedAt,
          },
        });
      });

      // Awaiting the generator keeps the handler pending so the connection
      // stays open and streams until the client disconnects.
      await reply.sse.send(stream(controller.signal));
    }
  );
}
