/** Ageing pass: `npm run ageing` (cron/systemd timer). */
import { getDb, closeDb } from "../src/lib/db";
import { runAgeing } from "../src/lib/settings";

async function main() {
  const db = await getDb();
  const result = await runAgeing(db);
  console.log(`ageing: warned ${result.warned.length}, queued ${result.queued.length} for disposal`);
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
