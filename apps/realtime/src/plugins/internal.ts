import { timingSafeEqual } from "node:crypto";
import { env } from "@moneyroad-app/env/realtime";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";

import { triggerPinsRefresh } from "@/services/pinned-poller";

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
      await triggerPinsRefresh();
      reply.send({ ok: true });
    }
  );
}
