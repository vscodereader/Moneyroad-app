import { env } from "@moneyroad-app/env/realtime";
import { buildServer } from "./server";
import { startQuotes, stopQuotes } from "./services/quotes";

const app = buildServer();

app.listen({ port: env.PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`realtime quotes service on :${env.PORT} (feed=${env.FEED})`);
  startQuotes().catch((startErr) => {
    app.log.error(startErr, "[feed] start failed");
  });
});

function shutdown() {
  stopQuotes();
  app.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
