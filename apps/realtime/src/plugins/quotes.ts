import { env } from "@moneyroad-app/env/realtime";
import { verifyStreamToken } from "@moneyroad-app/stream-token";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import {
  fetchIndexIntraday,
  type IndexIntraday,
} from "@/services/index-intraday";
import { quoteHub, streamQuotes } from "@/services/quotes";
import {
  type ChartRange,
  fetchStockChart,
  fetchStockSparkline,
  isChartRange,
} from "@/services/stock-chart";
import { fetchStockSnapshots } from "@/services/stock-price";

const MAX_SYMBOLS = 40;

// Symbols anyone may stream without a token (market indices: KOSPI/KOSDAQ).
// Everything else requires a valid stream token.
const PUBLIC_SYMBOLS = new Set(["0001", "1001"]);

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

// A valid token authorizes any symbol; anonymous requests are limited to the
// public allowlist. Returns the subset the caller is allowed to receive.
function authorizeSymbols(symbols: string[], authed: boolean): string[] {
  return authed ? symbols : symbols.filter((s) => PUBLIC_SYMBOLS.has(s));
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
      const symbols = authorizeSymbols(
        parseSymbols(request.query.symbols),
        payload != null
      );
      if (symbols.length === 0) {
        reply
          .code(401)
          .send({ error: "Unauthorized", code: "INVALID_STREAM_TOKEN" });
        return;
      }
      const result: Record<string, IndexIntraday> = {};
      // Sequential + throttle: KIS paper의 초당 호출 한도(EGW00201)를 피하려고
      // 호출 간격을 둔다. 캐시 hit이면 함수 자체가 빨라 무의미한 지연 X.
      for (let i = 0; i < symbols.length; i += 1) {
        const code = symbols[i];
        if (!code) {
          continue;
        }
        const data = await getIntraday(code);
        if (data) {
          result[code] = data;
        }
        if (i + 1 < symbols.length) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      reply.send(result);
    }
  );

  // Last-known price snapshots for the requested symbols (KIS REST). Pairs with
  // the /stream/quotes SSE as a seed so the client can render immediately and
  // continue showing the most recent price when WS ticks aren't flowing
  // (off hours, 동시호가, freshly-connected client).
  //   GET /quote/snapshot?symbols=005930,000660&token=<stream token>
  app.get<{ Querystring: { symbols?: string; token?: string } }>(
    "/quote/snapshot",
    async (request, reply) => {
      const payload = request.query.token
        ? verifyStreamToken(request.query.token, env.STREAM_TOKEN_SECRET)
        : null;
      const requested = parseSymbols(request.query.symbols);
      const symbols = authorizeSymbols(requested, payload != null);
      if (symbols.length === 0) {
        if (requested.length > 0 && payload == null) {
          reply
            .code(401)
            .send({ error: "Unauthorized", code: "INVALID_STREAM_TOKEN" });
          return;
        }
        reply.send({});
        return;
      }
      const snapshots = await fetchStockSnapshots(symbols);
      reply.send(snapshots);
    }
  );

  // Sparkline series — recent ~30 daily closes for a small inline chart.
  //   GET /quote/sparkline?code=000660&token=<stream token>
  // Single KIS REST call (1h cached). Token required (private symbol).
  app.get<{ Querystring: { code?: string; token?: string } }>(
    "/quote/sparkline",
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
      const code = request.query.code?.trim();
      if (!code) {
        reply.code(400).send({ error: "code query parameter is required" });
        return;
      }
      const points = await fetchStockSparkline(code);
      reply.send({ points });
    }
  );

  // Stock chart series (close prices, oldest→newest) for the requested range:
  //   GET /chart/stock?code=000660&range=1D&token=<stream token>
  // Individual stocks are private, so a valid token is required. Returns
  // `{ points: number[] }` — empty array when the upstream call fails so the
  // client can render an empty state without a special error path.
  app.get<{ Querystring: { code?: string; range?: string; token?: string } }>(
    "/chart/stock",
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
      const code = request.query.code?.trim();
      const rangeRaw = request.query.range?.trim() ?? "1D";
      if (!code) {
        reply.code(400).send({ error: "code query parameter is required" });
        return;
      }
      if (!isChartRange(rangeRaw)) {
        reply.code(400).send({ error: "invalid range" });
        return;
      }
      const range: ChartRange = rangeRaw;
      const series = await fetchStockChart(code, range);
      reply.send(series);
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
      // Auth gate: a valid token authorizes any symbol; without one, only the
      // public allowlist (indices) is streamable.
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

      const requested = parseSymbols(request.query.symbols);
      const symbols = authorizeSymbols(requested, payload != null);
      if (symbols.length === 0) {
        // Anonymous client asked only for non-public symbols → reject.
        if (requested.length > 0 && payload == null) {
          reply
            .code(401)
            .send({ error: "Unauthorized", code: "INVALID_STREAM_TOKEN" });
          return;
        }
        await reply.sse.send({
          event: "error",
          data: { error: "symbols query parameter is required" },
        });
        return;
      }

      // @fastify/sse hijacks the response, so the per-request wide event never
      // emits for SSE. Log the session lifecycle explicitly instead.
      const user = payload?.sub ?? "anon";
      const startedAt = Date.now();
      log.info({ stream: { event: "open", user, symbols } });

      const controller = new AbortController();
      request.raw.on("close", () => {
        controller.abort();
        log.info({
          stream: {
            event: "close",
            user,
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
