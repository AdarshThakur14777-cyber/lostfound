import type { Db } from "mongodb";
import { categories, locations } from "@/models/collections";
import type { ItemCategoryDoc, LocationDoc } from "@/models/types";
import type { TaxonomyLookup } from "./serialize/public";

export interface Taxonomy {
  categories: Map<string, ItemCategoryDoc>;
  locations: Map<string, LocationDoc>;
  lookup: TaxonomyLookup;
}

/** Loads the (small) taxonomy once per request and exposes name/path lookups. */
export async function loadTaxonomy(db: Db): Promise<Taxonomy> {
  const [catDocs, locDocs] = await Promise.all([
    categories(db).find({}).toArray(),
    locations(db).find({}).toArray(),
  ]);
  const categoriesMap = new Map(catDocs.map((doc) => [doc._id, doc]));
  const locationsMap = new Map(locDocs.map((doc) => [doc._id, doc]));

  const lookup: TaxonomyLookup = {
    categoryName: (id) => categoriesMap.get(id)?.name ?? "Uncategorised",
    locationName: (id) => locationsMap.get(id)?.name ?? "Unknown",
    locationPath: (id) => {
      const doc = locationsMap.get(id);
      if (!doc) return [];
      const names = doc.path.map((step) => locationsMap.get(step)?.name ?? step).filter((n) => n.length > 0);
      return [...names, doc.name];
    },
  };

  return { categories: categoriesMap, locations: locationsMap, lookup };
}
