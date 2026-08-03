import fastifySchedule from "@fastify/schedule";
import { stockMaster } from "@moneyroad-app/db/schema";
import { env } from "@moneyroad-app/env/realtime";
import { sql } from "drizzle-orm";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import { AsyncTask, CronJob } from "toad-scheduler";
import { getDb, isNewsDbConfigured } from "@/services/news/db";
import {
  readMissingStockIconCodesFromDb,
  syncStockIconResources,
} from "@/services/stock-icons";
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

// ----(추가: 종목마스터 갱신 직후 "아이콘 없는 종목"만 GCS로 sync.
//  STOCK_ICON_BUCKET 미설정 시 skip — 아이콘 자동 sync는 opt-in. realtime SA가 버킷 쓰기 권한 필요)----
async function syncMissingStockIcons(): Promise<void> {
  const bucketName = env.STOCK_ICON_BUCKET;
  if (!bucketName) {
    return;
  }
  try {
    const codes = await readMissingStockIconCodesFromDb();
    if (codes.length === 0) {
      return;
    }
    const summary = await syncStockIconResources(codes, { bucketName });
    log.info({ stockIcons: { event: "scheduled_sync_done", ...summary } });
  } catch (err) {
    log.error({ err, stockIcons: { event: "scheduled_sync_failed" } });
  }
}
// ----(추가 끝)----

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
      // ----(추가: 갱신 직후 아이콘 없는 종목 아이콘 sync)----
      await syncMissingStockIcons();
      // ----(추가 끝)----
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
