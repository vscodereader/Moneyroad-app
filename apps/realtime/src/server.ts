import fastifySse from "@fastify/sse";
import { env } from "@moneyroad-app/env/realtime";
import { initLogger } from "evlog";
import { evlog } from "evlog/fastify";
import Fastify from "fastify";
import { registerQuotesPlugin } from "./plugins/quotes";

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

  app.get("/", () => "OK");

  return app;
}
