"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  BoxIcon,
  ClockIcon,
  FileTextIcon,
  PlusCircleIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@/components/icons";
import { api, timeAgo } from "@/lib/client/api";
import { categoryArtwork } from "@/lib/category-art";
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

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  staff: "Staff",
  security: "Security",
  admin: "Admin",
  sysadmin: "System admin",
};

const STATUS_TONE: Record<string, string> = {
  open: "status-open",
  claim_pending: "status-claim",
  in_custody: "status-custody",
  returned: "status-returned",
  pending: "status-claim",
  verification_passed: "status-custody",
  verification_failed: "status-expired",
  approved: "status-returned",
  rejected: "status-expired",
  handed_over: "status-returned",
  cancelled: "status-expired",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  if (loading) {
    return (
      <div className="container page">
        <div className="skeleton" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container page">
        <div className="empty">
          <span className="empty-icon">
            <UserIcon size={26} />
          </span>
          <h3>Sign in to see your activity</h3>
          <p>Track your reports, follow claims, and pick up where you left off.</p>
          <div className="empty-actions">
            <Link href="/login?next=/me" className="btn">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page me-page">
      <div className="me-header">
        <div className="me-identity">
          <span className="avatar xl">{initials(user.name)}</span>
          <div>
            <span className="eyebrow muted">Your account</span>
            <h1>{user.name}</h1>
            <p>
              {user.email} <span className="dot-sep" aria-hidden="true" />{" "}
              <span className="badge role-badge">{ROLE_LABEL[user.role] ?? user.role}</span>
            </p>
          </div>
        </div>
        <Link href="/report" className="btn">
          <PlusCircleIcon size={17} /> New report
        </Link>
      </div>

      <div className="tabs" role="tablist" aria-label="My activity">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "reports"}
          className={tab === "reports" ? "active" : ""}
          onClick={() => setTab("reports")}
        >
          <FileTextIcon size={16} /> My reports
          {reports && <span className="tab-count">{reports.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "claims"}
          className={tab === "claims" ? "active" : ""}
          onClick={() => setTab("claims")}
        >
          <ShieldCheckIcon size={16} /> My claims
          {claims && <span className="tab-count">{claims.length}</span>}
        </button>
      </div>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}

      {tab === "reports" && (
        <div className="list">
          {reports === null && <div className="skeleton" style={{ height: 120 }} />}
          {reports?.length === 0 && (
            <div className="empty">
              <span className="empty-icon">
                <FileTextIcon size={26} />
              </span>
              <h3>No reports yet</h3>
              <p>When you report a lost or found item, it will show up here with live match and claim counts.</p>
              <div className="empty-actions">
                <Link href="/report" className="btn">
                  Report an item
                </Link>
              </div>
            </div>
          )}
          {reports?.map((item) => (
            <article className="activity-card" key={item.id}>
              <div className="activity-thumb">
                {item.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.images[0]} alt="" loading="lazy" />
                ) : categoryArtwork(item.category.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={categoryArtwork(item.category.id)!.src} alt="" loading="lazy" />
                ) : item.type === "found" ? (
                  <BoxIcon size={24} />
                ) : (
                  <SearchIcon size={24} />
                )}
              </div>
              <div className="activity-body">
                <div className="badge-row">
                  <span className={`badge ${item.type}`}>{item.type}</span>
                  <span className={`status-pill ${STATUS_TONE[item.status] ?? "status-open"}`}>
                    <span className="status-dot" aria-hidden="true" />
                    {statusLabel(item.status)}
                  </span>
                </div>
                <Link href={`/items/${item.id}`} className="activity-title">
                  {item.title}
                </Link>
                <div className="sub">
                  {item.category.name} · {item.location.name} · filed {timeAgo(item.postedAt)}
                </div>
                <div className="activity-stats">
                  <span>
                    <SearchIcon size={13} /> {item.matchCount} match{item.matchCount === 1 ? "" : "s"}
                  </span>
                  <span>
                    <ShieldCheckIcon size={13} /> {item.claimCount} claim{item.claimCount === 1 ? "" : "s"}
                  </span>
                  {item.custodyCount > 0 && (
                    <span>
                      <ClockIcon size={13} /> {item.custodyCount} custody entries
                    </span>
                  )}
                </div>
                {item.claims.map((claim) => (
                  <div className="claim-line" key={claim.id}>
                    Claim by {claim.claimantName}: <strong>{statusLabel(claim.status)}</strong> ·{" "}
                    <Link href={`/claims/${claim.id}`}>open</Link>
                  </div>
                ))}
              </div>
              <Link href={`/items/${item.id}`} className="activity-open" aria-label={`Open ${item.title}`}>
                <ArrowRightIcon size={17} />
              </Link>
            </article>
          ))}
        </div>
      )}

      {tab === "claims" && (
        <div className="list">
          {claims === null && <div className="skeleton" style={{ height: 120 }} />}
          {claims?.length === 0 && (
            <div className="empty">
              <span className="empty-icon">
                <ShieldCheckIcon size={26} />
              </span>
              <h3>No claims yet</h3>
              <p>
                Find something on the <Link href="/board">public board</Link> that is yours, then start a
                private ownership check.
              </p>
              <div className="empty-actions">
                <Link href="/board" className="btn secondary">
                  Browse the board
                </Link>
              </div>
            </div>
          )}
          {claims?.map((claim) => (
            <article className="activity-card" key={claim.id}>
              <div className="activity-thumb">
                {claim.item?.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={claim.item.images[0]} alt="" loading="lazy" />
                ) : claim.item && categoryArtwork(claim.item.category.id) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={categoryArtwork(claim.item.category.id)!.src} alt="" loading="lazy" />
                ) : (
                  <ShieldCheckIcon size={24} />
                )}
              </div>
              <div className="activity-body">
                <span className={`status-pill ${STATUS_TONE[claim.status] ?? "status-open"}`}>
                  <span className="status-dot" aria-hidden="true" />
                  {statusLabel(claim.status)}
                </span>
                <Link href={`/claims/${claim.id}`} className="activity-title">
                  {claim.item?.title ?? "Item"}
                </Link>
                <div className="sub">
                  Filed {timeAgo(claim.createdAt)} · {claim.attempts} attempt
                  {claim.attempts === 1 ? "" : "s"}
                  {claim.passed ? " · verification passed" : ""}
                </div>
              </div>
              <Link href={`/claims/${claim.id}`} className="btn secondary small">
                Open claim
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
