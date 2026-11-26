import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { badRequest, forbidden, handler, json } from "@/lib/http";
import { isModerator, requireUser } from "@/lib/auth";
import { encrypt, randomId } from "@/lib/crypto";
import { refreshMatchesFor } from "@/lib/matching/suggest";
import { appendCustody } from "@/lib/custody";
import { isImagePath } from "@/lib/upload";
import { loadTaxonomy } from "@/lib/taxonomy";
import { toPublicItem } from "@/lib/serialize/public";
import { categories, claims, custody, items, locations, matches, privateDetails } from "@/models/collections";
import type { ItemDoc } from "@/models/types";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  type: z.enum(["lost", "found"]),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
  categoryId: z.string().min(1),
  locationId: z.string().min(1),
  occurredAt: z.string().min(4).max(40),
  attributes: z.record(z.string(), z.string()).default({}),
  images: z.array(z.string()).max(6).default([]),
  privateDetails: z
    .array(
      z.object({
        question: z.string().trim().min(3).max(200),
        answer: z.string().trim().min(1).max(200),
      }),
    )
    .max(8)
    .default([]),
});

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = createSchema.parse(await req.json());

  if (body.type === "found" && body.privateDetails.length === 0) {
    throw badRequest(
      "Add at least one secret detail - only the real owner will know the answer",
    );
  }

  const db = await getDb();
  const [category, location] = await Promise.all([
    categories(db).findOne({ _id: body.categoryId }),
    locations(db).findOne({ _id: body.locationId }),
  ]);
  if (!category) throw badRequest("Unknown category");
  if (!location) throw badRequest("Unknown location");

  const occurredAt = new Date(body.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw badRequest("Invalid date/time");

  const now = new Date();
  const item: ItemDoc = {
    _id: randomId(9),
    type: body.type,
    title: body.title,
    description: body.description,
    categoryId: body.categoryId,
    locationId: body.locationId,
    occurredAt,
    attributes: body.attributes,
    images: body.images.filter(isImagePath),
    status: "open",
    reporterId: user.sub,
    hasPrivateDetails: body.privateDetails.length > 0,
    createdAt: now,
    updatedAt: now,
  };

  if (body.type === "found") {
    item.custody = { locationId: body.locationId, holderId: user.sub, since: now };
  }

  await items(db).insertOne(item);

  if (body.privateDetails.length > 0) {
    await privateDetails(db).insertOne({
      _id: item._id,
      itemId: item._id,
      ownerUserId: user.sub,
      entries: body.privateDetails.map((entry) => ({
        id: randomId(6),
        questionEnc: encrypt(entry.question),
        answerEnc: encrypt(entry.answer),
      })),
      updatedAt: now,
    });
  }

  if (body.type === "found") {
    await appendCustody(db, {
      itemId: item._id,
      action: "reported",
      actorId: user.sub,
      toLocationId: body.locationId,
      toHolderId: user.sub,
      note: "Report submitted through the campus app",
    });
  }

  await refreshMatchesFor(db, item._id, { notify: true });

  const tax = await loadTaxonomy(db);
  return json(toPublicItem(item, tax.lookup), 201);
});

export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser(req);
  const db = await getDb();
  const scope = req.nextUrl.searchParams.get("scope") ?? "mine";

  if (scope === "all" && !isModerator(user.role)) throw forbidden();

  const filter = scope === "all" ? {} : { reporterId: user.sub };
  const [docs, tax] = await Promise.all([
    items(db).find(filter).sort({ createdAt: -1 }).limit(200).toArray(),
    loadTaxonomy(db),
  ]);
  const ids = docs.map((doc) => doc._id);
  const [claimDocs, matchCount, custodyCount] = await Promise.all([
    claims(db).find({ itemId: { $in: ids } }).toArray(),
    matches(db).aggregate<{ _id: string; count: number }>([
      { $match: { itemId: { $in: ids } } },
      { $group: { _id: "$itemId", count: { $sum: 1 } } },
    ]).toArray(),
    custody(db).aggregate<{ _id: string; count: number }>([
      { $match: { itemId: { $in: ids } } },
      { $group: { _id: "$itemId", count: { $sum: 1 } } },
    ]).toArray(),
  ]);

  const claimsByItem = new Map<string, typeof claimDocs>();
  for (const claim of claimDocs) {
    const list = claimsByItem.get(claim.itemId) ?? [];
    list.push(claim);
    claimsByItem.set(claim.itemId, list);
  }
  const matchMap = new Map(matchCount.map((entry) => [entry._id, entry.count]));
  const custodyMap = new Map(custodyCount.map((entry) => [entry._id, entry.count]));
  const claimantIds = [...new Set(claimDocs.map((claim) => claim.claimantId))];
  const claimants = await db
    .collection<{ _id: string; name: string }>("users")
    .find({ _id: { $in: claimantIds } })
    .toArray();
  const claimantNames = new Map(claimants.map((entry) => [entry._id, entry.name]));

  return json({
    items: docs.map((doc) => ({
      ...toPublicItem(doc, tax.lookup),
      claimCount: claimsByItem.get(doc._id)?.length ?? 0,
      matchCount: matchMap.get(doc._id) ?? 0,
      custodyCount: custodyMap.get(doc._id) ?? 0,
      claims: (claimsByItem.get(doc._id) ?? []).map((claim) => ({
        id: claim._id,
        status: claim.status,
        passed: claim.passed,
        attempts: claim.attempts,
        claimantName: claimantNames.get(claim.claimantId) ?? "Claimant",
        createdAt: claim.createdAt.toISOString(),
        note: claim.note,
      })),
    })),
  });
});
