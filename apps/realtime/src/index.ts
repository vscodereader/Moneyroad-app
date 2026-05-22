import Fastify from "fastify";
import { env } from "./env";
import { createFeed } from "./feed/create";
import { QuoteHub } from "./hub";
import { sseComment, sseEvent, writeSseHeaders } from "./sse";

const MAX_SYMBOLS = 40;

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

const feed = createFeed(env);
const hub = new QuoteHub(feed);
await feed.start();

const fastify = Fastify({ logger: true });

fastify.get("/", () => "OK");
fastify.get("/healthz", () => ({ status: "ok", clients: hub.clientCount }));

// SSE stream of quotes for the requested symbols:
//   GET /stream/quotes?symbols=005930,000660
fastify.get<{ Querystring: { symbols?: string } }>(
  "/stream/quotes",
  (request, reply) => {
    const symbols = parseSymbols(request.query.symbols);
    if (symbols.length === 0) {
      reply.code(400).send({ error: "symbols query parameter is required" });
      return;
    }

    reply.hijack();
    const res = reply.raw;
    writeSseHeaders(res);
    res.write(sseComment("connected"));

    const client = hub.addClient(symbols, (quote) => {
      res.write(sseEvent("quote", quote));
    });

    const heartbeat = setInterval(() => {
      res.write(sseComment("hb"));
    }, env.HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      hub.removeClient(client);
    };
    request.raw.on("close", cleanup);
  }
);

try {
  await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
  fastify.log.info(`realtime quotes service listening (feed=${env.FEED})`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
