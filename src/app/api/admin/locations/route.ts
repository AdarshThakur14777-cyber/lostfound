import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { badRequest, handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { randomId } from "@/lib/crypto";
import { locations } from "@/models/collections";
import { loadTaxonomy } from "@/lib/taxonomy";
import { toPublicLocation } from "@/lib/serialize/public";
import type { LocationDoc } from "@/models/types";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const db = await getDb();
  const [docs, tax] = await Promise.all([locations(db).find({}).sort({ name: 1 }).toArray(), loadTaxonomy(db)]);
  return json({ locations: docs.map((doc) => toPublicLocation(doc, tax.lookup)) });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  parentId: z.string().nullish(),
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["admin", "sysadmin"]);
  const body = createSchema.parse(await req.json());
  const db = await getDb();

  let path: string[] = [];
  if (body.parentId) {
    const parent = await locations(db).findOne({ _id: body.parentId });
    if (!parent) throw badRequest("Unknown parent location");
    path = [...parent.path, parent._id];
  }
  const doc: LocationDoc = {
    _id: randomId(6),
    name: body.name,
    parentId: body.parentId ?? null,
    path,
    createdAt: new Date(),
  };
  await locations(db).insertOne(doc);
  void user;
  const tax = await loadTaxonomy(db);
  return json({ location: toPublicLocation(doc, tax.lookup) }, 201);
});
