import { auth } from "@moneyroad-app/auth";
import { env } from "@moneyroad-app/env/server";
import type { FastifyInstance } from "fastify";

export function registerAuthPlugin(app: FastifyInstance) {
  // Pass the raw body straight to Better Auth instead of re-parsing it.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_request, body, done) => {
      done(null, body);
    }
  );

  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      try {
        const url = new URL(request.url, env.BETTER_AUTH_URL);
        const headers = new Headers();

        for (const [key, value] of Object.entries(request.headers)) {
          if (value !== undefined) {
            headers.append(key, String(value));
          }
        }

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          body:
            request.method === "GET"
              ? undefined
              : (request.body as Buffer | undefined),
        });

        const response = await auth.handler(req);

        reply.status(response.status);
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        return reply.send(response.body ? await response.text() : null);
      } catch (error) {
        app.log.error({ err: error }, "Authentication Error");
        return reply.status(500).send({
          error: "Internal authentication error",
          code: "AUTH_FAILURE",
        });
      }
    },
  });
}
