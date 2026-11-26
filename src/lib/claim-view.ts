import type { Db } from "mongodb";
import { challenges, claims, items } from "@/models/collections";
import type { ClaimDoc } from "@/models/types";
import { decryptSafe } from "./crypto";
import { loadTaxonomy } from "./taxonomy";
import { toPublicItem, type PublicItem } from "./serialize/public";

export interface ClaimView {
  id: string;
  itemId: string;
  status: ClaimDoc["status"];
  passed: boolean;
  attempts: number;
  correctCount: number;
  requiredCorrect: number;
  attemptsLeft: number;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  note: string;
  claimantName: string;
  item: PublicItem | null;
  questions: { entryId: string; question: string }[] | null;
}

/**
 * The claim response. Stored answers are never read here - only questions are
 * decrypted, and only for the claimant who must answer them.
 */
export async function buildClaimView(
  db: Db,
  claim: ClaimDoc,
  viewer: { id: string; moderator: boolean },
): Promise<ClaimView> {
  const [challenge, item, claimant] = await Promise.all([
    challenges(db).findOne({ _id: claim.challengeId }),
    items(db).findOne({ _id: claim.itemId }),
    db.collection<{ _id: string; name: string }>("users").findOne({ _id: claim.claimantId }),
  ]);
  const tax = item ? await loadTaxonomy(db) : null;

  const isClaimant = viewer.id === claim.claimantId;
  const showQuestions =
    isClaimant && challenge != null && challenge.status === "pending";

  return {
    id: claim._id,
    itemId: claim.itemId,
    status: claim.status,
    passed: claim.passed,
    attempts: claim.attempts,
    correctCount: viewer.moderator || isClaimant ? claim.correctCount : 0,
    requiredCorrect: challenge?.requiredCorrect ?? 0,
    attemptsLeft: challenge ? Math.max(0, challenge.maxAttempts - challenge.attempts) : 0,
    createdAt: claim.createdAt.toISOString(),
    decidedAt: claim.decidedAt?.toISOString() ?? null,
    decisionNote: claim.decisionNote ?? null,
    note: claim.note,
    claimantName: claimant?.name ?? "Claimant",
    item: item && tax ? toPublicItem(item, tax.lookup) : null,
    questions: showQuestions
      ? challenge!.questions.map((q) => ({
          entryId: q.entryId,
          question: decryptSafe(q.questionEnc) ?? "Identifying question",
        }))
      : null,
  };
}

export async function buildClaimViews(
  db: Db,
  claimDocs: ClaimDoc[],
  viewer: { id: string; moderator: boolean },
): Promise<ClaimView[]> {
  const views: ClaimView[] = [];
  for (const claim of claimDocs) views.push(await buildClaimView(db, claim, viewer));
  return views;
}
