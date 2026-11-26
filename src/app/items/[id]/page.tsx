"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  AlertIcon,
  ArrowRightIcon,
  BoxIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  LockIcon,
  MapPinIcon,
  SearchIcon,
  ShieldCheckIcon,
  TagIcon,
  UserIcon,
} from "@/components/icons";
import { api, formatDate, timeAgo } from "@/lib/client/api";
import { categoryArtwork } from "@/lib/category-art";
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

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  const [activeImage, setActiveImage] = useState(0);

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
    setActiveImage(0);
  }, [item?.id]);

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
          <span className="empty-icon">
            <AlertIcon size={26} />
          </span>
          <h3>We couldn&apos;t open this listing</h3>
          <p>{error}</p>
          <div className="empty-actions">
            <Link href="/board" className="btn secondary">
              Back to board
            </Link>
          </div>
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
  const images = item.images;
  const currentImage = images[activeImage] ?? images[0];
  const artwork = images.length === 0 ? categoryArtwork(item.category.id) : null;
  const mainImage = currentImage ?? artwork?.src;

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
    <div className="container page detail-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/board">Board</Link>
        <ChevronRightIcon size={13} />
        <span aria-current="page">{item.title}</span>
      </nav>

      {search.get("created") && (
        <div className="notice success" role="status">
          <CheckCircleIcon size={18} />
          <span>Report filed. Match suggestions are being generated.</span>
        </div>
      )}

      <div className="page-head detail-head">
        <div>
          <div className="badge-row">
            <span className={`badge ${item.type}`}>
              <span className="badge-dot" aria-hidden="true" />
              {item.type === "lost" ? "Lost item" : "Found item"}
            </span>
            <span className="badge">{titleCase(item.status)}</span>
            {item.hasVerification && (
              <span className="badge privacy">
                <ShieldCheckIcon size={12} /> Ownership verified
              </span>
            )}
          </div>
          <h1>{item.title}</h1>
          <div className="detail-meta">
            <span>
              <ClockIcon size={14} /> Reported {timeAgo(item.postedAt)}
            </span>
            <span>
              <CalendarIcon size={14} /> Happened {formatDate(item.occurredAt)}
            </span>
          </div>
        </div>
        <Link href="/board" className="btn secondary">
          Back to board
        </Link>
      </div>

      <div className="detail">
        <div className="gallery">
          <div className="main">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mainImage} alt={item.title} />
            ) : (
              <span className="main-placeholder">
                {item.type === "found" ? <BoxIcon size={54} /> : <SearchIcon size={54} />}
                <small>No photo provided</small>
              </span>
            )}
          </div>
          {artwork && (
            <p className="gallery-note">
              {artwork.label} illustration shown — no photo was provided with this report.
            </p>
          )}
          {images.length > 1 && (
            <div className="photo-strip gallery-thumbs">
              {images.map((image, index) => (
                <button
                  type="button"
                  className={`thumb-btn ${index === activeImage ? "active" : ""}`}
                  key={image}
                  onClick={() => setActiveImage(index)}
                  aria-label={`View photo ${index + 1} of ${images.length}`}
                  aria-pressed={index === activeImage}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}

          <div className="card plain">
            <h2 className="card-title">Description</h2>
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
              <h2 className="card-title">Custody chain</h2>
              <p className="muted card-sub">Every supervised movement, in order.</p>
              <ul className="chain">
                {chain.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>
                        {row.seq}. {titleCase(row.action)}
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

        <aside className="detail-side">
          <div className="card plain mb">
            <h2 className="card-title">At a glance</h2>
            <dl className="kv">
              <dt>
                <TagIcon size={14} /> Category
              </dt>
              <dd>{item.category.name}</dd>
              <dt>
                <MapPinIcon size={14} /> Location
              </dt>
              <dd>{item.location.path.join(" › ")}</dd>
              <dt>
                <CalendarIcon size={14} /> Posted
              </dt>
              <dd>{formatDate(item.postedAt)}</dd>
              <dt>
                <CheckCircleIcon size={14} /> Status
              </dt>
              <dd>{titleCase(item.status)}</dd>
            </dl>
            <div className="notice privacy-inline">
              <LockIcon size={17} />
              <span>Contact details and secret identifying marks are never shown here.</span>
            </div>
          </div>

          {myClaim ? (
            <div className="card plain mb claim-card">
              <div className="claim-card-head">
                <span className="claim-icon">
                  <CheckCircleIcon size={20} />
                </span>
                <h2 className="card-title">Your claim</h2>
              </div>
              <p className="muted">Status: {titleCase(myClaim.status)}</p>
              <Link href={`/claims/${myClaim.id}`} className="btn btn-block">
                Open claim <ArrowRightIcon size={16} />
              </Link>
            </div>
          ) : item.claimable ? (
            <div className="card plain mb claim-card">
              <div className="claim-card-head">
                <span className="claim-icon">
                  <ShieldCheckIcon size={20} />
                </span>
                <h2 className="card-title">Is this yours?</h2>
              </div>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                Starting a claim opens a verification challenge based on the finder&apos;s secret details.
                Passing it lets security approve a supervised handover.
              </p>
              {loading ? (
                <span className="spinner dark" />
              ) : user ? (
                showClaim ? (
                  <>
                    {claimError && (
                      <div className="notice error" role="alert">
                        <AlertIcon size={16} />
                        <span>{claimError}</span>
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor="claim-note">What proves this is yours? (context for the reviewer)</label>
                      <textarea
                        id="claim-note"
                        value={note}
                        maxLength={1000}
                        placeholder="Where did you lose it, what else is inside, etc."
                        onChange={(event) => setNote(event.target.value)}
                      />
                    </div>
                    <div className="claim-actions">
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
                  <button type="button" className="btn btn-block" onClick={() => setShowClaim(true)}>
                    I&apos;m the owner — claim it <ArrowRightIcon size={16} />
                  </button>
                )
              ) : (
                <Link href={`/login?next=/items/${item.id}`} className="btn btn-block">
                  Sign in to claim
                </Link>
              )}
            </div>
          ) : null}

          {matches && matches.length > 0 && (
            <div className="card plain mb">
              <h2 className="card-title">Suggested matches</h2>
              <p className="muted card-sub">Reports that look similar to this one.</p>
              <div className="list">
                {matches.slice(0, 5).map((match) => (
                  <Link
                    key={match.id}
                    href={`/items/${match.item?.id ?? ""}`}
                    className="row-card match-row"
                  >
                    <div className="grow">
                      <strong style={{ fontSize: "0.92rem" }}>{match.item?.title}</strong>
                      <div className="sub">{match.reasons.slice(0, 2).join(" · ")}</div>
                    </div>
                    <span className="badge claim">{Math.round(match.score * 100)}%</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {isModeratorRole(user?.role) && (
            <div className="card plain">
              <div className="claim-card-head">
                <span className="claim-icon">
                  <UserIcon size={20} />
                </span>
                <h2 className="card-title">Staff actions</h2>
              </div>
              <p className="muted" style={{ fontSize: "0.88rem" }}>
                Manage custody movements, verification review and handovers from the Security console.
              </p>
              <Link href="/security" className="btn secondary btn-block">
                Open security console <ArrowRightIcon size={16} />
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function ItemDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="container page">
          <div className="skeleton" />
        </div>
      }
    >
      <Detail />
    </Suspense>
  );
}
