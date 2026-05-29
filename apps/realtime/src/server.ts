import fastifySse from "@fastify/sse";
import { env } from "@moneyroad-app/env/realtime";
import { initLogger } from "evlog";
import { evlog } from "evlog/fastify";
import Fastify from "fastify";
import { registerNewsPlugin } from "./plugins/news";
import { registerQuotesPlugin } from "./plugins/quotes";
import { registerSchedulerPlugin } from "./plugins/scheduler";

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
  app.register(registerSchedulerPlugin);

  app.get("/", () => "OK RT");

  return app;
}
