import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { conflict, handler, json, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";
import { notify, writeAudit } from "@/lib/audit";
import { disposals, items } from "@/models/collections";

export const dynamic = "force-dynamic";

const schema = z.object({
  method: z.enum(["discarded", "donated", "returned_to_originator", "archive"]),
  notes: z.string().trim().max(500).optional(),
});

/** POST - records the disposal of an aged, unclaimed item. */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req, ["security", "admin", "sysadmin"]);
  const body = schema.parse(await req.json());
  const db = await getDb();

  const item = await items(db).findOne({ _id: id });
  if (!item) throw notFound("Item not found");
  if (item.status === "disposed") throw conflict("Item already disposed");
  if (item.status !== "disposal_pending") throw conflict("Item is not in the disposal queue");

  const now = new Date();
  await disposals(db).insertOne({
    _id: randomId(8),
    itemId: item._id,
    reason: "unclaimed",
    dueAt: item.updatedAt,
    disposedAt: now,
    disposedById: user.sub,
    method: body.method,
    notes: body.notes,
  });
  await items(db).updateOne({ _id: item._id }, { $set: { status: "disposed", updatedAt: now } });

  await notify(db, {
    userId: item.reporterId,
    type: "disposal",
    title: "Item disposed",
    body: `"${item.title}" was disposed (${body.method.replace(/_/g, " ")}).`,
    link: `/items/${item._id}`,
  });
  await writeAudit(db, {
    actorId: user.sub,
    actorRole: user.role,
    action: "item.disposed",
    entityType: "item",
    entityId: item._id,
    meta: { method: body.method },
  });

  return json({ ok: true });
});
