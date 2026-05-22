import { createContext } from "@moneyroad-app/api/context";
import { appRouter } from "@moneyroad-app/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fastify";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fastify";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export function registerOrpcPlugin(app: FastifyInstance) {
  const rpcHandler = new RPCHandler(appRouter, {
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
