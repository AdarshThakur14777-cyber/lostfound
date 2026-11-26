/**
 * Matching engine - pure, deterministic scoring between a lost report and a
 * found report. Text + attributes + location tree + time proximity; no vision
 * model (see spec section 7).
 */

export interface ScoreableItem {
  title: string;
  description: string;
  categoryId: string;
  locationId: string;
  occurredAt: Date;
  attributes: Record<string, string>;
}

export interface ScoreContext {
  locationPaths: Map<string, string[]>;
  categoryParents: Map<string, string | null>;
  timeHalfLifeDays: number;
}

export interface PairScore {
  score: number;
  parts: {
    text: number;
    category: number;
    location: number;
    time: number;
    attributes: number;
  };
  reasons: string[];
}

export const WEIGHTS = { text: 0.35, category: 0.2, location: 0.2, time: 0.15, attributes: 0.1 };

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "is", "it",
  "my", "i", "this", "that", "was", "were", "be", "by", "from", "as", "so", "but", "not",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function weightedTokens(item: ScoreableItem): Map<string, number> {
  const weights = new Map<string, number>();
  const add = (token: string, w: number) => weights.set(token, (weights.get(token) ?? 0) + w);
  for (const t of tokenize(item.title)) add(t, 2);
  for (const t of tokenize(item.description)) add(t, 1);
  return weights;
}

/** Weighted Dice coefficient over title/description tokens. */
export function textSimilarity(a: ScoreableItem, b: ScoreableItem): number {
  const wa = weightedTokens(a);
  const wb = weightedTokens(b);
  if (wa.size === 0 && wb.size === 0) return 0;
  let overlap = 0;
  let totalA = 0;
  let totalB = 0;
  for (const w of wa.values()) totalA += w;
  for (const w of wb.values()) totalB += w;
  for (const [token, w] of wa) {
    const other = wb.get(token);
    if (other) overlap += Math.min(w, other);
  }
  return totalA + totalB === 0 ? 0 : (2 * overlap) / (totalA + totalB);
}

function ancestorChain(
  id: string | null,
  parents: Map<string, string | null>,
  limit = 12,
): string[] {
  const chain: string[] = [];
  let current = id;
  while (current && chain.length < limit) {
    chain.push(current);
    current = parents.get(current) ?? null;
  }
  return chain;
}

export function categorySimilarity(
  aId: string,
  bId: string,
  parents: Map<string, string | null>,
): number {
  if (aId === bId) return 1;
  const chain = ancestorChain(aId, parents);
  const chainB = new Set(ancestorChain(bId, parents));
  const shared = chain.filter((id) => chainB.has(id)).length;
  if (shared === 0) return 0;
  return shared > 1 ? 0.75 : 0.5;
}

export function locationSimilarity(
  aId: string,
  bId: string,
  paths: Map<string, string[]>,
): number {
  if (aId === bId) return 1;
  // Paths hold ancestors only, so include the node itself when comparing.
  const pa = [...(paths.get(aId) ?? [aId]), aId];
  const pb = [...(paths.get(bId) ?? [bId]), bId];
  let lca = 0;
  while (lca < pa.length && lca < pb.length && pa[lca] === pb[lca]) lca += 1;
  if (lca === 0) return 0;
  return lca / Math.max(pa.length, pb.length);
}

export function timeSimilarity(a: Date, b: Date, halfLifeDays: number): number {
  const days = Math.abs(a.getTime() - b.getTime()) / 86_400_000;
  return Math.pow(2, -days / Math.max(0.1, halfLifeDays));
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function attributeSimilarity(
  a: Record<string, string>,
  b: Record<string, string>,
): number {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length === 0 && keysB.length === 0) return 0;
  let matches = 0;
  for (const key of keysA) {
    if (key in b && normalizeValue(a[key]) === normalizeValue(b[key])) matches += 1;
  }
  return (2 * matches) / (keysA.length + keysB.length);
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function scorePair(
  a: ScoreableItem,
  b: ScoreableItem,
  ctx: ScoreContext,
  names?: { category?: (id: string) => string; location?: (id: string) => string },
): PairScore {
  const parts = {
    text: textSimilarity(a, b),
    category: categorySimilarity(a.categoryId, b.categoryId, ctx.categoryParents),
    location: locationSimilarity(a.locationId, b.locationId, ctx.locationPaths),
    time: timeSimilarity(a.occurredAt, b.occurredAt, ctx.timeHalfLifeDays),
    attributes: attributeSimilarity(a.attributes, b.attributes),
  };
  const score =
    parts.text * WEIGHTS.text +
    parts.category * WEIGHTS.category +
    parts.location * WEIGHTS.location +
    parts.time * WEIGHTS.time +
    parts.attributes * WEIGHTS.attributes;

  const reasons: string[] = [];
  if (parts.text >= 0.25) reasons.push(`similar wording (${pct(parts.text)})`);
  if (parts.category >= 0.5) {
    const label = names?.category?.(a.categoryId);
    reasons.push(label ? `same category: ${label}` : "same category");
  }
  if (parts.location >= 0.5) {
    const label = names?.location?.(a.locationId);
    reasons.push(label ? `nearby location: ${label}` : "nearby location");
  }
  if (parts.time >= 0.4) {
    const days = Math.abs(a.occurredAt.getTime() - b.occurredAt.getTime()) / 86_400_000;
    reasons.push(
      days < 1 ? "reported the same day" : `reported ${Math.round(days)} day${days >= 2 ? "s" : ""} apart`,
    );
  }
  if (parts.attributes >= 0.5) reasons.push(`matching attributes (${pct(parts.attributes)})`);
  if (reasons.length === 0) reasons.push(`overall similarity (${pct(score)})`);

  return { score, parts, reasons };
}
