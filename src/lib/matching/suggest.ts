import type { Db } from "mongodb";
import { categories, items, locations, matches, notifications, settings } from "@/models/collections";
import type { ItemDoc, MatchSuggestionDoc } from "@/models/types";
import { scorePair, type ScoreContext, type ScoreableItem } from "./score";

async function buildContext(db: Db, halfLifeDays: number): Promise<ScoreContext> {
  const [allLocations, allCategories] = await Promise.all([locations(db).find({}).toArray(), categories(db).find({}).toArray()]);
  return {
    locationPaths: new Map(allLocations.map((l) => [l._id, l.path])),
    categoryParents: new Map(allCategories.map((c) => [c._id, c.parentId])),
    timeHalfLifeDays: halfLifeDays,
  };
}

function toScoreable(item: ItemDoc): ScoreableItem {
  return {
    title: item.title,
    description: item.description,
    categoryId: item.categoryId,
    locationId: item.locationId,
    occurredAt: item.occurredAt,
    attributes: item.attributes,
  };
}

export interface SuggestionWithItem {
  suggestion: MatchSuggestionDoc;
  item: ItemDoc;
}

/**
 * Recomputes suggestions for one item: every opposite-type open item is
 * scored, the top-K above threshold are stored, stale automatic suggestions
 * are removed. Called on report creation and by the nightly refresh.
 */
export async function refreshMatchesFor(
  db: Db,
  itemId: string,
  options: { notify?: boolean } = {},
): Promise<SuggestionWithItem[]> {
  const item = await items(db).findOne({ _id: itemId });
  if (!item) return [];

  const cfg = await settings(db).findOne({ _id: "main" });
  const threshold = cfg?.matchThreshold ?? 0.4;
  const topK = cfg?.matchTopK ?? 5;
  const ctx = await buildContext(db, cfg?.timeHalfLifeDays ?? 3);

  const counterpartType = item.type === "lost" ? "found" : "lost";
  const candidates = await items(db)
    .find({ type: counterpartType, status: { $in: ["open", "claim_pending"] }, _id: { $ne: item._id } })
    .toArray();

  const [catDocs, locDocs] = await Promise.all([categories(db).find({}).toArray(), locations(db).find({}).toArray()]);
  const catName = new Map(catDocs.map((c) => [c._id, c.name]));
  const locName = new Map(locDocs.map((l) => [l._id, l.name]));

  const scored = candidates
    .map((other) => ({
      other,
      result: scorePair(toScoreable(item), toScoreable(other), ctx, {
        category: (id) => catName.get(id) ?? "",
        location: (id) => locName.get(id) ?? "",
      }),
    }))
    .filter((entry) => entry.result.score >= threshold)
    .sort((x, y) => y.result.score - x.result.score)
    .slice(0, topK);

  const keepIds = new Set(scored.map((entry) => entry.other._id));
  const now = new Date();

  await matches(db).deleteMany({
    itemId: item._id,
    status: "auto",
    otherItemId: { $nin: [...keepIds] },
  });

  const fresh: SuggestionWithItem[] = [];
  for (const { other, result } of scored) {
    const existing = await matches(db).findOne({ itemId: item._id, otherItemId: other._id });
    if (existing) {
      await matches(db).updateOne(
        { _id: existing._id },
        { $set: { score: result.score, reasons: result.reasons, updatedAt: now } },
      );
      if (existing.status !== "dismissed") fresh.push({ suggestion: { ...existing, score: result.score }, item: other });
      continue;
    }
    const doc: MatchSuggestionDoc = {
      _id: `${item._id}:${other._id}`,
      itemId: item._id,
      otherItemId: other._id,
      score: result.score,
      reasons: result.reasons,
      status: "auto",
      createdAt: now,
      updatedAt: now,
    };
    await matches(db).insertOne(doc);
    fresh.push({ suggestion: doc, item: other });

    if (options.notify && result.score >= 0.6) {
      await notifications(db).insertOne({
        _id: `${doc._id}:n`,
        userId: item.reporterId,
        type: "possible_match",
        title: "Possible match found",
        body: `A ${other.type} report may match "${item.title}".`,
        link: `/items/${item._id}`,
        read: false,
        at: now,
      });
    }
  }
  return fresh;
}

/** Nightly pass over every active report. */
export async function refreshAllMatches(db: Db): Promise<{ checked: number; suggestions: number }> {
  const active = await items(db).find({ status: { $in: ["open", "claim_pending"] } }).toArray();
  let suggestions = 0;
  for (const item of active) {
    const result = await refreshMatchesFor(db, item._id);
    suggestions += result.length;
  }
  return { checked: active.length, suggestions };
}
