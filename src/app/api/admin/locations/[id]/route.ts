import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { conflict, handler, json, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { items, locations } from "@/models/collections";
import { loadTaxonomy } from "@/lib/taxonomy";
import { toPublicLocation } from "@/lib/serialize/public";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ name: z.string().trim().min(2).max(80).optional() });

export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireUser(req, ["admin", "sysadmin"]);
  const body = patchSchema.parse(await req.json());
  const db = await getDb();
  const existing = await locations(db).findOne({ _id: id });
  if (!existing) throw notFound("Location not found");
  await locations(db).updateOne({ _id: id }, { $set: { name: body.name ?? existing.name } });
  const tax = await loadTaxonomy(db);
  const updated = await locations(db).findOne({ _id: id });
  return json({ location: toPublicLocation(updated!, tax.lookup) });
});

export const DELETE = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireUser(req, ["admin", "sysadmin"]);
  const db = await getDb();
  const [inUse, child] = await Promise.all([
    items(db).findOne({ locationId: id }),
    locations(db).findOne({ parentId: id }),
  ]);
  if (inUse) throw conflict("Location is in use by existing reports");
  if (child) throw conflict("Location has child locations");
  const result = await locations(db).deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Location not found");
  return json({ ok: true });
});
