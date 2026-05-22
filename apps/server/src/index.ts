import { buildServer } from "./server";

const port = Number(process.env.PORT) || 3000;
const app = buildServer();

app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Server running on port ${port}`);
});

function shutdown() {
  app.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
