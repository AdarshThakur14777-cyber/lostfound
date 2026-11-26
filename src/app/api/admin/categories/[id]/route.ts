import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { conflict, handler, json, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { categories, items } from "@/models/collections";
import { toPublicCategory } from "@/lib/serialize/public";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  attributes: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  retentionDays: z.number().int().min(1).max(365).nullish(),
});

export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireUser(req, ["admin", "sysadmin"]);
  const body = patchSchema.parse(await req.json());
  const db = await getDb();
  const existing = await categories(db).findOne({ _id: id });
  if (!existing) throw notFound("Category not found");
  await categories(db).updateOne(
    { _id: id },
    { $set: { name: body.name ?? existing.name, attributes: body.attributes ?? existing.attributes, retentionDays: body.retentionDays ?? existing.retentionDays } },
  );
  const updated = await categories(db).findOne({ _id: id });
  return json({ category: toPublicCategory(updated!) });
});

export const DELETE = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireUser(req, ["admin", "sysadmin"]);
  const db = await getDb();
  const inUse = await items(db).findOne({ categoryId: id });
  if (inUse) throw conflict("Category is in use by existing reports");
  const result = await categories(db).deleteOne({ _id: id });
  if (result.deletedCount === 0) throw notFound("Category not found");
  return json({ ok: true });
});
