import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { claims, custody, disposals, items, matches } from "@/models/collections";
import { loadTaxonomy } from "@/lib/taxonomy";
import { getSettings, retentionDaysFor } from "@/lib/settings";

export const dynamic = "force-dynamic";

interface Stat {
  _id: string;
  count: number;
}

/** Admin dashboard data: inventory, ageing, return-rate and verification stats. */
export const GET = handler(async (req: NextRequest) => {
  await requireUser(req, ["admin", "sysadmin", "security"]);
  const db = await getDb();
  const now = Date.now();

  const [totals, byLocation, byCategory, returnedTimes, claimStats, disposalCount, cfg, tax] =
    await Promise.all([
      items(db)
        .aggregate<{ _id: { type: string; status: string }; count: number }>([
          { $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 } } },
        ])
        .toArray(),
      items(db)
        .aggregate<Stat>([
          { $match: { status: { $in: ["in_custody", "open", "claim_pending", "disposal_pending"] } } },
          { $group: { _id: "$locationId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      items(db)
        .aggregate<Stat>([{ $group: { _id: "$categoryId", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
        .toArray(),
      items(db)
        .find({ status: "returned", returnedAt: { $exists: true } })
        .project<{ createdAt: Date; returnedAt: Date }>({ createdAt: 1, returnedAt: 1 })
        .toArray(),
      claims(db)
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ])
        .toArray(),
      disposals(db).countDocuments(),
      getSettings(db),
      loadTaxonomy(db),
    ]);

  let lost = 0;
  let found = 0;
  let returned = 0;
  let disposed = 0;
  let open = 0;
  let inCustody = 0;
  let disposalPending = 0;
  const hotspots: { locationId: string; name: string; count: number }[] = [];
  const categoryDistribution: { categoryId: string; name: string; count: number }[] = [];

  for (const row of totals) {
    if (row._id.type === "lost") lost += row.count;
    if (row._id.type === "found") found += row.count;
    if (row._id.status === "returned") returned += row.count;
    if (row._id.status === "disposed") disposed += row.count;
    if (row._id.status === "open") open += row.count;
    if (row._id.status === "in_custody") inCustody += row.count;
    if (row._id.status === "disposal_pending") disposalPending += row.count;
  }

  for (const row of byLocation) {
    hotspots.push({
      locationId: row._id,
      name: tax.lookup.locationName(row._id),
      count: row.count,
    });
  }
  for (const row of byCategory) {
    categoryDistribution.push({
      categoryId: row._id,
      name: tax.lookup.categoryName(row._id),
      count: row.count,
    });
  }

  const reported = lost + found;
  const returnRate = reported === 0 ? 0 : returned / reported;

  const durations = returnedTimes
    .map((row) => (row.returnedAt.getTime() - row.createdAt.getTime()) / 3_600_000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0)
    .sort((a, b) => a - b);
  const medianHoursToReturn =
    durations.length === 0
      ? null
      : durations.length % 2 === 1
        ? durations[(durations.length - 1) / 2]
        : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2;

  const claimMap = new Map(claimStats.map((row) => [row._id, row.count]));
  const verificationAttempted =
    (claimMap.get("verification_passed") ?? 0) +
    (claimMap.get("verification_failed") ?? 0) +
    (claimMap.get("approved") ?? 0) +
    (claimMap.get("rejected") ?? 0) +
    (claimMap.get("handed_over") ?? 0);
  const verificationFailed = claimMap.get("verification_failed") ?? 0;

  const active = await items(db)
    .find({ status: { $in: ["open", "claim_pending"] } })
    .project<{ categoryId: string; createdAt: Date }>({ categoryId: 1, createdAt: 1 })
    .toArray();
  const categoryRetention = new Map(
    (await db
      .collection<{ _id: string; retentionDays?: number }>("categories")
      .find({})
      .toArray()).map((c) => [c._id, c.retentionDays]),
  );
  let dueForDisposal = 0;
  let ageingWarnings = 0;
  for (const item of active) {
    const days = (now - item.createdAt.getTime()) / 86_400_000;
    const retention = retentionDaysFor(cfg, categoryRetention.get(item.categoryId));
    if (days >= retention) dueForDisposal += 1;
    else if (days >= retention - cfg.ageingWarningDays) ageingWarnings += 1;
  }

  return json({
    totals: { reported, lost, found, returned, disposed, open, inCustody, disposalPending },
    returnRate,
    medianHoursToReturn,
    hotspots,
    categories: categoryDistribution,
    ageing: { dueForDisposal, ageingWarnings, retentionDays: cfg.retentionDays },
    verification: {
      attempted: verificationAttempted,
      failed: verificationFailed,
      failureRate: verificationAttempted === 0 ? 0 : verificationFailed / verificationAttempted,
      byStatus: Object.fromEntries(claimMap),
    },
    disposals: { recorded: disposalCount },
    pendingMatches: await matches(db).countDocuments({ status: "auto" }),
    custodyChainLength: await custody(db).estimatedDocumentCount(),
  });
});
