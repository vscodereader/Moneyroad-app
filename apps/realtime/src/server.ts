import fastifySse from "@fastify/sse";
import { env } from "@moneyroad-app/env/realtime";
import { initLogger } from "evlog";
import { evlog } from "evlog/fastify";
import Fastify from "fastify";
import { registerInternalPlugin } from "./plugins/internal";
import { registerNewsPlugin } from "./plugins/news";
import { registerQuotesPlugin } from "./plugins/quotes";
import { registerSchedulerPlugin } from "./plugins/scheduler";
import { registerSignalPlugin } from "./plugins/signal";

initLogger({
  env: { service: "moneyroad-app-realtime" },
});

export function buildServer() {
  const app = Fastify({
    disableRequestLogging: true,
    logger: true,
  });

  app.register(evlog);
  app.register(fastifySse, { heartbeatInterval: env.HEARTBEAT_MS });
  app.register(registerQuotesPlugin);
  app.register(registerNewsPlugin);
  app.register(registerSignalPlugin);
  app.register(registerSchedulerPlugin);
  app.register(registerInternalPlugin);

  app.get("/", () => "OK RT");

  return app;
}
