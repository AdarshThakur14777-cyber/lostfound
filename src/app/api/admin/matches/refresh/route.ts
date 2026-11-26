import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { refreshAllMatches } from "@/lib/matching/suggest";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/** POST - nightly match refresh, triggerable on demand. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["admin", "sysadmin"]);
  const db = await getDb();
  const result = await refreshAllMatches(db);
  await writeAudit(db, {
    actorId: user.sub,
    actorRole: user.role,
    action: "matches.refreshed",
    entityType: "system",
    entityId: "matches",
    meta: result as unknown as Record<string, unknown>,
  });
  return json(result);
});
