import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { handler, json, notFound } from "@/lib/http";
import { items } from "@/models/collections";
import { loadTaxonomy } from "@/lib/taxonomy";
import { toPublicItem } from "@/lib/serialize/public";

export const dynamic = "force-dynamic";

/** Public, redacted item detail - works for every item state. */
export const GET = handler(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const db = await getDb();
  const item = await items(db).findOne({ _id: id });
  if (!item) throw notFound("Item not found");
  const tax = await loadTaxonomy(db);
  return json(toPublicItem(item, tax.lookup));
});
