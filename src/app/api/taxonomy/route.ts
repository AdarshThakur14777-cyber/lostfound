import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { categories, locations } from "@/models/collections";
import { loadTaxonomy } from "@/lib/taxonomy";
import { toPublicCategory, toPublicLocation } from "@/lib/serialize/public";

export const dynamic = "force-dynamic";

/** Public category tree and campus location picker data. */
export const GET = handler(async () => {
  const db = await getDb();
  const [catDocs, locDocs, tax] = await Promise.all([
    categories(db).find({}).sort({ name: 1 }).toArray(),
    locations(db).find({}).sort({ name: 1 }).toArray(),
    loadTaxonomy(db),
  ]);
  return json({
    categories: catDocs.map(toPublicCategory),
    locations: locDocs.map((loc) => toPublicLocation(loc, tax.lookup)),
  });
});
