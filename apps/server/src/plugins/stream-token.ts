import { auth } from "@moneyroad-app/auth";
import { env } from "@moneyroad-app/env/server";
import { signStreamToken } from "@moneyroad-app/stream-token";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance } from "fastify";

// Short-lived: the token only authorizes the initial realtime connect, so it
// needs to cover the gap between minting and connecting, not the whole stream.
const TOKEN_TTL_SECONDS = 120;

export function registerStreamTokenPlugin(app: FastifyInstance) {
  // Mints a signed token for the realtime SSE service. Requires a valid session.
  //   POST /stream-token  ->  { token, expiresIn }
  app.post("/stream-token", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return reply.status(401).send({
        error: "Unauthorized",
        code: "NO_SESSION",
      });
    }

    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const token = signStreamToken(
      { sub: session.user.id, exp },
      env.STREAM_TOKEN_SECRET
    );

    return reply.send({ token, expiresIn: TOKEN_TTL_SECONDS });
  });
}
