import { env } from "@moneyroad-app/env/server";
import { buildServer } from "./server";

const app = buildServer();

app.listen({ port: env.PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Server running on port ${env.PORT}`);
});

function shutdown() {
  app.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
