import { runMigrations } from "@moneyroad-app/db/migrate";

const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? "./migrations";

await runMigrations(migrationsFolder);

console.log(`Migrations applied from ${migrationsFolder}`);
