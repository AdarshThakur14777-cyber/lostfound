import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/db";
import { C } from "../src/models/collections";
import { ITEM_STATUSES, type AuditEntryDoc, type ItemStatus } from "../src/models/types";
import { request } from "./helpers";
import {
  FORBIDDEN_PUBLIC_KEYS,
  findForbidden,
  findSecretValues,
  makeUser,
  resetDb,
  seedItem,
  seedTaxonomy,
} from "./helpers";

/**
 * Spec section 8/15: "the public board endpoint must be covered by an explicit
 * test asserting that no private field ever appears in its response, for every
 * item state."
 *
 * This test walks EVERY item state through /api/board (default, per-state and
 * state=all) and /api/items/:id, then recursively scans the JSON for forbidden
 * key names and for the literal secret values / ciphertexts / user identity.
 */

const SECRET_QUESTIONS: [string, string][] = [
  ["What is written on the sticker inside the case?", "secret-code-47"],
  ["What colour is the wallpaper?", "sunset-orange-99"],
];

describe("public redaction", () => {
  const itemIdsByState = new Map<ItemStatus, string>();
  let ciphertexts: string[] = [];
  let userEmail = "";
  let userPhone = "";

  beforeAll(async () => {
    await resetDb();
    await seedTaxonomy();
    const finder = await makeUser({ name: "Finder Jane", role: "staff" });
    userEmail = finder.email;
    userPhone = finder.phone ?? "";

    for (const status of ITEM_STATUSES) {
      const item = await seedItem({
        reporterId: finder._id,
        status,
        title: `Item in state ${status} with marks`,
        description: "Black bag with a distinctive patch and scratches near the zipper.",
        privateDetails: SECRET_QUESTIONS,
      });
      itemIdsByState.set(status, item._id);
    }

    const db = await getDb();
    const details = await db
      .collection<{ entries: { answerEnc: string; questionEnc: string }[] }>(C.privateDetails)
      .find({})
      .toArray();
    ciphertexts = details.flatMap((doc) =>
      doc.entries.flatMap((entry) => [entry.answerEnc, entry.questionEnc]),
    );

    // Something that must never leak through a public projection either.
    await db.collection<AuditEntryDoc>(C.audit).insertOne({
      _id: "audit-1",
      at: new Date(),
      actorId: finder._id,
      actorRole: "staff",
      action: "test",
      entityType: "item",
      entityId: "x",
      meta: { internal: "internal-audit-note" },
    });
  });

  const secrets = () => [
    ...SECRET_QUESTIONS.map(([, answer]) => answer),
    ...SECRET_QUESTIONS.map(([question]) => question),
    userEmail,
    userPhone,
    ...ciphertexts,
    "internal-audit-note",
  ];

  async function assertClean(payload: unknown, context: string) {
    const badKeys = findForbidden(payload, FORBIDDEN_PUBLIC_KEYS);
    expect(badKeys, `${context}: forbidden keys -> ${badKeys.join(", ")}`).toEqual([]);
    const leaked = findSecretValues(payload, secrets());
    expect(leaked, `${context}: leaked values -> ${leaked.join(", ")}`).toEqual([]);
  }

  it("boards stay clean for every item state (state=<state>)", async () => {
    for (const status of ITEM_STATUSES) {
      const res = await request(`/api/board?state=${status}&limit=50`);
      expect(res.status, `state=${status}`).toBe(200);
      const body = await res.json();
      await assertClean(body, `board state=${status}`);
      for (const item of body.items) expect(item.redacted).toBe(true);
      const ids = body.items.map((item: { id: string }) => item.id);
      expect(ids, `state=${status} must return its item`).toContain(itemIdsByState.get(status));
    }
  });

  it("boards stay clean for the default view and for state=all", async () => {
    for (const query of ["", "&state=all", "&state=default", "&q=marks", "&type=found", "&type=lost"]) {
      const res = await request(`/api/board?limit=50${query}`);
      expect(res.status, query).toBe(200);
      await assertClean(await res.json(), `board ${query || "(default)"}`);
    }
  });

  it("item detail stays clean for every item state", async () => {
    for (const status of ITEM_STATUSES) {
      const id = itemIdsByState.get(status)!;
      const res = await request(`/api/items/${id}`);
      expect(res.status, `item ${status}`).toBe(200);
      const body = await res.json();
      expect(body.status).toBe(status);
      await assertClean(body, `item detail ${status}`);
      expect(Object.keys(body)).not.toContain("privateDetails");
      expect(Object.keys(body)).not.toContain("reporterId");
    }
  });

  it("the public taxonomy view carries no user or private data", async () => {
    const res = await request("/api/taxonomy");
    expect(res.status).toBe(200);
    await assertClean(await res.json(), "taxonomy");
  });

  it("private details really are stored encrypted, never in plaintext", async () => {
    const db = await getDb();
    const raw = await db.collection(C.privateDetails).find({}).toArray();
    expect(raw.length).toBeGreaterThan(0);
    const flat = JSON.stringify(raw);
    for (const [, answer] of SECRET_QUESTIONS) {
      expect(flat).not.toContain(answer);
    }
    // The item collection must not carry them either.
    const itemsJson = JSON.stringify(await db.collection(C.items).find({}).toArray());
    for (const [, answer] of SECRET_QUESTIONS) expect(itemsJson).not.toContain(answer);
  });
});
