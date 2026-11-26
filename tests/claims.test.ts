import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/db";
import { claims, items, notifications } from "../src/models/collections";
import { request } from "./helpers";
import { answerKeyFor, makeUser, resetDb, seedItem, seedTaxonomy } from "./helpers";
import type { ItemDoc, UserDoc } from "../src/models/types";

describe("claim workflow with competing claims", () => {
  let finder: UserDoc;
  let security: UserDoc;
  let claimantA: UserDoc;
  let claimantB: UserDoc;
  let claimantC: UserDoc;
  let itemA: ItemDoc;
  let itemB: ItemDoc;

  const secrets: [string, string][] = [
    ["What is written inside the lid?", "maria-88"],
    ["How many stickers are on the back?", "three"],
  ];

  async function openClaim(user: UserDoc, target: ItemDoc, note: string) {
    const res = await request("/api/claims", {
      method: "POST",
      user: { sub: user._id, role: "student" },
      body: { itemId: target._id, note },
    });
    expect(res.status).toBe(201);
    return (await res.json()) as {
      claim: { id: string; questions: { entryId: string }[] };
      challenge: { questions: { entryId: string }[] };
    };
  }

  async function answerCorrectly(user: UserDoc, claimId: string, itemId: string, secrets: [string, string][]) {
    const db = await getDb();
    const claim = await claims(db).findOne({ _id: claimId });
    const challenge = await (await import("../src/models/collections")).challenges(db).findOne({
      _id: claim!.challengeId,
    });
    const key = await answerKeyFor(itemId, secrets);
    const res = await request(`/api/claims/${claimId}/verify`, {
      method: "POST",
      user: { sub: user._id, role: "student" },
      body: {
        answers: challenge!.questions.map((question) => ({
          entryId: question.entryId,
          answer: key.get(question.entryId) ?? "",
        })),
      },
    });
    expect(res.status).toBe(200);
    return (await res.json()) as { passed: boolean };
  }

  beforeAll(async () => {
    await resetDb();
    await seedTaxonomy();
    finder = await makeUser({ name: "Finder" });
    security = await makeUser({ name: "Officer", role: "security" });
    claimantA = await makeUser({ name: "Claimant A" });
    claimantB = await makeUser({ name: "Claimant B" });
    claimantC = await makeUser({ name: "Claimant C" });

    itemA = await seedItem({
      reporterId: finder._id,
      type: "found",
      title: "Found a grey water bottle",
      privateDetails: secrets,
    });
    itemB = await seedItem({
      reporterId: finder._id,
      type: "found",
      title: "Found a blue backpack",
      privateDetails: [["Inside pocket colour?", "yellow"]],
    });
  });

  it("accepts competing claims on the same item", async () => {
    const claimB = await openClaim(claimantB, itemA, "Mine - lost it after sports practice.");
    const claimA = await openClaim(claimantA, itemA, "Mine - it has my name inside the lid.");

    const db = await getDb();
    const onItem = await claims(db).find({ itemId: itemA._id }).toArray();
    expect(onItem.length).toBe(2);
    expect(onItem.every((claim) => claim.status === "pending")).toBe(true);
    expect(claimA.claim.id).not.toBe(claimB.claim.id);
  });

  it("rejects the losing claim automatically when a verified claim is approved", async () => {
    // Claimant A already opened a claim in the previous test - verify it now.
    const db = await getDb();
    const existingA = await claims(db).findOne({ itemId: itemA._id, claimantId: claimantA._id });
    expect(existingA).toBeTruthy();

    const verified = await answerCorrectly(claimantA, existingA!._id, itemA._id, secrets);
    expect(verified.passed).toBe(true);

    // Claim B is still pending verification.
    const pending = await claims(db).find({ itemId: itemA._id, claimantId: claimantB._id }).toArray();
    expect(pending.length).toBeGreaterThan(0);

    const decision = await request(`/api/claims/${existingA!._id}/decision`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { decision: "approve" },
    });
    expect(decision.status).toBe(200);

    const all = await claims(db).find({ itemId: itemA._id }).toArray();
    const winner = all.find((claim) => claim.claimantId === claimantA._id);
    const losers = all.filter((claim) => claim.claimantId !== claimantA._id);

    expect(winner?.status).toBe("approved");
    expect(losers.length).toBeGreaterThan(0);
    expect(losers.every((claim) => claim.status === "rejected")).toBe(true);

    const updatedItem = await items(db).findOne({ _id: itemA._id });
    expect(updatedItem?.status).toBe("in_custody");

    // The losing claimant is told.
    const notes = await notifications(db).find({ userId: claimantB._id }).toArray();
    expect(notes.length).toBeGreaterThan(0);
  });

  it("refuses approval until the verification challenge passes", async () => {
    const claimC = await openClaim(claimantC, itemB, "This is my backpack, blue with white strings.");
    const res = await request(`/api/claims/${claimC.claim.id}/decision`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { decision: "approve" },
    });
    expect(res.status).toBe(409);

    const stillPending = await claims(await getDb()).findOne({ _id: claimC.claim.id });
    expect(stillPending?.status).toBe("pending");
  });

  it("students cannot decide claims", async () => {
    const claimC = await claims(await getDb()).findOne({ claimantId: claimantC._id });
    const res = await request(`/api/claims/${claimC!._id}/decision`, {
      method: "POST",
      user: { sub: claimantA._id, role: "student" },
      body: { decision: "approve" },
    });
    expect(res.status).toBe(403);
  });

  it("a verified claim can be rejected by security", async () => {
    const claimC = await claims(await getDb()).findOne({ claimantId: claimantC._id });
    const verified = await answerCorrectly(
      claimantC,
      claimC!._id,
      itemB._id,
      [["Inside pocket colour?", "yellow"]],
    );
    expect(verified.passed).toBe(true);

    const res = await request(`/api/claims/${claimC!._id}/decision`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { decision: "reject", note: "Description does not match the item." },
    });
    expect(res.status).toBe(200);
    const after = await claims(await getDb()).findOne({ _id: claimC!._id });
    expect(after?.status).toBe("rejected");
    expect(after?.decisionNote).toContain("does not match");
  });

  it("a claimant can only read their own claim detail", async () => {
    const claimC = await claims(await getDb()).findOne({ claimantId: claimantC._id });
    const stranger = await makeUser();
    const asStranger = await request(`/api/claims/${claimC!._id}`, {
      user: { sub: stranger._id, role: "student" },
    });
    expect(asStranger.status).toBe(403);

    const asClaimant = await request(`/api/claims/${claimC!._id}`, {
      user: { sub: claimantC._id, role: "student" },
    });
    expect(asClaimant.status).toBe(200);
    const body = (await asClaimant.json()) as { questions: unknown };
    expect(JSON.stringify(body)).not.toContain("maria-88");
  });
});
