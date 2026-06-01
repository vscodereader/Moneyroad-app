import { env } from "@moneyroad-app/env/realtime";
import { buildServer } from "./server";
import { startNews, stopNews } from "./services/news";
import { isCollectorEnabled } from "./services/news/collector";
import { startQuotes, stopQuotes } from "./services/quotes";
import {
  startWatchlistPoller,
  stopWatchlistPoller,
} from "./services/watchlist-poller";

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
  // Pin the union of all users' watchlist symbols so they stay subscribed
  // upstream even when no SSE client is connected (alarm evaluator depends on
  // continuous ticks). No-op without DATABASE_URL.
  startWatchlistPoller();
});

function shutdown() {
  stopQuotes();
  stopNews();
  stopWatchlistPoller();
  app.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
