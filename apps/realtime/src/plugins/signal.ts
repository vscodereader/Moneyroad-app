import { env } from "@moneyroad-app/env/realtime";
import { verifyStreamToken } from "@moneyroad-app/stream-token";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import { signalFeedHub, streamSignalFeed } from "@/services/signal";

export function registerSignalPlugin(app: FastifyInstance) {
  app.get("/healthz/signal-feed", () => ({
    status: "ok",
    clients: signalFeedHub.clientCount,
  }));

  // SSE stream that nudges clients to refetch the signal feed whenever an admin
  // adds or removes a signal:
  //   GET /stream/signal-feed  (Accept: text/event-stream)
  // `signal.feed`/`signal.counts` are publicProcedure, so the token is OPTIONAL
  // — anonymous clients are allowed and a valid token only enriches the log.
  app.get<{ Querystring: { token?: string } }>(
    "/stream/signal-feed",
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
      log.info({ signal: { event: "stream_open", user } });

      const controller = new AbortController();
      request.raw.on("close", () => {
        controller.abort();
        log.info({
          signal: {
            event: "stream_close",
            user,
            durationMs: Date.now() - startedAt,
          },
        });
      });

      // Awaiting the generator keeps the handler pending so the connection
      // stays open and streams until the client disconnects.
      await reply.sse.send(streamSignalFeed(controller.signal));
    }
  );
}
