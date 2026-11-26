"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { api, formatDate, timeAgo } from "@/lib/client/api";
import { useMe, isModeratorRole } from "@/lib/client/me";
import type { PublicItem } from "@/lib/serialize/public";

interface MatchRow {
  id: string;
  score: number;
  reasons: string[];
  status: string;
  item: PublicItem | null;
}

interface CustodyRow {
  id: string;
  seq: number;
  action: string;
  at: string;
  actorName: string;
  fromLocation: string;
  toLocation: string;
  fromHolder: string;
  toHolder: string;
  note: string;
}

interface MyClaim {
  id: string;
  itemId: string;
  status: string;
}

function Detail() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const { user, loading } = useMe();

  const [item, setItem] = useState<PublicItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [chain, setChain] = useState<CustodyRow[] | null>(null);
  const [myClaims, setMyClaims] = useState<MyClaim[]>([]);
  const [note, setNote] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [showClaim, setShowClaim] = useState(false);

  const loadItem = useCallback(async () => {
    try {
      setItem(await api<PublicItem>(`/api/items/${params.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not found");
    }
  }, [params.id]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (!user) return;
    api<{ matches: MatchRow[] }>(`/api/items/${params.id}/matches`)
      .then((data) => setMatches(data.matches))
      .catch(() => setMatches(null));
    api<{ records: CustodyRow[] }>(`/api/items/${params.id}/custody`)
      .then((data) => setChain(data.records))
      .catch(() => setChain(null));
    api<{ claims: MyClaim[] }>("/api/claims?scope=mine")
      .then((data) => setMyClaims(data.claims.filter((claim) => claim.itemId === params.id)))
      .catch(() => setMyClaims([]));
  }, [user, params.id]);

  if (error) {
    return (
      <div className="container page">
        <div className="empty">
          <p>{error}</p>
          <Link href="/board" className="btn secondary">
            Back to board
          </Link>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container page">
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }

  const myClaim = myClaims[0];

  async function submitClaim() {
    setClaiming(true);
    setClaimError(null);
    try {
      const result = await api<{ claim: { id: string } }>("/api/claims", {
        method: "POST",
        body: JSON.stringify({ itemId: item!.id, note }),
      });
      window.location.href = `/claims/${result.claim.id}`;
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "Could not start the claim");
      setClaiming(false);
    }
  }

  return (
    <div className="container page">
      {search.get("created") && (
        <div className="notice success">Report filed. Match suggestions are being generated.</div>
      )}

      <div className="page-head">
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span className={`badge ${item.type}`}>{item.type === "lost" ? "lost item" : "found item"}</span>
            <span className="badge">{item.status.replace(/_/g, " ")}</span>
            {item.hasVerification && <span className="badge privacy">ownership verified</span>}
          </div>
          <h1>{item.title}</h1>
          <p>
            Reported {timeAgo(item.postedAt)} · happened {formatDate(item.occurredAt)}
          </p>
        </div>
        <Link href="/board" className="btn secondary">
          Back to board
        </Link>
      </div>

      <div className="detail">
        <div className="gallery">
          <div className="main">
            {item.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.images[0]} alt={item.title} />
            ) : (
              <span>{item.type === "found" ? "📦" : "🔎"}</span>
            )}
          </div>
          {item.images.length > 1 && (
            <div className="photo-strip">
              {item.images.map((image) => (
                <div className="slot" key={image}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" />
                </div>
              ))}
            </div>
          )}

          <div className="card plain">
            <h3>Description</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{item.description}</p>
            {Object.keys(item.attributes).length > 0 && (
              <dl className="kv">
                {Object.entries(item.attributes).map(([key, value]) => (
                  <div key={key} style={{ display: "contents" }}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {chain && chain.length > 0 && (
            <div className="card plain">
              <h3>Custody chain</h3>
              <ul className="chain">
                {chain.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>
                        {row.seq}. {row.action.replace(/_/g, " ")}
                      </strong>{" "}
                      <span className="muted">by {row.actorName}</span>
                    </div>
                    <div className="when">{formatDate(row.at)}</div>
                    {row.toLocation && (
                      <div className="sub muted" style={{ fontSize: "0.84rem" }}>
                        {row.fromLocation ? `${row.fromLocation} → ` : ""}
                        {row.toLocation}
                        {row.toHolder ? ` · holder: ${row.toHolder}` : ""}
                      </div>
                    )}
                    {row.note && (
                      <div className="sub muted" style={{ fontSize: "0.84rem" }}>
                        {row.note}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <div className="card plain mb">
            <dl className="kv">
              <dt>Category</dt>
              <dd>{item.category.name}</dd>
              <dt>Location</dt>
              <dd>{item.location.path.join(" › ")}</dd>
              <dt>Posted</dt>
              <dd>{formatDate(item.postedAt)}</dd>
              <dt>Status</dt>
              <dd>{item.status.replace(/_/g, " ")}</dd>
            </dl>
            <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
              🔒 Contact details and secret identifying marks are never shown here.
            </div>
          </div>

          {myClaim ? (
            <div className="card plain mb">
              <h3>Your claim</h3>
              <p className="muted">Status: {myClaim.status.replace(/_/g, " ")}</p>
              <Link href={`/claims/${myClaim.id}`} className="btn">
                Open claim
              </Link>
            </div>
          ) : item.claimable ? (
            <div className="card plain mb">
              <h3>Is this yours?</h3>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                Starting a claim opens a verification challenge based on the finder&apos;s secret details.
                Passing it lets security approve a supervised handover.
              </p>
              {loading ? (
                <span className="spinner dark" />
              ) : user ? (
                showClaim ? (
                  <>
                    {claimError && <div className="notice error">{claimError}</div>}
                    <div className="field">
                      <label>What proves this is yours? (context for the reviewer)</label>
                      <textarea
                        value={note}
                        maxLength={1000}
                        placeholder="Where did you lose it, what else is inside, etc."
                        onChange={(event) => setNote(event.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        disabled={claiming || note.trim().length < 5}
                        onClick={() => void submitClaim()}
                      >
                        {claiming ? <span className="spinner" /> : "Start verification"}
                      </button>
                      <button type="button" className="btn secondary" onClick={() => setShowClaim(false)}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="btn" onClick={() => setShowClaim(true)}>
                    I&apos;m the owner - claim it
                  </button>
                )
              ) : (
                <Link href={`/login?next=/items/${item.id}`} className="btn">
                  Sign in to claim
                </Link>
              )}
            </div>
          ) : null}

          {matches && matches.length > 0 && (
            <div className="card plain mb">
              <h3>Suggested matches</h3>
              <div className="list">
                {matches.slice(0, 5).map((match) => (
                  <Link
                    key={match.id}
                    href={`/items/${match.item?.id ?? ""}`}
                    className="row-card"
                    style={{ color: "inherit", padding: "10px 12px" }}
                  >
                    <div className="grow">
                      <strong style={{ fontSize: "0.92rem" }}>{match.item?.title}</strong>
                      <div className="sub">
                        {match.score.toFixed(2)} · {match.reasons.slice(0, 2).join(" · ")}
                      </div>
                    </div>
                    <span className="badge">{Math.round(match.score * 100)}%</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {isModeratorRole(user?.role) && (
            <div className="card plain">
              <h3>Staff actions</h3>
              <p className="muted" style={{ fontSize: "0.88rem" }}>
                Manage custody movements, verification review and handovers from the Security console.
              </p>
              <Link href="/security" className="btn secondary">
                Open security console
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ItemDetailPage() {
  return (
    <Suspense fallback={<div className="container page"><div className="skeleton" /></div>}>
      <Detail />
    </Suspense>
  );
}
