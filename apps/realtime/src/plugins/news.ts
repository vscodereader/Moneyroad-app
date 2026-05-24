import { env } from "@moneyroad-app/env/realtime";
import { verifyStreamToken } from "@moneyroad-app/stream-token";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import { newsHub, streamNews } from "@/services/news";
import { getRecentNews } from "@/services/news/read";
import type { NewsFilter } from "@/services/news/types";

const MAX_SYMBOLS = 40;
const MAX_CATEGORIES = 10;

function parseCsv(raw: string | undefined, max: number): Set<string> {
  const seen = new Set<string>();
  if (!raw) {
    return seen;
  }
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (value) {
      seen.add(value);
    }
    if (seen.size >= max) {
      break;
    }
  }
  return seen;
}

export function registerNewsPlugin(app: FastifyInstance) {
  app.get("/healthz/news", () => ({
    status: "ok",
    clients: newsHub.clientCount,
  }));

  // Recent stored news (REST). Open like the legacy /api/news endpoint.
  //   GET /api/news?limit=100&category=market&stockCode=005930
  app.get<{
    Querystring: { limit?: string; category?: string; stockCode?: string };
  }>("/api/news", async (request) => {
    const limit = request.query.limit
      ? Number.parseInt(request.query.limit, 10)
      : undefined;
    const items = await getRecentNews({
      limit: Number.isNaN(limit) ? undefined : limit,
      category: request.query.category,
      stockCode: request.query.stockCode,
    });
    return { items };
  });

  // SSE stream of newly collected news for the requested symbols/categories:
  //   GET /stream/news?symbols=005930,000660&categories=market&token=<token>
  //   (Accept: text/event-stream). With neither symbols nor categories the
  //   client receives every new item. Auth mirrors /stream/quotes.
  app.get<{
    Querystring: { symbols?: string; categories?: string; token?: string };
  }>("/stream/news", { sse: true }, async (request, reply) => {
    const payload = request.query.token
      ? verifyStreamToken(request.query.token, env.STREAM_TOKEN_SECRET)
      : null;
    if (!payload) {
      reply
        .code(401)
        .send({ error: "Unauthorized", code: "INVALID_STREAM_TOKEN" });
      return;
    }

    if (!request.headers.accept?.includes("text/event-stream")) {
      reply
        .code(406)
        .send({ error: "Accept: text/event-stream header is required" });
      return;
    }

    const symbols = parseCsv(request.query.symbols, MAX_SYMBOLS);
    const categories = parseCsv(request.query.categories, MAX_CATEGORIES);
    const filter: NewsFilter = {
      symbols,
      categories,
      all: symbols.size === 0 && categories.size === 0,
    };

    const startedAt = Date.now();
    log.info({
      news: {
        event: "stream_open",
        user: payload.sub,
        symbols: [...symbols],
        categories: [...categories],
      },
    });

    const controller = new AbortController();
    request.raw.on("close", () => {
      controller.abort();
      log.info({
        news: {
          event: "stream_close",
          user: payload.sub,
          durationMs: Date.now() - startedAt,
        },
      });
    });

    await reply.sse.send(streamNews(filter, controller.signal));
  });
}
