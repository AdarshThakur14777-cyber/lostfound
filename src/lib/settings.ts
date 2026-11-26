import type { Db } from "mongodb";
import { items, settings } from "@/models/collections";
import { DEFAULT_SETTINGS, type SettingsDoc } from "@/models/types";

export async function getSettings(db: Db): Promise<SettingsDoc> {
  const existing = await settings(db).findOne({ _id: "main" });
  if (existing) return existing;
  const doc: SettingsDoc = { ...DEFAULT_SETTINGS, updatedAt: new Date() };
  await settings(db).updateOne({ _id: "main" }, { $setOnInsert: doc }, { upsert: true });
  return doc;
}

export async function updateSettings(
  db: Db,
  patch: Partial<Omit<SettingsDoc, "_id" | "updatedAt">>,
): Promise<SettingsDoc> {
  await settings(db).updateOne(
    { _id: "main" },
    { $set: { ...patch, updatedAt: new Date() } },
    { upsert: true },
  );
  return getSettings(db);
}

/** Retention for an item: category override, else global setting. */
export function retentionDaysFor(cfg: SettingsDoc, categoryRetention?: number): number {
  return categoryRetention && categoryRetention > 0 ? categoryRetention : cfg.retentionDays;
}

export interface AgeingResult {
  warned: string[];
  queued: string[];
}

/**
 * Unclaimed ageing: items past the warning window get a notification, items
 * past the retention window move to the disposal queue.
 */
export async function runAgeing(db: Db): Promise<AgeingResult> {
  const cfg = await getSettings(db);
  const categoryRetention = new Map(
    (await db.collection<{ _id: string; retentionDays?: number }>("categories").find({}).toArray()).map((c) => [
      c._id,
      c.retentionDays,
    ]),
  );
  const now = Date.now();
  const active = await items(db)
    .find({ status: { $in: ["open", "claim_pending"] } })
    .toArray();

  const warned: string[] = [];
  const queued: string[] = [];

  for (const item of active) {
    const days = (now - item.createdAt.getTime()) / 86_400_000;
    const retention = retentionDaysFor(cfg, categoryRetention.get(item.categoryId));
    const remaining = Math.ceil(retention - days);
    if (remaining <= 0) {
      await items(db).updateOne({ _id: item._id }, { $set: { status: "disposal_pending", updatedAt: new Date() } });
      queued.push(item._id);
    } else if (remaining <= cfg.ageingWarningDays && !warned.includes(item._id)) {
      warned.push(item._id);
    }
  }
  return { warned, queued };
}
