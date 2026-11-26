/** Nightly match refresh: `npm run refresh-matches` (cron/systemd timer). */
import { getDb, closeDb } from "../src/lib/db";
import { refreshAllMatches } from "../src/lib/matching/suggest";

async function main() {
  const db = await getDb();
  const started = Date.now();
  const result = await refreshAllMatches(db);
  console.log(
    `refresh-matches: checked ${result.checked} reports, ${result.suggestions} suggestions in ${
      Date.now() - started
    }ms`,
  );
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
