// Bu script operasyonel veya demo amacli reset demo gorevini calistirmak icin kullanilir.
// Uygulama runtime'ina dogrudan bagli olmayan bakim isleri bu dosyada tutulur.
import "dotenv/config";
import "reflect-metadata";
import { AppDataSource } from "../data-source";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  await AppDataSource.initialize();
  const tableNames = AppDataSource.entityMetadatas
    .map((meta) => meta.tableName)
    .filter((name, index, list) => Boolean(name) && list.indexOf(name) === index);

  if (!tableNames.length) {
    throw new Error("Reset için tablo bulunamadı");
  }

  const quotedTables = tableNames.map((name) => `"${name}"`).join(", ");
  await AppDataSource.query(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`);

  console.log(`Tüm uygulama verileri temizlendi. Tablo sayısı: ${tableNames.length}`);
}

main()
  .catch((error) => {
    console.error("Reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
