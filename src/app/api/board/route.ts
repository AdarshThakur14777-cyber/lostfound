import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { items } from "@/models/collections";
import { boardLimit, buildBoardFilter } from "@/lib/search";
import { loadTaxonomy } from "@/lib/taxonomy";
import { toPublicItem, toPublicListItem } from "@/lib/serialize/public";

export const dynamic = "force-dynamic";

/**
 * PUBLIC BOARD - no authentication, redacted by construction: the response is
 * built exclusively through `toPublicItem`/`toPublicListItem`, whose input type
 * contains no private fields (see src/lib/serialize/public.ts).
 */
export const GET = handler(async (req: NextRequest) => {
  const db = await getDb();
  const params = req.nextUrl.searchParams;
  const query = {
    type: params.get("type") ?? undefined,
    category: params.get("category") ?? undefined,
    location: params.get("location") ?? undefined,
    state: params.get("state") ?? undefined,
    q: params.get("q") ?? undefined,
    before: params.get("before") ?? undefined,
  };
  const limit = boardLimit(params.get("limit"));

  const [docs, tax] = await Promise.all([
    items(db)
      .find(buildBoardFilter(query))
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray(),
    loadTaxonomy(db),
  ]);

  const hasMore = docs.length > limit;
  const page = docs.slice(0, limit);
  const list = page.map((doc) => toPublicListItem(toPublicItem(doc, tax.lookup)));
  const last = page.at(-1);

  return json({
    items: list,
    nextCursor: hasMore && last ? last.createdAt.toISOString() : null,
  });
});
