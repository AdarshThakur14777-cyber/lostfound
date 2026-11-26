import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { forbidden, handler, json, notFound } from "@/lib/http";
import { isModerator, requireUser } from "@/lib/auth";
import { buildClaimView } from "@/lib/claim-view";
import { claims, items } from "@/models/collections";

export const dynamic = "force-dynamic";

/** Claimant, security/admin, and the item's reporter may read a claim. */
export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const db = await getDb();
  const claim = await claims(db).findOne({ _id: id });
  if (!claim) throw notFound("Claim not found");
  const item = await items(db).findOne({ _id: claim.itemId });
  const moderator = isModerator(user.role);
  const allowed = moderator || claim.claimantId === user.sub || item?.reporterId === user.sub;
  if (!allowed) throw forbidden();
  return json(await buildClaimView(db, claim, { id: user.sub, moderator }));
});
