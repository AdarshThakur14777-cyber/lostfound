import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { badRequest, forbidden, handler, json, notFound } from "@/lib/http";
import { isModerator, requireUser } from "@/lib/auth";
import { appendCustody } from "@/lib/custody";
import { isImagePath } from "@/lib/upload";
import { custody, items, locations, users } from "@/models/collections";
import type { CustodyAction } from "@/models/types";

export const dynamic = "force-dynamic";

/**
 * Custody chain. Read: the reporter and staff. Write: security/staff only -
 * every movement appends an immutable link.
 */
export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const db = await getDb();
  const item = await items(db).findOne({ _id: id });
  if (!item) throw notFound("Item not found");
  if (item.reporterId !== user.sub && !isModerator(user.role)) throw forbidden();

  const records = await custody(db).find({ itemId: id }).sort({ seq: 1 }).toArray();
  const actorIds = [...new Set(records.map((record) => record.actorId))];
  const holderIds = [
    ...new Set(records.flatMap((record) => [record.fromHolderId, record.toHolderId].filter(Boolean) as string[])),
  ];
  const [actors, holders, locDocs] = await Promise.all([
    users(db).find({ _id: { $in: actorIds } }).toArray(),
    users(db).find({ _id: { $in: holderIds } }).toArray(),
    locations(db).find({}).toArray(),
  ]);
  const actorNames = new Map(actors.map((doc) => [doc._id, doc.name]));
  const holderNames = new Map(holders.map((doc) => [doc._id, doc.name]));
  const locNames = new Map(locDocs.map((doc) => [doc._id, doc.name]));

  return json({
    records: records.map((record) => ({
      id: record._id,
      seq: record.seq,
      action: record.action,
      at: record.at.toISOString(),
      actorName: actorNames.get(record.actorId) ?? "System",
      fromLocation: record.fromLocationId ? locNames.get(record.fromLocationId) ?? "" : "",
      toLocation: record.toLocationId ? locNames.get(record.toLocationId) ?? "" : "",
      fromHolder: record.fromHolderId ? holderNames.get(record.fromHolderId) ?? "" : "",
      toHolder: record.toHolderId ? holderNames.get(record.toHolderId) ?? "" : "",
      note: record.note ?? "",
      proofImage: record.proofImage ?? null,
    })),
  });
});

const moveSchema = z.object({
  action: z.enum(["received", "moved", "transferred"]),
  toLocationId: z.string().min(1),
  note: z.string().trim().max(500).optional(),
  proofImage: z.string().optional(),
  holderId: z.string().optional(),
});

/** POST - staff records a custody movement. */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req, ["security", "admin", "sysadmin"]);
  const body = moveSchema.parse(await req.json());
  if (body.proofImage && !isImagePath(body.proofImage)) throw badRequest("Invalid proof image");

  const db = await getDb();
  const item = await items(db).findOne({ _id: id });
  if (!item) throw notFound("Item not found");
  const location = await locations(db).findOne({ _id: body.toLocationId });
  if (!location) throw badRequest("Unknown location");

  await appendCustody(db, {
    itemId: item._id,
    action: body.action as CustodyAction,
    actorId: user.sub,
    fromLocationId: item.custody?.locationId,
    toLocationId: body.toLocationId,
    fromHolderId: item.custody?.holderId ?? null,
    toHolderId: body.holderId ?? user.sub,
    note: body.note,
    proofImage: body.proofImage,
  });

  await items(db).updateOne(
    { _id: item._id },
    {
      $set: {
        custody: { locationId: body.toLocationId, holderId: body.holderId ?? user.sub, since: new Date() },
        updatedAt: new Date(),
        ...(item.status === "open" ? { status: "in_custody" } : {}),
      },
    },
  );

  return json({ ok: true }, 201);
});
