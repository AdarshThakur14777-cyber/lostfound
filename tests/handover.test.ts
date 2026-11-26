import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/db";
import { appendCustody } from "../src/lib/custody";
import { challenges, claims, custody, handovers, items } from "../src/models/collections";
import { request } from "./helpers";
import { answerKeyFor, makeUser, resetDb, seedItem, seedTaxonomy } from "./helpers";
import type { ClaimDoc, ItemDoc, UserDoc } from "../src/models/types";

const PROOF = `/api/files/${"a".repeat(32)}.jpg`;

const SECRETS: [string, string][] = [
  ["What is hidden under the front pocket?", "hidden-mark-7"],
  ["What colour is the strap?", "blue strap"],
];

describe("supervised handover and custody chain", () => {
  let finder: UserDoc;
  let security: UserDoc;
  let student: UserDoc;
  let claimant: UserDoc;
  let item: ItemDoc;
  let approvedClaim: ClaimDoc;

  async function makeApprovedClaim(): Promise<ClaimDoc> {
    const created = await request("/api/claims", {
      method: "POST",
      user: { sub: claimant._id, role: "student" },
      body: { itemId: item._id, note: "It is mine - my notes are inside." },
    });
    expect(created.status).toBe(201);
    const { claim } = (await created.json()) as { claim: { id: string } };

    const db = await getDb();
    const full = await claims(db).findOne({ _id: claim.id });
    const challenge = await challenges(db).findOne({ _id: full!.challengeId });
    const key = await answerKeyFor(item._id, SECRETS);
    const answers = challenge!.questions.map((question) => ({
      entryId: question.entryId,
      answer: key.get(question.entryId) ?? "",
    }));
    const verified = await request(`/api/claims/${claim.id}/verify`, {
      method: "POST",
      user: { sub: claimant._id, role: "student" },
      body: { answers },
    });
    expect(verified.status).toBe(200);
    expect(((await verified.json()) as { passed: boolean }).passed).toBe(true);

    const decision = await request(`/api/claims/${claim.id}/decision`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { decision: "approve" },
    });
    expect(decision.status).toBe(200);

    return (await claims(db).findOne({ _id: claim.id }))!;
  }

  beforeAll(async () => {
    await resetDb();
    await seedTaxonomy();
    finder = await makeUser({ name: "Finder" });
    security = await makeUser({ name: "Officer Kim", role: "security" });
    student = await makeUser({ name: "Random Student" });
    claimant = await makeUser({ name: "True Owner" });
    item = await seedItem({
      reporterId: finder._id,
      type: "found",
      title: "Found a blue backpack",
      privateDetails: [
        ["What is hidden under the front pocket?", "hidden-mark-7"],
        ["What colour is the strap?", "blue strap"],
      ],
    });
    approvedClaim = await makeApprovedClaim();
    expect(approvedClaim.status).toBe("approved");

    // The finder handed the item to the desk when they reported it.
    await appendCustody(await getDb(), {
      itemId: item._id,
      action: "received",
      actorId: security._id,
      toLocationId: item.locationId,
      toHolderId: security._id,
      note: "Backpack brought to the security desk",
    });
  });

  it("requires the security role to schedule a handover", async () => {
    const res = await request("/api/handovers", {
      method: "POST",
      user: { sub: student._id, role: "student" },
      body: { claimId: approvedClaim._id, method: "otp" },
    });
    expect(res.status).toBe(403);
  });

  it("schedules an OTP handover and delivers the code only to the claimant", async () => {
    const res = await request("/api/handovers", {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { claimId: approvedClaim._id, method: "otp" },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; method: string; status: string };
    expect(body.method).toBe("otp");
    expect(body.status).toBe("scheduled");

    const db = await getDb();
    const stored = await handovers(db).findOne({ _id: body.id });
    expect(stored?.otpHash).toBeTruthy();
    // The raw OTP must not be stored.
    expect(JSON.stringify(stored)).not.toMatch(/"otp":"\d{6}"/);
  });

  it("a student cannot complete a handover", async () => {
    const handover = await handovers(await getDb()).findOne({ claimId: approvedClaim._id });
    const res = await request(`/api/handovers/${handover!._id}/complete`, {
      method: "POST",
      user: { sub: student._id, role: "student" },
      body: { otp: "123456", proofImage: PROOF },
    });
    expect(res.status).toBe(403);
  });

  it("requires a proof photo", async () => {
    const handover = await handovers(await getDb()).findOne({ claimId: approvedClaim._id });
    const res = await request(`/api/handovers/${handover!._id}/complete`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { otp: "123456" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects a wrong OTP and completes with the right one", async () => {
    const db = await getDb();
    const handover = await handovers(db).findOne({ claimId: approvedClaim._id });

    const wrong = await request(`/api/handovers/${handover!._id}/complete`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { otp: "000000", proofImage: PROOF },
    });
    expect(wrong.status).toBe(403);

    // Read the claimant's code from their notifications (stands in for SMS/email).
    const { notifications } = await import("../src/models/collections");
    const note = await notifications(db).findOne({
      userId: claimant._id,
      type: "handover_scheduled",
      read: false,
    });
    expect(note).toBeTruthy();
    const otp = note!.body.match(/(\d{6})/)?.[1];
    expect(otp).toBeTruthy();
    expect(JSON.stringify(handover)).not.toContain(otp!);

    const complete = await request(`/api/handovers/${handover!._id}/complete`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { otp, proofImage: PROOF },
    });
    expect(complete.status).toBe(200);

    const updatedItem = await items(db).findOne({ _id: item._id });
    expect(updatedItem?.status).toBe("returned");
    expect(updatedItem?.returnedToUserId).toBe(claimant._id);

    const chain = await custody(db).find({ itemId: item._id }).sort({ seq: 1 }).toArray();
    expect(chain.length).toBeGreaterThanOrEqual(2);
    expect(chain.at(-1)?.action).toBe("handed_over");
    expect(chain.at(-1)?.proofImage).toBe(PROOF);

    const updatedClaim = await claims(db).findOne({ _id: approvedClaim._id });
    expect(updatedClaim?.status).toBe("handed_over");

    const updatedHandover = await handovers(db).findOne({ _id: handover!._id });
    expect(updatedHandover?.status).toBe("completed");
    expect(updatedHandover?.otpAttempts).toBe(1);
  });

  it("supports a supervised signature handover", async () => {
    const freshItem = await seedItem({
      reporterId: finder._id,
      type: "found",
      title: "Found a calculator",
      privateDetails: [["Scratch on the back?", "triangle"]],
    });
    const otherClaimant = await makeUser({ name: "Second Owner" });

    const created = await request("/api/claims", {
      method: "POST",
      user: { sub: otherClaimant._id, role: "student" },
      body: { itemId: freshItem._id, note: "Mine - I scratched a triangle on the back." },
    });
    const { claim } = (await created.json()) as { claim: { id: string } };

    const db = await getDb();
    const full = await claims(db).findOne({ _id: claim.id });
    const challenge = await challenges(db).findOne({ _id: full!.challengeId });
    const key = await answerKeyFor(freshItem._id, [["Scratch on the back?", "triangle"]]);
    const verified = await request(`/api/claims/${claim.id}/verify`, {
      method: "POST",
      user: { sub: otherClaimant._id, role: "student" },
      body: {
        answers: challenge!.questions.map((question) => ({
          entryId: question.entryId,
          answer: key.get(question.entryId) ?? "",
        })),
      },
    });
    expect(((await verified.json()) as { passed: boolean }).passed).toBe(true);

    await request(`/api/claims/${claim.id}/decision`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { decision: "approve" },
    });

    const scheduled = await request("/api/handovers", {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { claimId: claim.id, method: "signature" },
    });
    expect(scheduled.status).toBe(201);
    const { id } = (await scheduled.json()) as { id: string };

    const completed = await request(`/api/handovers/${id}/complete`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { signatureName: "Second Owner", proofImage: PROOF },
    });
    expect(completed.status).toBe(200);

    const updated = await items(db).findOne({ _id: freshItem._id });
    expect(updated?.status).toBe("returned");
    const handover = await handovers(db).findOne({ _id: id });
    expect(handover?.signatureName).toBe("Second Owner");
  });

  it("exposes the custody chain to the reporter and staff only", async () => {
    const stranger = await makeUser();
    const denied = await request(`/api/items/${item._id}/custody`, {
      user: { sub: stranger._id, role: "student" },
    });
    expect(denied.status).toBe(403);

    const allowed = await request(`/api/items/${item._id}/custody`, {
      user: { sub: finder._id, role: "student" },
    });
    expect(allowed.status).toBe(200);
    const body = (await allowed.json()) as { records: { action: string }[] };
    expect(body.records.length).toBeGreaterThanOrEqual(2);
  });
});
