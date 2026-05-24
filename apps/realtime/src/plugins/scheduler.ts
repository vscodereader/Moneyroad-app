import fastifySchedule from "@fastify/schedule";
import { stockMaster } from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { sql } from "drizzle-orm";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import { AsyncTask, CronJob } from "toad-scheduler";
import { getDb, isNewsDbConfigured } from "@/services/news/db";
import { loadStockMaster } from "@/services/stock-master/loader";

/** Populates stock_master once at boot if the table is empty (fire-and-forget). */
async function bootstrapIfEmpty(): Promise<void> {
  try {
    const [row] = await getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(stockMaster);
    if (row && row.n > 0) {
      return;
    }
    log.info({ stockMaster: { event: "bootstrap_start" } });
    const result = await loadStockMaster();
    log.info({ stockMaster: { event: "bootstrap_done", ...result } });
  } catch (err) {
    log.error({ err, stockMaster: { event: "bootstrap_failed" } });
  }
}

/**
 * Registers the daily stock_master refresh cron (default 06:00 Asia/Seoul) and,
 * on first boot with an empty table, an initial load. No-op without a DB, since
 * the refresh has nothing to write to.
 */
export async function registerSchedulerPlugin(
  app: FastifyInstance
): Promise<void> {
  if (!isNewsDbConfigured()) {
    return;
  }

  await app.register(fastifySchedule);

  const task = new AsyncTask(
    "stock-master-refresh",
    async () => {
      const result = await loadStockMaster();
      log.info({ stockMaster: { event: "scheduled_refresh", ...result } });
    },
    (err) => {
      log.error({ err, stockMaster: { event: "scheduled_refresh_failed" } });
    }
  );

  const job = new CronJob(
    { cronExpression: env.STOCK_MASTER_CRON, timezone: env.STOCK_MASTER_TZ },
    task
  );

  app.ready().then(() => {
    app.scheduler.addCronJob(job);
    log.info({
      stockMaster: {
        event: "schedule_registered",
        cron: env.STOCK_MASTER_CRON,
        tz: env.STOCK_MASTER_TZ,
      },
    });
    bootstrapIfEmpty();
  });
}
