import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { badRequest, handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";
import { categories } from "@/models/collections";
import { toPublicCategory } from "@/lib/serialize/public";
import type { ItemCategoryDoc } from "@/models/types";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const db = await getDb();
  const docs = await categories(db).find({}).sort({ name: 1 }).toArray();
  return json({ categories: docs.map(toPublicCategory) });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  parentId: z.string().nullish(),
  attributes: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  retentionDays: z.number().int().min(1).max(365).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["admin", "sysadmin"]);
  const body = createSchema.parse(await req.json());
  const db = await getDb();
  if (body.parentId) {
    const parent = await categories(db).findOne({ _id: body.parentId });
    if (!parent) throw badRequest("Unknown parent category");
  }
  const doc: ItemCategoryDoc = {
    _id: randomId(6),
    name: body.name,
    parentId: body.parentId ?? null,
    attributes: body.attributes,
    retentionDays: body.retentionDays,
    createdAt: new Date(),
  };
  await categories(db).insertOne(doc);
  return json({ category: toPublicCategory(doc) }, 201);
});
