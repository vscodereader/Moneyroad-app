import { env } from "@moneyroad-app/env/realtime";
import { buildServer } from "./server";
import { startNews, stopNews } from "./services/news";
import { isCollectorEnabled } from "./services/news/collector";
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
  // The news collector only runs when DATABASE_URL + Naver keys are configured;
  // otherwise the service stays a pure quotes feed.
  if (isCollectorEnabled()) {
    startNews();
    app.log.info(
      `news collector started (interval=${env.NEWS_FETCH_INTERVAL_MS}ms)`
    );
  }
});

function shutdown() {
  stopQuotes();
  stopNews();
  app.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
