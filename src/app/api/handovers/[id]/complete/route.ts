import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { handler, json, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { completeHandover } from "@/lib/custody";
import { notify } from "@/lib/audit";
import { isImagePath } from "@/lib/upload";
import { handovers } from "@/models/collections";

export const dynamic = "force-dynamic";

const schema = z.object({
  otp: z.string().trim().min(4).max(10).optional(),
  signatureName: z.string().trim().max(120).optional(),
  proofImage: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

/**
 * POST - the security officer completes the supervised handover. Requires the
 * claimant's OTP (or signature) plus a proof photo, and appends the final link
 * of the custody chain.
 */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req, ["security", "admin", "sysadmin"]);
  const body = schema.parse(await req.json());
  if (!isImagePath(body.proofImage)) throw notFound("Proof photo not found");

  const db = await getDb();
  const handover = await handovers(db).findOne({ _id: id });
  if (!handover) throw notFound("Handover not found");

  await completeHandover(db, handover, {
    actorId: user.sub,
    otp: body.otp,
    signatureName: body.signatureName,
    proofImage: body.proofImage,
    note: body.note,
  });

  await notify(db, {
    userId: handover.claimantId,
    type: "handover_completed",
    title: "Item returned",
    body: "Your item was handed over. The custody record is closed.",
    link: `/claims/${handover.claimId}`,
  });

  return json({ ok: true, handoverId: handover._id });
});
