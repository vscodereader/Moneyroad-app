import { createContext } from "@moneyroad-app/api/context";
import { appRouter } from "@moneyroad-app/api/routers/index";
import { env } from "@moneyroad-app/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fastify";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fastify";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const isDev = env.NODE_ENV !== "production";

// In development, unmask INTERNAL_SERVER_ERROR so the client sees the real
// cause message + stack instead of the generic "Internal server error".
// oRPC wraps unknown thrown errors as INTERNAL_SERVER_ERROR with no message
// (the original lives on `.cause`); production keeps the generic message.
// Used as a `clientInterceptor` (runs before serialization, while the error
// is still rich). Inlined via onError() so the array's context type applies.
function unmaskInternalErrorInDev(error: unknown): void {
  if (!isDev) {
    return;
  }
  // Defined ORPCErrors (NOT_FOUND, FORBIDDEN, validation, …) already carry a
  // useful message — leave them. clientInterceptors run before oRPC masks an
  // unknown thrown error into the generic INTERNAL_SERVER_ERROR, so here the
  // error is still the raw Error (or an INTERNAL_SERVER_ERROR carrying it).
  if (error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR") {
    return;
  }
  const cause = error instanceof ORPCError ? (error.cause ?? error) : error;
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  if (!message) {
    return;
  }
  throw new ORPCError("INTERNAL_SERVER_ERROR", {
    message: `[dev] ${message}`,
    data: { stack: cause instanceof Error ? cause.stack : undefined },
    cause,
  });
}

export function registerOrpcPlugin(app: FastifyInstance) {
  const rpcHandler = new RPCHandler(appRouter, {
    clientInterceptors: [onError(unmaskInternalErrorInDev)],
    interceptors: [
      onError((error) => {
        app.log.error({ err: error }, "oRPC request failed");
      }),
    ],
  });

  const apiHandler = new OpenAPIHandler(appRouter, {
    plugins: [
      new OpenAPIReferencePlugin({
        schemaConverters: [new ZodToJsonSchemaConverter()],
      }),
    ],
    clientInterceptors: [onError(unmaskInternalErrorInDev)],
    interceptors: [
      onError((error) => {
        app.log.error({ err: error }, "OpenAPI request failed");
      }),
    ],
  });

  // Let oRPC parse the request body itself.
  app.addContentTypeParser("*", (_request, _payload, done) => {
    done(null, undefined);
  });

  app.all("/rpc/*", async (request: FastifyRequest, reply: FastifyReply) => {
    const { matched } = await rpcHandler.handle(request, reply, {
      context: await createContext(request.headers),
      prefix: "/rpc",
    });

    if (!matched) {
      return reply.status(404).send();
    }
  });

  app.all(
    "/api-reference/*",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { matched } = await apiHandler.handle(request, reply, {
        context: await createContext(request.headers),
        prefix: "/api-reference",
      });

      if (!matched) {
        return reply.status(404).send();
      }
    }
  );
}
