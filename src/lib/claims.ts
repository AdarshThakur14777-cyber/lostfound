import type { Db } from "mongodb";
import { challenges, claims, items, notifications, privateDetails, users } from "@/models/collections";
import type { ClaimDoc, ClaimStatus, VerificationChallengeDoc } from "@/models/types";
import { badRequest, conflict, forbidden, notFound } from "./http";
import { decrypt, hmac, randomId } from "./crypto";
import { getSettings } from "./settings";
import { notify, writeAudit } from "./audit";
import { pickEntries, scoreAttempt, type AttemptResult } from "./verification/challenge";

export interface PublicQuestion {
  entryId: string;
  question: string;
}

export interface ChallengeView {
  challengeId: string;
  questions: PublicQuestion[];
  requiredCorrect: number;
  attemptsLeft: number;
  maxAttempts: number;
}

const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = [
  "pending",
  "verification_passed",
  "approved",
  "handed_over",
];

/** Step 1 - a claimant states the item is theirs; a challenge is minted. */
export async function createClaim(
  db: Db,
  input: { itemId: string; claimantId: string; note: string },
): Promise<{ claim: ClaimDoc; challenge: ChallengeView }> {
  const item = await items(db).findOne({ _id: input.itemId });
  if (!item) throw notFound("Item not found");
  if (item.type !== "found") throw badRequest("Only found items can be claimed");
  if (!["open", "claim_pending"].includes(item.status)) throw conflict("Item is not accepting claims");
  if (item.reporterId === input.claimantId) throw badRequest("You reported this item");

  const existing = await claims(db).findOne({
    itemId: item._id,
    claimantId: input.claimantId,
    status: { $in: ACTIVE_CLAIM_STATUSES },
  });
  if (existing) throw conflict("You already have an active claim on this item");

  const privateDoc = await privateDetails(db).findOne({ itemId: item._id });
  if (!privateDoc || privateDoc.entries.length === 0) {
    throw badRequest("This item has no verification details recorded yet");
  }

  const cfg = await getSettings(db);
  const picked = pickEntries(privateDoc.entries, cfg.challengeCount);
  const requiredCorrect = Math.min(cfg.requiredCorrect, picked.length);
  const challengeId = randomId(8);
  const questions = picked.map((entry) => ({
    entryId: entry.id,
    questionEnc: entry.questionEnc,
  }));

  const challenge: VerificationChallengeDoc = {
    _id: challengeId,
    claimId: "",
    itemId: item._id,
    entryIds: picked.map((entry) => entry.id),
    questions,
    requiredCorrect,
    maxAttempts: cfg.maxClaimAttempts,
    attempts: 0,
    status: "pending",
    scores: [],
    createdAt: new Date(),
  };

  const claim: ClaimDoc = {
    _id: randomId(8),
    itemId: item._id,
    claimantId: input.claimantId,
    note: input.note,
    status: "pending",
    challengeId,
    attempts: 0,
    correctCount: 0,
    passed: false,
    createdAt: new Date(),
  };
  challenge.claimId = claim._id;

  await claims(db).insertOne(claim);
  await challenges(db).insertOne(challenge);
  if (item.status === "open") {
    await items(db).updateOne({ _id: item._id }, { $set: { status: "claim_pending", updatedAt: new Date() } });
  }

  await notify(db, {
    userId: item.reporterId,
    type: "claim_submitted",
    title: "Claim submitted",
    body: `Someone claims the found item "${item.title}". Verification is in progress.`,
    link: `/items/${item._id}`,
  });

  return { claim, challenge: toChallengeView(challenge, decryptQuestion) };
}

function decryptQuestion(enc: string): string {
  try {
    return decrypt(enc);
  } catch {
    return "Identifying question";
  }
}

export function toChallengeView(
  challenge: VerificationChallengeDoc,
  decryptFn: (enc: string) => string,
): ChallengeView {
  return {
    challengeId: challenge._id,
    questions: challenge.questions.map((q) => ({ entryId: q.entryId, question: decryptFn(q.questionEnc) })),
    requiredCorrect: challenge.requiredCorrect,
    attemptsLeft: Math.max(0, challenge.maxAttempts - challenge.attempts),
    maxAttempts: challenge.maxAttempts,
  };
}

export interface VerifyOutcome extends AttemptResult {
  attemptsLeft: number;
  requiredCorrect: number;
  status: VerificationChallengeDoc["status"];
}

