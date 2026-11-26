import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { forbidden, handler, json, notFound } from "@/lib/http";
import { isModerator, requireUser } from "@/lib/auth";
import { loadTaxonomy } from "@/lib/taxonomy";
import { toPublicItem } from "@/lib/serialize/public";
import { items, matches } from "@/models/collections";

export const dynamic = "force-dynamic";

/** Match suggestions for a report - visible to its reporter and to staff. */
export const GET = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const db = await getDb();

  const item = await items(db).findOne({ _id: id });
  if (!item) throw notFound("Item not found");
  if (item.reporterId !== user.sub && !isModerator(user.role)) throw forbidden();

  const [suggestions, tax] = await Promise.all([
    matches(db).find({ itemId: id }).sort({ score: -1 }).toArray(),
    loadTaxonomy(db),
  ]);
  const others = await items(db)
    .find({ _id: { $in: suggestions.map((entry) => entry.otherItemId) } })
    .toArray();
  const byId = new Map(others.map((doc) => [doc._id, doc]));

  return json({
    matches: suggestions.map((entry) => {
      const other = byId.get(entry.otherItemId);
      return {
        id: entry._id,
        score: Math.round(entry.score * 100) / 100,
        reasons: entry.reasons,
        status: entry.status,
        item: other ? toPublicItem(other, tax.lookup) : null,
      };
    }),
  });
});
