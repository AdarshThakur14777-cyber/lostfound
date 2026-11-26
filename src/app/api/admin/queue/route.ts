import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { claims, items, locations, users } from "@/models/collections";
import { getSettings, retentionDaysFor } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Operational queue: ageing/disposal, verification review, custody inventory. */
export const GET = handler(async (req: NextRequest) => {
  await requireUser(req, ["security", "admin", "sysadmin"]);
  const db = await getDb();
  const now = Date.now();
  const cfg = await getSettings(db);

  const [pending, disposalDocs, claimQueue, locDocs, catDocs] = await Promise.all([
    items(db)
      .find({ status: { $in: ["open", "claim_pending"] } })
      .sort({ createdAt: 1 })
      .limit(300)
      .toArray(),
    items(db).find({ status: "disposal_pending" }).sort({ updatedAt: 1 }).toArray(),
    claims(db)
      .find({ status: { $in: ["pending", "verification_passed"] } })
      .sort({ createdAt: 1 })
      .limit(100)
      .toArray(),
    locations(db).find({}).toArray(),
    db.collection<{ _id: string; name: string; retentionDays?: number }>("categories").find({}).toArray(),
  ]);

  const locNames = new Map(locDocs.map((doc) => [doc._id, doc.name]));
  const catRetention = new Map(catDocs.map((doc) => [doc._id, doc.retentionDays]));
  const catNames = new Map(catDocs.map((doc) => [doc._id, doc.name]));

  const ageing = [];
  for (const item of pending) {
    const days = Math.floor((now - item.createdAt.getTime()) / 86_400_000);
    const retention = retentionDaysFor(cfg, catRetention.get(item.categoryId));
    const remaining = retention - days;
    if (remaining <= cfg.ageingWarningDays) {
      ageing.push({
        id: item._id,
        title: item.title,
        type: item.type,
        category: catNames.get(item.categoryId) ?? "",
        location: locNames.get(item.locationId) ?? "",
        ageDays: days,
        remainingDays: remaining,
        due: remaining <= 0,
      });
    }
  }

  const inventory = new Map<string, number>();
  for (const item of [...pending, ...disposalDocs]) {
    const key = item.custody?.locationId ?? item.locationId;
    inventory.set(key, (inventory.get(key) ?? 0) + 1);
  }

  const claimantIds = [...new Set(claimQueue.map((claim) => claim.claimantId))];
  const claimants = await users(db).find({ _id: { $in: claimantIds } }).toArray();
  const claimantNames = new Map(claimants.map((doc) => [doc._id, doc.name]));
  const claimItemIds = [...new Set(claimQueue.map((claim) => claim.itemId))];
  const claimItems = await items(db).find({ _id: { $in: claimItemIds } }).toArray();
  const claimItemTitles = new Map(claimItems.map((doc) => [doc._id, doc.title]));

  return json({
    ageing,
    disposalQueue: disposalDocs.map((item) => ({
      id: item._id,
      title: item.title,
      type: item.type,
      category: catNames.get(item.categoryId) ?? "",
      location: locNames.get(item.locationId) ?? "",
      ageDays: Math.floor((now - item.createdAt.getTime()) / 86_400_000),
      queuedAt: item.updatedAt.toISOString(),
    })),
    verificationQueue: claimQueue.map((claim) => ({
      id: claim._id,
      itemId: claim.itemId,
      itemTitle: claimItemTitles.get(claim.itemId) ?? "Item",
      claimantName: claimantNames.get(claim.claimantId) ?? "Claimant",
      status: claim.status,
      passed: claim.passed,
      attempts: claim.attempts,
      createdAt: claim.createdAt.toISOString(),
    })),
    custodyInventory: [...inventory.entries()]
      .map(([locationId, count]) => ({ locationId, name: locNames.get(locationId) ?? "Unknown", count }))
      .sort((a, b) => b.count - a.count),
  });
});
