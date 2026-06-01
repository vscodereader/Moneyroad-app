import { env } from "@moneyroad-app/env/realtime";
import { buildServer } from "./server";
import { startNews, stopNews } from "./services/news";
import { isCollectorEnabled } from "./services/news/collector";
import { startPinnedPoller, stopPinnedPoller } from "./services/pinned-poller";
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
  // Pin the union of (관심 종목) + (관리자 시그널 종목) so they stay subscribed
  // upstream even when no SSE client is connected (alarm evaluator depends on
  // continuous ticks). No-op without DATABASE_URL.
  startPinnedPoller();
});

function shutdown() {
  stopQuotes();
  stopNews();
  stopPinnedPoller();
  app.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
