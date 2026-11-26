"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import type { PublicItem } from "@/lib/serialize/public";

interface ClaimView {
  id: string;
  itemId: string;
  status: string;
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

interface VerifyOutcome {
  correctCount: number;
  passed: boolean;
  attemptsLeft: number;
  requiredCorrect: number;
  results: { entryId: string; correct: boolean; similarity: number }[];
}

const STATUS_COPY: Record<string, { title: string; tone: string; body: string }> = {
  pending: {
    title: "Verification in progress",
    tone: "",
    body: "Answer the questions below. They are based on details only the owner would know.",
  },
  verification_passed: {
    title: "Verification passed - awaiting review",
    tone: "success",
    body: "Security will review your claim and schedule a supervised handover. Watch your notifications.",
  },
  verification_failed: {
    title: "Verification failed",
    tone: "error",
    body: "The answers did not match the finder's secret details. This claim cannot proceed.",
  },
  approved: {
    title: "Claim approved",
    tone: "success",
    body: "Head to the security desk with your ID. You will receive a one-time code in your notifications when the handover is scheduled.",
  },
  rejected: {
    title: "Claim not approved",
    tone: "error",
    body: "A reviewer rejected this claim.",
  },
  handed_over: {
    title: "Item handed over",
    tone: "success",
    body: "The handover is complete and the custody record is closed. Enjoy your item!",
  },
  cancelled: { title: "Claim cancelled", tone: "warn", body: "This claim was cancelled." },
};

export default function ClaimPage() {
  const params = useParams<{ id: string }>();
  const { user } = useMe();
  const [claim, setClaim] = useState<ClaimView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<ClaimView>(`/api/claims/${params.id}`);
      setClaim(data);
      const initial: Record<string, string> = {};
      data.questions?.forEach((question) => (initial[question.entryId] = ""));
      setAnswers(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim not found");
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAnswers() {
    if (!claim) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<VerifyOutcome>(`/api/claims/${claim.id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          answers: claim.questions?.map((question) => ({
            entryId: question.entryId,
            answer: answers[question.entryId] ?? "",
          })),
        }),
      });
      setOutcome(result);
      if (result.passed) await load();
      else await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed to submit");
    } finally {
      setBusy(false);
    }
  }

  if (error && !claim) {
    return (
      <div className="container page">
        <div className="empty">
          <p>{error}</p>
          <Link href="/me" className="btn secondary">
            My claims
          </Link>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="container page">
        <div className="skeleton" style={{ height: 260 }} />
      </div>
    );
  }

  const copy = STATUS_COPY[claim.status] ?? {
    title: claim.status.replace(/_/g, " "),
    tone: "",
    body: "",
  };
  const canAnswer =
    claim.questions != null && claim.questions.length > 0 && claim.status === "pending" && claim.attemptsLeft > 0;

  return (
    <div className="container page" style={{ maxWidth: 680 }}>
      <div className="page-head">
        <div>
          <h1>Claim on “{claim.item?.title ?? "item"}”</h1>
          <p>
            Opened {formatDate(claim.createdAt)} · attempt {claim.attempts + (canAnswer ? 1 : 0)} of{" "}
            {claim.attemptsLeft + claim.attempts}
          </p>
        </div>
        <Link href={`/items/${claim.itemId}`} className="btn secondary">
          View item
        </Link>
      </div>

      <div className={`notice ${copy.tone}`}>
        <strong>{copy.title}.</strong> {copy.body}
      </div>

      {error && <div className="notice error">{error}</div>}

      {claim.status === "verification_failed" && (
        <div className="card plain mb">
          <p className="muted" style={{ marginBottom: 0 }}>
            You answered {claim.correctCount} correctly; {claim.requiredCorrect} were required. A reviewer
            has been notified.
          </p>
        </div>
      )}

      {canAnswer && (
        <div className="card plain mb">
          <h3>Verification challenge</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            {claim.requiredCorrect} of these must be correct. Wrong answers cost an attempt - you have{" "}
            {claim.attemptsLeft} left.
          </p>

          {claim.questions!.map((question) => (
            <div className="question" key={question.entryId}>
              <div className="q">{question.question}</div>
              <input
                type="text"
                value={answers[question.entryId] ?? ""}
                placeholder="Your answer"
                maxLength={300}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.entryId]: event.target.value }))
                }
              />
            </div>
          ))}

          {outcome && !outcome.passed && (
            <div className="notice warn">
              {outcome.correctCount} of {outcome.requiredCorrect} correct. {outcome.attemptsLeft} attempt(s)
              remaining.
            </div>
          )}

          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => void submitAnswers()}
            style={{ width: "100%" }}
          >
            {busy ? <span className="spinner" /> : "Submit answers"}
          </button>
        </div>
      )}

      {outcome?.passed && (
        <div className="notice success">
          Answers matched ({outcome.correctCount}/{outcome.requiredCorrect}). Your claim is now queued for
          security review.
        </div>
      )}

      <div className="card plain">
        <dl className="kv">
          <dt>Status</dt>
          <dd>{claim.status.replace(/_/g, " ")}</dd>
          <dt>Your note</dt>
          <dd>{claim.note}</dd>
          <dt>Reviewer</dt>
          <dd>{claim.decidedAt ? formatDate(claim.decidedAt) : "Not reviewed yet"}</dd>
          {claim.decisionNote && (
            <>
              <dt>Decision note</dt>
              <dd>{claim.decisionNote}</dd>
            </>
          )}
        </dl>
        {user && (
          <p className="muted mt" style={{ fontSize: "0.85rem", marginBottom: 0 }}>
            The stored answers are never shown to anyone - they are only compared against what you type.
          </p>
        )}
      </div>
    </div>
  );
}
