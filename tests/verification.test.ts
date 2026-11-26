import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/db";
import { challenges, claims } from "../src/models/collections";
import { checkAnswer, normalizeAnswer, scoreAttempt } from "../src/lib/verification/challenge";
import { request } from "./helpers";
import { answerKeyFor, makeUser, resetDb, seedItem, seedTaxonomy } from "./helpers";
import type { ItemDoc, UserDoc } from "../src/models/types";

describe("verification challenge", () => {
  let finder: UserDoc;
  let claimant: UserDoc;
  let item: ItemDoc;

  const secrets: [string, string][] = [
    ["What is written on the sticker inside the case?", "asha-2026"],
    ["What colour is the wallpaper?", "sunset orange"],
  ];

  beforeAll(async () => {
    await resetDb();
    await seedTaxonomy();
    finder = await makeUser({ name: "Finder" });
    claimant = await makeUser({ name: "Claimant" });
    item = await seedItem({
      reporterId: finder._id,
      type: "found",
      title: "Found black smartphone in blue case",
      privateDetails: secrets,
    });
  });

  it("normalises answers so formatting does not matter", () => {
    expect(normalizeAnswer("  Sunset   Orange! ")).toBe("sunset orange");
    expect(checkAnswer("Sunset Orange", "sunset  orange.").correct).toBe(true);
    expect(checkAnswer("asha-2026", "ASHA-2026").correct).toBe(true);
    expect(checkAnswer("asha-2026", "wrong-answer").correct).toBe(false);
    expect(checkAnswer("asha-2026", "").correct).toBe(false);
    expect(checkAnswer("exact", "excat").correct).toBe(false);
  });

  it("scores a full attempt and enforces the required count", () => {
    const stored = [
      { id: "a", answer: "blue" },
      { id: "b", answer: "red" },
      { id: "c", answer: "green" },
    ];
    const passed = scoreAttempt(
      stored,
      [
        { entryId: "a", answer: "Blue" },
        { entryId: "b", answer: "red!" },
        { entryId: "c", answer: "nope" },
      ],
      2,
    );
    expect(passed.correctCount).toBe(2);
    expect(passed.passed).toBe(true);

    const failed = scoreAttempt(
      stored,
      [
        { entryId: "a", answer: "no" },
        { entryId: "b", answer: "no" },
        { entryId: "c", answer: "no" },
      ],
      2,
    );
    expect(failed.correctCount).toBe(0);
    expect(failed.passed).toBe(false);
  });

  it("mints a challenge with questions but never with answers", async () => {
    const res = await request("/api/claims", {
      method: "POST",
      user: { sub: claimant._id, role: "student" },
      body: { itemId: item._id, note: "This is my phone, I lost it near the library." },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      claim: { id: string; status: string; questions: { question: string }[] | null };
      challenge: { questions: { question: string; entryId: string }[]; requiredCorrect: number };
    };

    expect(body.claim.status).toBe("pending");
    expect(body.challenge.questions.length).toBeGreaterThan(0);
    expect(body.challenge.requiredCorrect).toBeGreaterThan(0);

    const serialised = JSON.stringify(body);
    for (const [, answer] of secrets) expect(serialised).not.toContain(answer);
    expect(serialised).not.toContain("answerEnc");
  });

  it("passes a claim when the answers match the private details", async () => {
    const claim = await claims(await getDb()).findOne({ claimantId: claimant._id });
    expect(claim).toBeTruthy();
    const challenge = await challenges(await getDb()).findOne({ _id: claim!.challengeId });
    expect(challenge).toBeTruthy();

    const key = await answerKeyFor(item._id, secrets);
    const res = await request(`/api/claims/${claim!._id}/verify`, {
      method: "POST",
      user: { sub: claimant._id, role: "student" },
      body: {
        answers: challenge!.questions.map((question) => ({
          entryId: question.entryId,
          answer: key.get(question.entryId) ?? "",
        })),
      },
    });
    expect(res.status).toBe(200);
    const outcome = (await res.json()) as { passed: boolean; correctCount: number };
    expect(outcome.passed).toBe(true);
    expect(outcome.correctCount).toBeGreaterThanOrEqual(challenge!.requiredCorrect);

    const updated = await claims(await getDb()).findOne({ _id: claim!._id });
    expect(updated?.status).toBe("verification_passed");
    expect(updated?.passed).toBe(true);
  });

  it("only the claimant may submit answers", async () => {
    const claim = await claims(await getDb()).findOne({ claimantId: claimant._id });
    const stranger = await makeUser();
    const res = await request(`/api/claims/${claim!._id}/verify`, {
      method: "POST",
      user: { sub: stranger._id, role: "student" },
      body: { answers: [{ entryId: "x", answer: "anything" }] },
    });
    expect(res.status).toBe(403);
  });

  it("burns attempts and fails the claim when answers are wrong", async () => {
    const finder2 = await makeUser({ name: "Finder2" });
    const item2 = await seedItem({
      reporterId: finder2._id,
      type: "found",
      title: "Found a wallet",
      privateDetails: [
        ["Name on the card?", "rohan"],
        ["Colour of the wallet?", "brown"],
      ],
    });
    const claimant2 = await makeUser({ name: "Claimant2" });

    const created = await request("/api/claims", {
      method: "POST",
      user: { sub: claimant2._id, role: "student" },
      body: { itemId: item2._id, note: "It is mine, I can describe it." },
    });
    expect(created.status).toBe(201);
    const { claim } = (await created.json()) as { claim: { id: string; questions: { entryId: string }[] } };

    const wrongAnswers = claim.questions.map((question) => ({
      entryId: question.entryId,
      answer: "definitely-not-the-answer",
    }));

    let lastStatus = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await request(`/api/claims/${claim.id}/verify`, {
        method: "POST",
        user: { sub: claimant2._id, role: "student" },
        body: { answers: wrongAnswers },
      });
      lastStatus = res.status;
      expect([200, 409]).toContain(lastStatus);
      if (lastStatus === 409) break;
    }
    expect(lastStatus).toBe(409);

    const db = await getDb();
    const finalClaim = await claims(db).findOne({ _id: claim.id });
    expect(finalClaim?.status).toBe("verification_failed");
    expect(finalClaim?.passed).toBe(false);
  });

  it("a found item without private details cannot be claimed", async () => {
    const bare = await seedItem({
      reporterId: finder._id,
      type: "found",
      title: "Found an umbrella",
      privateDetails: [],
    });
    const res = await request("/api/claims", {
      method: "POST",
      user: { sub: claimant._id, role: "student" },
      body: { itemId: bare._id, note: "This is my umbrella from the rain last week." },
    });
    expect(res.status).toBe(400);
  });
});
