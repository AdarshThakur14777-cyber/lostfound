import type { Db } from "mongodb";
import { custody, handovers, items, audit, claims } from "@/models/collections";
import type { CustodyAction, CustodyRecordDoc, HandoverDoc } from "@/models/types";
import { badRequest, conflict, forbidden } from "./http";

export interface CustodyInput {
  itemId: string;
  action: CustodyAction;
  actorId: string;
  fromLocationId?: string;
  toLocationId?: string;
  fromHolderId?: string | null;
  toHolderId?: string | null;
  note?: string;
  proofImage?: string;
}

/** Appends to the immutable custody chain (seq is per item, monotonic). */
export async function appendCustody(db: Db, input: CustodyInput): Promise<CustodyRecordDoc> {
  const count = await custody(db).countDocuments({ itemId: input.itemId });
  const record: CustodyRecordDoc = {
    _id: `${input.itemId}:${count + 1}`,
    itemId: input.itemId,
    seq: count + 1,
    action: input.action,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    fromHolderId: input.fromHolderId ?? undefined,
    toHolderId: input.toHolderId ?? undefined,
    actorId: input.actorId,
    at: new Date(),
    note: input.note,
    proofImage: input.proofImage,
  };
  await custody(db).insertOne(record);
  await audit(db).insertOne({
    _id: `${record._id}:audit`,
    at: record.at,
    actorId: input.actorId,
    actorRole: "system",
    action: `custody.${input.action}`,
    entityType: "item",
    entityId: input.itemId,
    meta: { seq: record.seq },
  });
  return record;
}

export async function chainFor(db: Db, itemId: string): Promise<CustodyRecordDoc[]> {
  return custody(db).find({ itemId }).sort({ seq: 1 }).toArray();
}

/**
 * Completes a supervised handover: the OTP (or the claimant's signature) plus a
 * proof photo are required, the item becomes `returned`, and the chain gets its
 * final `handed_over` link.
 */
export async function completeHandover(
  db: Db,
  handover: HandoverDoc,
  input: { actorId: string; otp?: string; signatureName?: string; proofImage?: string; note?: string },
): Promise<CustodyRecordDoc> {
  if (handover.status === "completed") throw conflict("Handover already completed");
  if (handover.status === "cancelled") throw conflict("Handover was cancelled");

  const now = new Date();
  if (handover.method === "otp") {
    if (!handover.otpHash || !handover.otpExpiresAt) throw badRequest("No OTP pending");
    if (handover.otpExpiresAt.getTime() < now.getTime()) throw badRequest("OTP expired");
    if ((handover.otpAttempts ?? 0) >= 5) throw badRequest("OTP locked, reissue required");
    const { hmac } = await import("./crypto");
    if (!input.otp || hmac(input.otp, `otp:${handover._id}`) !== handover.otpHash) {
      await handovers(db).updateOne({ _id: handover._id }, { $inc: { otpAttempts: 1 } });
      throw forbidden("Incorrect OTP");
    }
  } else {
    if (!input.signatureName?.trim()) throw badRequest("Signature required");
  }
  if (!input.proofImage) throw badRequest("Proof photo required");

  const item = await items(db).findOne({ _id: handover.itemId });
  if (!item) throw badRequest("Item missing");

  const previousHolder = item.custody?.holderId ?? null;
  const previousLocation = item.custody?.locationId;

  await items(db).updateOne(
    { _id: item._id },
    {
      $set: {
        status: "returned",
        returnedToUserId: handover.claimantId,
        returnedAt: now,
        updatedAt: now,
        custody: {
          locationId: previousLocation ?? item.locationId,
          holderId: handover.claimantId,
          since: now,
        },
      },
    },
  );

  const record = await appendCustody(db, {
    itemId: item._id,
    action: "handed_over",
    actorId: input.actorId,
    fromHolderId: previousHolder,
    toHolderId: handover.claimantId,
    toLocationId: previousLocation ?? item.locationId,
    note: input.note ?? (handover.method === "otp" ? "OTP verified" : `Signed by ${input.signatureName}`),
    proofImage: input.proofImage,
  });

  await handovers(db).updateOne(
    { _id: handover._id },
    {
      $set: {
        status: "completed",
        completedAt: now,
        proofImage: input.proofImage,
        signatureName: input.signatureName,
      },
    },
  );

  await claims(db).updateOne({ _id: handover.claimId }, { $set: { status: "handed_over" } });

  await audit(db).insertOne({
    _id: `handover:${handover._id}`,
    at: now,
    actorId: input.actorId,
    actorRole: "system",
    action: "handover.completed",
    entityType: "handover",
    entityId: handover._id,
    meta: { itemId: item._id, method: handover.method },
  });

  return record;
}
