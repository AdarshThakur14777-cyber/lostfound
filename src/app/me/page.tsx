"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, timeAgo } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";
import type { PublicItem } from "@/lib/serialize/public";

interface OwnedItem extends PublicItem {
  claimCount: number;
  matchCount: number;
  custodyCount: number;
  claims: { id: string; status: string; claimantName: string; createdAt: string; passed: boolean }[];
}

interface MyClaimRow {
  id: string;
  itemId: string;
  status: string;
  createdAt: string;
  attempts: number;
  passed: boolean;
  item: PublicItem | null;
}

export default function MePage() {
  const { user, loading } = useMe();
  const [tab, setTab] = useState<"reports" | "claims">("reports");
  const [reports, setReports] = useState<OwnedItem[] | null>(null);
  const [claims, setClaims] = useState<MyClaimRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ items: OwnedItem[] }>("/api/items?scope=mine")
      .then((data) => setReports(data.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
    api<{ claims: MyClaimRow[] }>("/api/claims?scope=mine")
      .then((data) => setClaims(data.claims))
      .catch(() => setClaims([]));
  }, [user]);

  if (loading) return <div className="container page"><div className="skeleton" /></div>;

  if (!user) {
    return (
      <div className="container page">
        <div className="empty">
          <p>Sign in to see your reports and claims.</p>
          <Link href="/login?next=/me" className="btn">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>My items</h1>
          <p>
            {user.name} · {user.role}
          </p>
        </div>
        <Link href="/report" className="btn">
          New report
        </Link>
      </div>

      <div className="tabs">
        <button type="button" className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}>
          My reports
        </button>
        <button type="button" className={tab === "claims" ? "active" : ""} onClick={() => setTab("claims")}>
          My claims
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}

      {tab === "reports" && (
        <div className="list">
          {reports === null && <div className="skeleton" />}
          {reports?.length === 0 && (
            <div className="empty">
              <p>You have not filed a report yet.</p>
              <Link href="/report" className="btn">
                Report an item
              </Link>
            </div>
          )}
          {reports?.map((item) => (
            <div className="row-card" key={item.id}>
              <div className="grow">
                <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className={`badge ${item.type}`}>{item.type}</span>
                  <span className="badge">{item.status.replace(/_/g, " ")}</span>
                </div>
                <Link href={`/items/${item.id}`}>
                  <strong>{item.title}</strong>
                </Link>
                <div className="sub">
                  {item.category.name} · {item.location.name} · filed {timeAgo(item.postedAt)}
                </div>
                <div className="sub">
                  {item.matchCount} match suggestion{item.matchCount === 1 ? "" : "s"} ·{" "}
                  {item.claimCount} claim{item.claimCount === 1 ? "" : "s"}
                  {item.custodyCount > 0 ? ` · ${item.custodyCount} custody entries` : ""}
                </div>
                {item.claims.map((claim) => (
                  <div className="sub" key={claim.id}>
                    Claim by {claim.claimantName}: <strong>{claim.status.replace(/_/g, " ")}</strong> ·{" "}
                    <Link href={`/claims/${claim.id}`}>open</Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "claims" && (
        <div className="list">
          {claims === null && <div className="skeleton" />}
          {claims?.length === 0 && (
            <div className="empty">
              <p>
                No claims yet. Find something on the <Link href="/board">board</Link> that is yours.
              </p>
            </div>
          )}
          {claims?.map((claim) => (
            <div className="row-card" key={claim.id}>
              <div className="grow">
                <Link href={`/claims/${claim.id}`}>
                  <strong>{claim.item?.title ?? "Item"}</strong>
                </Link>
                <div className="sub">
                  {claim.status.replace(/_/g, " ")} · filed {timeAgo(claim.createdAt)} · {claim.attempts}{" "}
                  attempt{claim.attempts === 1 ? "" : "s"}
                </div>
              </div>
              <Link href={`/claims/${claim.id}`} className="btn small">
                Open
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
