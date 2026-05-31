// Clears all application tables for a fresh launch database.
// Requires an explicit confirmation env so this cannot run by accident.
import "dotenv/config";
import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { ScriptSafetyService } from "../services/script-safety.service";

const CONFIRM_VALUE = "RESET_FIZYOFLOW_APP_DATA";

async function main() {
  ScriptSafetyService.assertNonProductionScript("reset-app-data");

  if (process.env.CONFIRM_RESET_APP_DATA !== CONFIRM_VALUE) {
    throw new Error(`Set CONFIRM_RESET_APP_DATA=${CONFIRM_VALUE} to clear the database.`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  await AppDataSource.initialize();

  const tableNames = AppDataSource.entityMetadatas
    .map((meta) => meta.tableName)
    .filter((name, index, list) => Boolean(name) && list.indexOf(name) === index);

  if (!tableNames.length) {
    throw new Error("No application tables found to reset.");
  }

  const quotedTables = tableNames.map((name) => `"${name}"`).join(", ");
  await AppDataSource.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`);

  console.log(`Application data cleared. Tables truncated: ${tableNames.length}`);
}

main()
  .catch((error) => {
    console.error("Reset app data failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
