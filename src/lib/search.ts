import type { Db, Filter } from "mongodb";
import type { ItemDoc, ItemStatus } from "@/models/types";

export const DEFAULT_BOARD_STATES: ItemStatus[] = [
  "open",
  "claim_pending",
  "in_custody",
  "returned",
  "disposal_pending",
  "expired",
];

export interface BoardQuery {
  type?: string;
  category?: string;
  location?: string;
  state?: string;
  q?: string;
  before?: string;
  limit?: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildBoardFilter(query: BoardQuery): Filter<ItemDoc> {
  const filter: Filter<ItemDoc> = {};

  if (query.state === "all") {
    // no status filter - used by the exhaustive redaction test
  } else if (query.state && query.state !== "default") {
    filter.status = query.state as ItemStatus;
  } else {
    filter.status = { $in: DEFAULT_BOARD_STATES };
  }

  if (query.type === "lost" || query.type === "found") filter.type = query.type;
  if (query.category) filter.categoryId = query.category;
  if (query.location) filter.locationId = query.location;
  if (query.q && query.q.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), "i");
    filter.$or = [{ title: rx }, { description: rx }];
  }
  if (query.before) {
    const before = new Date(query.before);
    if (!Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };
  }
  return filter;
}

export function boardLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 12;
  return Math.min(48, Math.max(1, Math.floor(n)));
}
