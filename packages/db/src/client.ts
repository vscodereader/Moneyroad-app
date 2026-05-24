import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

/**
 * Creates a Drizzle client for an explicit connection URL.
 *
 * Kept free of any env import so non-API services (e.g. `apps/realtime`) can
 * connect with their own `DATABASE_URL` without pulling in the API server's env
 * schema (which validates `BETTER_AUTH_SECRET`, `CORS_ORIGIN`, etc.).
 */
export function createDb(url: string) {
  return drizzle(url, { schema });
}

export type Db = ReturnType<typeof createDb>;
