import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { decideClaim } from "@/lib/claims";
import { buildClaimView } from "@/lib/claim-view";

export const dynamic = "force-dynamic";

const schema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

/** POST - security reviews a verified claim. Approval requires a passed challenge. */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req, ["security", "admin", "sysadmin"]);
  const body = schema.parse(await req.json());
  const db = await getDb();
  const claim = await decideClaim(db, {
    claimId: id,
    decision: body.decision,
    actorId: user.sub,
    actorRole: user.role,
    note: body.note,
  });
  return json(await buildClaimView(db, claim, { id: user.sub, moderator: true }));
});
