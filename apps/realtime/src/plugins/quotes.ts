import { env } from "@moneyroad-app/env/realtime";
import { verifyStreamToken } from "@moneyroad-app/stream-token";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import {
  fetchIndexIntraday,
  type IndexIntraday,
} from "@/services/index-intraday";
import { quoteHub, streamQuotes } from "@/services/quotes";

const MAX_SYMBOLS = 40;

// 분봉 시드는 분 단위로만 갱신되므로 짧게 캐시해 KIS REST 호출을 줄인다.
const INTRADAY_TTL_MS = 30_000;
const intradayCache = new Map<
  string,
  { at: number; data: IndexIntraday | null }
>();

async function getIntraday(code: string): Promise<IndexIntraday | null> {
  const hit = intradayCache.get(code);
  if (hit && Date.now() - hit.at < INTRADAY_TTL_MS) {
    return hit.data;
  }
  const data = await fetchIndexIntraday(code);
  intradayCache.set(code, { at: Date.now(), data });
  return data;
}

function parseSymbols(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const symbol = part.trim();
    if (symbol) {
      seen.add(symbol);
    }
  }
  return [...seen].slice(0, MAX_SYMBOLS);
}

export function registerQuotesPlugin(app: FastifyInstance) {
  app.get("/healthz", () => ({ status: "ok", clients: quoteHub.clientCount }));

  // Today's intraday seed for index charts (KIS REST):
  //   GET /index/intraday?symbols=0001,1001&token=<stream token>
  // Returns per-code { prevClose, points[] } for codes that resolved; codes the
  // upstream couldn't serve (e.g. paper/VTS) are simply omitted so the client
  // falls back to live-tick accumulation.
  app.get<{ Querystring: { symbols?: string; token?: string } }>(
    "/index/intraday",
    async (request, reply) => {
      const payload = request.query.token
        ? verifyStreamToken(request.query.token, env.STREAM_TOKEN_SECRET)
        : null;
      if (!payload) {
        reply
          .code(401)
          .send({ error: "Unauthorized", code: "INVALID_STREAM_TOKEN" });
        return;
      }
      const symbols = parseSymbols(request.query.symbols);
      const result: Record<string, IndexIntraday> = {};
      // Sequential: KIS (esp. VTS) rate-limits parallel quotation calls, which
      // can intermittently drop one symbol. Two cached calls are cheap.
      for (const code of symbols) {
        const data = await getIntraday(code);
        if (data) {
          result[code] = data;
        }
      }
      reply.send(result);
    }
  );

  // SSE stream of quotes for the requested symbols:
  //   GET /stream/quotes?symbols=005930,000660&token=<stream token>
  //   (Accept: text/event-stream)
  // The token is passed via query because web EventSource cannot set headers and
  // the auth cookie is scoped to the API server's domain, not this service.
  app.get<{ Querystring: { symbols?: string; token?: string } }>(
    "/stream/quotes",
    { sse: true },
    async (request, reply) => {
      // Auth gate: verify the signed stream token minted by the API server.
      const payload = request.query.token
        ? verifyStreamToken(request.query.token, env.STREAM_TOKEN_SECRET)
        : null;
      if (!payload) {
        reply
          .code(401)
          .send({ error: "Unauthorized", code: "INVALID_STREAM_TOKEN" });
        return;
      }

      // @fastify/sse only enables reply.sse when the client negotiates SSE.
      if (!request.headers.accept?.includes("text/event-stream")) {
        reply
          .code(406)
          .send({ error: "Accept: text/event-stream header is required" });
        return;
      }

      const symbols = parseSymbols(request.query.symbols);
      if (symbols.length === 0) {
        await reply.sse.send({
          event: "error",
          data: { error: "symbols query parameter is required" },
        });
        return;
      }

      // @fastify/sse hijacks the response, so the per-request wide event never
      // emits for SSE. Log the session lifecycle explicitly instead.
      const startedAt = Date.now();
      log.info({ stream: { event: "open", user: payload.sub, symbols } });

      const controller = new AbortController();
      request.raw.on("close", () => {
        controller.abort();
        log.info({
          stream: {
            event: "close",
            user: payload.sub,
            symbols,
            durationMs: Date.now() - startedAt,
          },
        });
      });

      // Awaiting the generator keeps the handler pending so the connection
      // stays open and streams until the client disconnects.
      await reply.sse.send(streamQuotes(symbols, controller.signal));
    }
  );
}
