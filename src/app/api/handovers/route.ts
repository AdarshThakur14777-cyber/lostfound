import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { badRequest, conflict, handler, json, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { generateOtp, hmac, randomId } from "@/lib/crypto";
import { notify } from "@/lib/audit";
import { claims, handovers, items, users } from "@/models/collections";
import type { HandoverDoc } from "@/models/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  claimId: z.string().min(1),
  method: z.enum(["otp", "signature"]),
});

/** POST - security schedules a supervised handover for an approved claim. */
export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["security", "admin", "sysadmin"]);
  const body = createSchema.parse(await req.json());
  const db = await getDb();

  const claim = await claims(db).findOne({ _id: body.claimId });
  if (!claim) throw notFound("Claim not found");
  if (claim.status !== "approved") throw conflict("Claim must be approved before handover");

  const existing = await handovers(db).findOne({ claimId: claim._id, status: { $ne: "cancelled" } });
  if (existing) throw conflict("A handover already exists for this claim");

  const now = new Date();
  const handover: HandoverDoc = {
    _id: randomId(9),
    claimId: claim._id,
    itemId: claim.itemId,
    claimantId: claim.claimantId,
    securityId: user.sub,
    method: body.method,
    status: "scheduled",
    createdAt: now,
    otpAttempts: 0,
  };

  if (body.method === "otp") {
    const otp = generateOtp();
    handover.otpHash = hmac(otp, `otp:${handover._id}`);
    handover.otpExpiresAt = new Date(now.getTime() + 15 * 60_000);
    await handovers(db).insertOne(handover);
    await notify(db, {
      userId: claim.claimantId,
      type: "handover_scheduled",
      title: "Handover scheduled - your one-time code",
      body: `Show this code to the officer at handover: ${otp}. It expires in 15 minutes.`,
      link: `/claims/${claim._id}`,
    });
  } else {
    await handovers(db).insertOne(handover);
    await notify(db, {
      userId: claim.claimantId,
      type: "handover_scheduled",
      title: "Handover scheduled",
      body: "Bring your student/staff ID. You will sign for the item at handover.",
      link: `/claims/${claim._id}`,
    });
  }

  return json({ id: handover._id, method: handover.method, status: handover.status, expiresAt: handover.otpExpiresAt?.toISOString() ?? null }, 201);
});

interface HandoverRow {
  id: string;
  claimId: string;
  itemId: string;
  status: HandoverDoc["status"];
  method: HandoverDoc["method"];
  createdAt: string;
  completedAt: string | null;
  itemTitle: string;
  itemImages: string[];
  claimantName: string;
  claimantEmail: string;
  securityName: string;
}

/** GET - handover queue (security only). */
export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["security", "admin", "sysadmin"]);
  const db = await getDb();
  const status = (req.nextUrl.searchParams.get("status") ?? "scheduled") as HandoverDoc["status"] | "all";
  const docs = await handovers(db)
    .find(status === "all" ? {} : { status })
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  const rows: HandoverRow[] = [];
  for (const doc of docs) {
    const [item, claimant, security] = await Promise.all([
      items(db).findOne({ _id: doc.itemId }),
      users(db).findOne({ _id: doc.claimantId }),
      users(db).findOne({ _id: doc.securityId }),
    ]);
    rows.push({
      id: doc._id,
      claimId: doc.claimId,
      itemId: doc.itemId,
      status: doc.status,
      method: doc.method,
      createdAt: doc.createdAt.toISOString(),
      completedAt: doc.completedAt?.toISOString() ?? null,
      itemTitle: item?.title ?? "Item",
      itemImages: item?.images ?? [],
      claimantName: claimant?.name ?? "Claimant",
      claimantEmail: claimant?.email ?? "",
      securityName: security?.name ?? "",
    });
  }
  return json({ handovers: rows, viewerRole: user.role });
});
