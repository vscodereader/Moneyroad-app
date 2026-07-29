import { env } from "@moneyroad-app/env/realtime";
import { verifyStreamToken } from "@moneyroad-app/stream-token";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import { discussionHub, streamDiscussionList } from "@/services/discussion";

export function registerDiscussionPlugin(app: FastifyInstance) {
  app.get("/healthz/discussion-list", () => ({
    status: "ok",
    clients: discussionHub.clientCount,
  }));

  // SSE stream that nudges clients to refetch the discussion list whenever a
  // write occurs (RFC 0004 기능1):
  //   GET /stream/discussion-list  (Accept: text/event-stream)
  // The discussion list is public, so the token is OPTIONAL — anonymous clients
  // are allowed and a valid token only enriches the log with the subject.
  app.get<{ Querystring: { token?: string } }>(
    "/stream/discussion-list",
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
      log.info({ discussion: { event: "stream_open", user } });

      const controller = new AbortController();
      request.raw.on("close", () => {
        controller.abort();
        log.info({
          discussion: {
            event: "stream_close",
            user,
            durationMs: Date.now() - startedAt,
          },
        });
      });

      // Awaiting the generator keeps the handler pending so the connection
      // stays open and streams until the client disconnects.
      await reply.sse.send(streamDiscussionList(controller.signal));
    }
  );
}