/** Step 2 - the claimant answers; answers are scored against decrypted secrets. */
export async function verifyClaim(
  db: Db,
  input: { claimId: string; claimantId: string; answers: { entryId: string; answer: string }[] },
): Promise<VerifyOutcome> {
  const claim = await claims(db).findOne({ _id: input.claimId });
  if (!claim) throw notFound("Claim not found");
  if (claim.claimantId !== input.claimantId) throw forbidden("This is not your claim");
  if (claim.status === "handed_over") throw conflict("Claim already completed");
  if (claim.status === "approved") throw conflict("Claim already approved");

  const challenge = await challenges(db).findOne({ _id: claim.challengeId });
  if (!challenge) throw notFound("Challenge not found");
  if (challenge.status === "passed") return alreadyPassed(challenge);
  if (challenge.status === "failed") throw conflict("No verification attempts left");
  if (challenge.attempts >= challenge.maxAttempts) {
    await failClaim(db, claim, challenge);
    throw conflict("No verification attempts left");
  }

  const privateDoc = await privateDetails(db).findOne({ itemId: claim.itemId });
  if (!privateDoc) throw badRequest("Private details unavailable");

  const byId = new Map(privateDoc.entries.map((entry) => [entry.id, entry]));
  const stored = challenge.entryIds
    .map((id) => byId.get(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({ id: entry.id, answer: decrypt(entry.answerEnc) }));

  const result = scoreAttempt(stored, input.answers, challenge.requiredCorrect);
  const attempt = challenge.attempts + 1;
  const now = new Date();

  await challenges(db).updateOne(
    { _id: challenge._id },
    {
      $inc: { attempts: 1 },
      $set: {
        status: result.passed ? "passed" : attempt >= challenge.maxAttempts ? "failed" : "pending",
        scores: [...challenge.scores, { attempt, correct: result.correctCount, at: now }],
      },
    },
  );

  const status: ClaimDoc["status"] = result.passed
    ? "verification_passed"
    : attempt >= challenge.maxAttempts
      ? "verification_failed"
      : "pending";

  await claims(db).updateOne(
    { _id: claim._id },
    { $set: { status, attempts: attempt, correctCount: result.correctCount, passed: result.passed } },
  );

  await notify(db, {
    userId: claim.claimantId,
    type: "verification_result",
    title: result.passed ? "Verification passed" : "Verification incomplete",
    body: result.passed
      ? "Your answers matched. Security will review the claim before handover."
      : `You answered ${result.correctCount} of ${challenge.requiredCorrect} correctly. ${Math.max(0, challenge.maxAttempts - attempt)} attempt(s) left.`,
    link: `/claims/${claim._id}`,
  });

  if (!result.passed && attempt >= challenge.maxAttempts) {
    await writeAudit(db, {
      actorId: claim.claimantId,
      actorRole: "system",
      action: "claim.verification_failed",
      entityType: "claim",
      entityId: claim._id,
      meta: { itemId: claim.itemId },
    });
  }

  return {
    ...result,
    attemptsLeft: Math.max(0, challenge.maxAttempts - attempt),
    requiredCorrect: challenge.requiredCorrect,
    status: result.passed ? "passed" : status === "verification_failed" ? "failed" : "pending",
  };
}

function alreadyPassed(challenge: VerificationChallengeDoc): VerifyOutcome {
  const last = challenge.scores.at(-1);
  return {
    correctCount: last?.correct ?? challenge.requiredCorrect,
    passed: true,
    results: [],
    attemptsLeft: Math.max(0, challenge.maxAttempts - challenge.attempts),
    requiredCorrect: challenge.requiredCorrect,
    status: "passed",
  };
}

async function failClaim(
  db: Db,
  claim: ClaimDoc,
  challenge: VerificationChallengeDoc,
): Promise<void> {
  await challenges(db).updateOne({ _id: challenge._id }, { $set: { status: "failed" } });
  await claims(db).updateOne({ _id: claim._id }, { $set: { status: "verification_failed" } });
}

/**
 * Step 3 - security approves or rejects. Approval is impossible without a
 * passed challenge, and it supersedes any competing claims on the item.
 */
export async function decideClaim(
  db: Db,
  input: { claimId: string; decision: "approve" | "reject"; actorId: string; actorRole: string; note?: string },
): Promise<ClaimDoc> {
  const claim = await claims(db).findOne({ _id: input.claimId });
  if (!claim) throw notFound("Claim not found");
  if (claim.status === "handed_over") throw conflict("Claim already completed");
  if (claim.status === "approved") throw conflict("Claim already approved");
  if (claim.status === "rejected") throw conflict("Claim already rejected");

  if (input.decision === "approve" && claim.status !== "verification_passed") {
    throw conflict("Verification challenge must be passed before approval");
  }

  const now = new Date();
  await claims(db).updateOne(
    { _id: claim._id },
    {
      $set: {
        status: input.decision === "approve" ? "approved" : "rejected",
        decidedAt: now,
        decidedById: input.actorId,
        decisionNote: input.note,
      },
    },
  );

  if (input.decision === "approve") {
    const superseded = await claims(db)
      .find({ itemId: claim.itemId, _id: { $ne: claim._id }, status: { $in: ["pending", "verification_passed"] } })
      .toArray();
    if (superseded.length > 0) {
      await claims(db).updateMany(
        { _id: { $in: superseded.map((c) => c._id) } },
        {
          $set: {
            status: "rejected",
            decidedAt: now,
            decidedById: input.actorId,
            decisionNote: "Another claim on this item was approved",
          },
        },
      );
      for (const other of superseded) {
        await notify(db, {
          userId: other.claimantId,
          type: "claim_decided",
          title: "Claim not approved",
          body: "Another claimant verified successfully for this item.",
          link: `/claims/${other._id}`,
        });
      }
    }
    await items(db).updateOne(
      { _id: claim.itemId },
      { $set: { status: "in_custody", updatedAt: now } },
    );
  }

  await notify(db, {
    userId: claim.claimantId,
    type: "claim_decided",
    title: input.decision === "approve" ? "Claim approved" : "Claim not approved",
    body:
      input.decision === "approve"
        ? "Security has approved your claim. A supervised handover will be scheduled."
        : `Your claim was not approved.${input.note ? ` ${input.note}` : ""}`,
    link: `/claims/${claim._id}`,
  });

  await writeAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole as never,
    action: `claim.${input.decision}`,
    entityType: "claim",
    entityId: claim._id,
    meta: { itemId: claim.itemId },
  });

  const updated = await claims(db).findOne({ _id: claim._id });
  return updated!;
}

export async function claimantName(db: Db, userId: string): Promise<string> {
  const user = await users(db).findOne({ _id: userId });
  return user?.name ?? "Claimant";
}
