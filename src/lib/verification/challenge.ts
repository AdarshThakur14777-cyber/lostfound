import type { PrivateDetailEntry } from "@/models/types";

/**
 * Verification challenge: questions are drawn from the reporter's encrypted
 * private entries. Only the question text and entry id ever leave the server;
 * the stored answer is decrypted in memory solely to score a submission.
 */

export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?"'`]/g, "")
    .replace(/\s+/g, " ");
}

function bigrams(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  const text = value.replace(/\s+/g, " ");
  for (let i = 0; i < text.length - 1; i += 1) {
    const gram = text.slice(i, i + 2);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

export function bigramDice(a: string, b: string): number {
  if (a === b) return a.length === 0 ? 1 : 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let overlap = 0;
  let totalA = 0;
  let totalB = 0;
  for (const count of ga.values()) totalA += count;
  for (const count of gb.values()) totalB += count;
  for (const [gram, count] of ga) {
    const other = gb.get(gram);
    if (other) overlap += Math.min(count, other);
  }
  return totalA + totalB === 0 ? 0 : (2 * overlap) / (totalA + totalB);
}

export interface AnswerCheck {
  correct: boolean;
  similarity: number;
}

export const ANSWER_SIMILARITY_THRESHOLD = 0.85;

export function checkAnswer(stored: string, given: string): AnswerCheck {
  const a = normalizeAnswer(stored);
  const b = normalizeAnswer(given ?? "");
  if (b.length === 0) return { correct: false, similarity: 0 };
  if (a === b) return { correct: true, similarity: 1 };
  const similarity = bigramDice(a, b);
  return { correct: similarity >= ANSWER_SIMILARITY_THRESHOLD, similarity };
}

/** Deterministic picking when a rng is supplied (tests); crypto-random otherwise. */
export function pickEntries(entries: PrivateDetailEntry[], count: number): PrivateDetailEntry[] {
  const pool = [...entries];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, Math.min(count, entries.length)));
}

export interface AttemptResult {
  correctCount: number;
  passed: boolean;
  results: { entryId: string; correct: boolean; similarity: number }[];
}

export function scoreAttempt(
  stored: { id: string; answer: string }[],
  submitted: { entryId: string; answer: string }[],
  requiredCorrect: number,
): AttemptResult {
  const answers = new Map(submitted.map((entry) => [entry.entryId, entry.answer ?? ""]));
  const results = stored.map((entry) => {
    const check = checkAnswer(entry.answer, answers.get(entry.id) ?? "");
    return { entryId: entry.id, correct: check.correct, similarity: check.similarity };
  });
  const correctCount = results.filter((r) => r.correct).length;
  return { correctCount, passed: correctCount >= requiredCorrect, results };
}
