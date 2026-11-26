import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { runAgeing } from "@/lib/settings";
import { notify, writeAudit } from "@/lib/audit";
import { items } from "@/models/collections";

export const dynamic = "force-dynamic";

/**
 * Runs the ageing pass (normally the nightly job: `npm run ageing`).
 * Warns reporters of soon-to-expire items and queues unclaimed items for disposal.
 */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["admin", "sysadmin", "security"]);
  const db = await getDb();
  const result = await runAgeing(db);

  for (const itemId of result.warned) {
    const item = await items(db).findOne({ _id: itemId });
    if (!item) continue;
    await notify(db, {
      userId: item.reporterId,
      type: "ageing_warning",
      title: "Unclaimed item nearing disposal",
      body: `"${item.title}" will move to the disposal queue soon unless someone claims it.`,
      link: `/items/${item._id}`,
    });
  }
  for (const itemId of result.queued) {
    const item = await items(db).findOne({ _id: itemId });
    if (!item) continue;
    await notify(db, {
      userId: item.reporterId,
      type: "disposal",
      title: "Item moved to disposal queue",
      body: `"${item.title}" is unclaimed past the retention period and awaits disposal review.`,
      link: `/items/${item._id}`,
    });
  }

  await writeAudit(db, {
    actorId: user.sub,
    actorRole: user.role,
    action: "ageing.run",
    entityType: "system",
    entityId: "ageing",
    meta: { warned: result.warned.length, queued: result.queued.length },
  });

  return json(result);
});
