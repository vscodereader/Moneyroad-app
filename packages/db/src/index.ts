import { env } from "@moneyroad-app/env/server";

import { createDb } from "./client";

export { createDb, type Db } from "./client";

export const db = createDb(env.DATABASE_URL);
