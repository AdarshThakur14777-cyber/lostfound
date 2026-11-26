import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { badRequest, handler, json } from "@/lib/http";
import { isModerator, requireUser } from "@/lib/auth";
import { createClaim } from "@/lib/claims";
import { buildClaimView, buildClaimViews } from "@/lib/claim-view";
import { claims } from "@/models/collections";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  itemId: z.string().min(1),
  note: z.string().trim().min(5).max(1000),
});

/** POST - open a claim; the verification challenge is minted immediately. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["student", "staff", "security", "admin", "sysadmin"]);
  const body = createSchema.parse(await req.json());
  const db = await getDb();
  const { claim, challenge } = await createClaim(db, {
    itemId: body.itemId,
    claimantId: user.sub,
    note: body.note,
  });
  const view = await buildClaimView(db, claim, { id: user.sub, moderator: isModerator(user.role) });
  return json({ claim: view, challenge }, 201);
});

/** GET - ?scope=mine (default) or ?scope=queue (security review queue). */
export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser(req);
  const db = await getDb();
  const scope = req.nextUrl.searchParams.get("scope") ?? "mine";
  const moderator = isModerator(user.role);

  if (scope === "queue") {
    if (!moderator) throw badRequest("Unknown scope");
    const queue = await claims(db)
      .find({ status: { $in: ["pending", "verification_passed"] } })
      .sort({ createdAt: 1 })
      .limit(100)
      .toArray();
    return json({ claims: await buildClaimViews(db, queue, { id: user.sub, moderator: true }) });
  }

  const mine = await claims(db)
    .find({ claimantId: user.sub })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();
  return json({ claims: await buildClaimViews(db, mine, { id: user.sub, moderator }) });
});
