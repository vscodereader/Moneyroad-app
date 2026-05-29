import fastifyCors from "@fastify/cors";
import { auth } from "@moneyroad-app/auth";
import { env } from "@moneyroad-app/env/server";
import { initLogger } from "evlog";
import {
  type BetterAuthInstance,
  createAuthMiddleware,
} from "evlog/better-auth";
import { evlog, useLogger } from "evlog/fastify";
import Fastify from "fastify";
import { registerAiPlugin } from "./plugins/ai";
import { registerAuthPlugin } from "./plugins/auth";
import { registerOrpcPlugin } from "./plugins/orpc";
import { registerStreamTokenPlugin } from "./plugins/stream-token";

const baseCorsConfig = {
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86_400,
};

initLogger({
  env: { service: "moneyroad-app-server" },
});

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
  exclude: ["/api/auth/**"],
  maskEmail: true,
});

export function buildServer() {
  const app = Fastify({
    disableRequestLogging: true,
    logger: true,
  });

  app.register(evlog);
  app.addHook("preHandler", async (request) => {
    await identifyUser(useLogger(), request.headers, request.url);
  });
  app.register(fastifyCors, baseCorsConfig);

  // Each plugin is registered in its own encapsulated context, so per-plugin
  // content-type parsers (oRPC `*`, auth `application/json` buffer) stay isolated.
  app.register(registerOrpcPlugin);
  app.register(registerAuthPlugin);
  app.register(registerAiPlugin);
  app.register(registerStreamTokenPlugin);

  app.get("/", () => "OK API");

  return app;
}
