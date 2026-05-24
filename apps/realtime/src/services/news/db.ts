import { createDb, type Db } from "@moneyroad-app/db/client";
import { env } from "@moneyroad-app/env/realtime";

let instance: Db | null = null;

/** True when the realtime service is configured to talk to the database. */
export function isNewsDbConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

/**
 * Lazily-created Drizzle client for the news features. Only call after checking
 * {@link isNewsDbConfigured}; the collector guards on it before any DB access.
 */
export function getDb(): Db {
  if (!instance) {
    if (!env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for news features");
    }
    instance = createDb(env.DATABASE_URL);
  }
  return instance;
}
