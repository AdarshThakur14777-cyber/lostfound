"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate, timeAgo } from "@/lib/client/api";
import { useMe, isModeratorRole } from "@/lib/client/me";
import type { PublicItem, PublicLocation } from "@/lib/serialize/public";

interface QueueResponse {
  ageing: { id: string; title: string; type: string; ageDays: number; remainingDays: number; due: boolean }[];
  disposalQueue: { id: string; title: string; type: string; ageDays: number; category: string }[];
  verificationQueue: {
    id: string;
    itemId: string;
    itemTitle: string;
    claimantName: string;
    status: string;
    passed: boolean;
    attempts: number;
    createdAt: string;
  }[];
  custodyInventory: { locationId: string; name: string; count: number }[];
}

interface HandoverRow {
  id: string;
  claimId: string;
  itemId: string;
  status: string;
  method: string;
  createdAt: string;
  itemTitle: string;
  itemImages: string[];
  claimantName: string;
  claimantEmail: string;
}

export default function SecurityPage() {
  const { user, loading } = useMe();
  const [tab, setTab] = useState<"verify" | "handover" | "ageing" | "custody">("verify");
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [handovers, setHandovers] = useState<HandoverRow[]>([]);
  const [approvedClaims, setApprovedClaims] = useState<
    { id: string; itemTitle: string; claimantName: string }[]
  >([]);
  const [items, setItems] = useState<PublicItem[]>([]);
  const [locations, setLocations] = useState<PublicLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !isModeratorRole(user.role)) return;
    try {
      const [q, h, c, i, t] = await Promise.all([
        api<QueueResponse>("/api/admin/queue"),
        api<{ handovers: HandoverRow[] }>("/api/handovers?status=scheduled"),
        api<{ claims: { id: string; itemTitle: string; claimantName: string }[] }>("/api/claims?scope=queue"),
        api<{ items: PublicItem[] }>("/api/items?scope=all"),
        api<{ locations: PublicLocation[] }>("/api/taxonomy"),
      ]);
      setQueue(q);
      setHandovers(h.handovers);
      setApprovedClaims(
        c.claims
          .filter((claim) => (claim as unknown as { status: string }).status === "approved")
          .map((claim) => ({
            id: claim.id,
            itemTitle: claim.itemTitle,
            claimantName: claim.claimantName,
          })),
      );
      setItems(i.items);
      setLocations(t.locations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the console");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="container page"><div className="skeleton" /></div>;

  if (!user || !isModeratorRole(user.role)) {
    return (
      <div className="container page">
        <div className="empty">
          <p>The security console is available to security, admin and system admin accounts.</p>
          <Link href="/login?next=/security" className="btn">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  async function act(key: string, fn: () => Promise<string | null>) {
    setBusyId(key);
    setError(null);
    setNotice(null);
    const message = await fn();
    if (message) setNotice(message);
    await load();
    setBusyId(null);
  }

  const decide = (claimId: string, decision: "approve" | "reject") =>
    act(`claim-${claimId}`, async () => {
      try {
        await api(`/api/claims/${claimId}/decision`, {
          method: "POST",
          body: JSON.stringify({ decision }),
        });
        return decision === "approve" ? "Claim approved." : "Claim rejected.";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Decision failed");
        return null;
      }
    });

  const schedule = (claimId: string) =>
    act(`sched-${claimId}`, async () => {
      try {
        await api("/api/handovers", {
          method: "POST",
          body: JSON.stringify({ claimId, method: "otp" }),
        });
        return "Handover scheduled - the claimant has been sent a one-time code.";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not schedule");
        return null;
      }
    });

  const queueClaims = queue?.verificationQueue ?? [];

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Security console</h1>
          <p>Verification review · supervised handovers · custody · disposal.</p>
        </div>
        <button type="button" className="btn secondary" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}

      <div className="tabs">
        <button type="button" className={tab === "verify" ? "active" : ""} onClick={() => setTab("verify")}>
          Verification queue ({queueClaims.length})
        </button>
        <button
          type="button"
          className={tab === "handover" ? "active" : ""}
          onClick={() => setTab("handover")}
        >
          Handovers ({handovers.length})
        </button>
        <button type="button" className={tab === "ageing" ? "active" : ""} onClick={() => setTab("ageing")}>
          Ageing &amp; disposal
        </button>
        <button type="button" className={tab === "custody" ? "active" : ""} onClick={() => setTab("custody")}>
          Custody
        </button>
      </div>

      {queue === null && <div className="skeleton" style={{ height: 240 }} />}

      {queue && tab === "verify" && (
        <div className="list">
          {queueClaims.length === 0 && <div className="empty">No claims waiting for review.</div>}
          {queueClaims.map((claim) => (
            <div className="row-card" key={claim.id}>
              <div className="grow">
                <strong>{claim.itemTitle}</strong>
                <div className="sub">
                  {claim.claimantName} · {claim.status.replace(/_/g, " ")} · {timeAgo(claim.createdAt)}
                </div>
                <div className="sub">
                  {claim.passed ? "✅ Verification passed" : "⏳ Verification in progress"} · {claim.attempts}{" "}
                  attempt(s)
                </div>
              </div>
              <Link href={`/claims/${claim.id}`} className="btn secondary small">
                Inspect
              </Link>
              <button
                type="button"
                className="btn success small"
                disabled={busyId === `claim-${claim.id}` || !claim.passed}
                title={claim.passed ? "Approve" : "Verification must pass first"}
                onClick={() => void decide(claim.id, "approve")}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn danger small"
                disabled={busyId === `claim-${claim.id}`}
                onClick={() => void decide(claim.id, "reject")}
              >
                Reject
              </button>
            </div>
          ))}
          {approvedClaims.length > 0 && (
            <>
              <h3 className="mt">Approved - schedule handover</h3>
              {approvedClaims.map((claim) => (
                <div className="row-card" key={claim.id}>
                  <div className="grow">
                    <strong>{claim.itemTitle}</strong>
                    <div className="sub">{claim.claimantName}</div>
                  </div>
                  <button
                    type="button"
                    className="btn small"
                    disabled={busyId === `sched-${claim.id}`}
                    onClick={() => void schedule(claim.id)}
                  >
                    Schedule OTP handover
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === "handover" && <HandoverList rows={handovers} busyId={busyId} act={act} />}

      {queue && tab === "ageing" && (
        <div>
          <div className="notice warn">
            {queue.ageing.filter((row) => row.due).length} item(s) past retention ·{" "}
            {queue.ageing.filter((row) => !row.due).length} nearing disposal.
          </div>
          <AgeingRunButton onDone={load} />
          <h3>Ageing items</h3>
          <div className="list mb">
            {queue.ageing.length === 0 && <div className="empty">Nothing is ageing right now.</div>}
            {queue.ageing.map((row) => (
              <div className="row-card" key={row.id}>
                <div className="grow">
                  <Link href={`/items/${row.id}`}>
                    <strong>{row.title}</strong>
                  </Link>
                  <div className="sub">
                    {row.type} · {row.ageDays}d old ·{" "}
                    {row.remainingDays <= 0 ? "due for disposal" : `${row.remainingDays}d remaining`}
                  </div>
                </div>
                <span className={`badge ${row.due ? "lost" : ""}`}>{row.due ? "due" : "warning"}</span>
              </div>
            ))}
          </div>

          <h3>Disposal queue</h3>
          <div className="list">
            {queue.disposalQueue.length === 0 && <div className="empty">Disposal queue is empty.</div>}
            {queue.disposalQueue.map((row) => (
              <DisposalRow key={row.id} row={row} busy={busyId === row.id} onAct={act} />
            ))}
          </div>
        </div>
      )}

      {queue && tab === "custody" && (
        <div>
          <h3>Inventory by custody location</h3>
          <div className="bars mb">
            {queue.custodyInventory.map((entry) => (
              <div className="bar-row" key={entry.locationId}>
                <span>{entry.name}</span>
                <div className="track">
                  <div
                    className="fill"
                    style={{
                      width: `${Math.round(
                        (entry.count /
                          Math.max(1, ...queue.custodyInventory.map((row) => row.count))) *
                            100,
                      )}%`,
                    }}
                  />
                </div>
                <span className="num">{entry.count}</span>
              </div>
            ))}
          </div>

          <h3>Record a custody movement</h3>
          <div className="list">
            {items
              .filter((item) => ["open", "claim_pending", "in_custody", "disposal_pending"].includes(item.status))
              .slice(0, 30)
              .map((item) => (
                <MoveRow
                  key={item.id}
                  item={item}
                  locations={locations}
                  busy={busyId === `move-${item.id}`}
                  onAct={act}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DisposalRow({
  row,
  busy,
  onAct,
}: {
  row: { id: string; title: string; ageDays: number };
  busy: boolean;
  onAct: (key: string, fn: () => Promise<string | null>) => Promise<void>;
}) {
  const [method, setMethod] = useState("discarded");
  return (
    <div className="row-card">
      <div className="grow">
        <strong>{row.title}</strong>
        <div className="sub">{row.ageDays} days old</div>
      </div>
      <select value={method} onChange={(event) => setMethod(event.target.value)} style={{ width: "auto" }}>
        <option value="discarded">Discard</option>
        <option value="donated">Donate</option>
        <option value="archive">Archive</option>
      </select>
      <button
        type="button"
        className="btn danger small"
        disabled={busy}
        onClick={() =>
          void onAct(`dispose-${row.id}`, async () => {
            try {
              await api(`/api/admin/items/${row.id}/dispose`, {
                method: "POST",
                body: JSON.stringify({ method }),
              });
              return "Item disposed and recorded.";
            } catch (err) {
              return err instanceof Error ? `Error: ${err.message}` : null;
            }
          })
        }
      >
        Dispose
      </button>
    </div>
  );
}

function AgeingRunButton({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn secondary mb"
      disabled={busy}
      onClick={() =>
        void (async () => {
          setBusy(true);
          try {
            await api("/api/admin/ageing", { method: "POST", body: "{}" });
            await onDone();
          } finally {
            setBusy(false);
          }
        })()
      }
    >
      {busy ? <span className="spinner dark" /> : "Run ageing pass now"}
    </button>
  );
}

function HandoverList({
  rows,
  busyId,
  act,
}: {
  rows: HandoverRow[];
  busyId: string | null;
  act: (key: string, fn: () => Promise<string | null>) => Promise<void>;
}) {
  if (rows.length === 0) return <div className="empty">No handovers are scheduled.</div>;
  return (
    <div className="list">
      {rows.map((row) => (
        <HandoverCard key={row.id} row={row} busy={busyId === row.id} act={act} />
      ))}
    </div>
  );
}

function HandoverCard({
  row,
  busy,
  act,
}: {
  row: HandoverRow;
  busy: boolean;
  act: (key: string, fn: () => Promise<string | null>) => Promise<void>;
}) {
  const [otp, setOtp] = useState("");
  const [signature, setSignature] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function upload(fileList: FileList | null) {
    if (!fileList?.[0]) return;
    setUploading(true);
    setLocalError(null);
    try {
      const form = new FormData();
      form.append("file", fileList[0]);
      const result = await api<{ paths: string[] }>("/api/uploads", { method: "POST", body: form });
      setProof(result.paths[0] ?? null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="row-card" style={{ alignItems: "flex-start", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 12, width: "100%", alignItems: "center", flexWrap: "wrap" }}>
        <div className="grow">
          <strong>{row.itemTitle}</strong>
          <div className="sub">
            {row.claimantName} ({row.claimantEmail}) · {row.method.toUpperCase()} · scheduled{" "}
            {formatDate(row.createdAt)}
          </div>
        </div>
        <span className="badge claim">{row.status}</span>
      </div>

      {localError && <div className="notice error">{localError}</div>}

      <div className="row-inline" style={{ width: "100%", alignItems: "flex-end" }}>
        {row.method === "otp" ? (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Claimant&apos;s one-time code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
          </div>
        ) : (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Claimant signature (typed name)</label>
            <input
              type="text"
              maxLength={120}
              value={signature}
              onChange={(event) => setSignature(event.target.value)}
            />
          </div>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Proof photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void upload(event.target.files)}
          />
          <div className="hint">{proof ? "✅ Photo attached" : uploading ? "Uploading…" : "Required"}</div>
        </div>
      </div>

      <button
        type="button"
        className="btn success small"
        disabled={busy || !proof || (row.method === "otp" ? otp.length < 4 : signature.trim().length < 2)}
        onClick={() =>
          void act(`complete-${row.id}`, async () => {
            try {
              await api(`/api/handovers/${row.id}/complete`, {
                method: "POST",
                body: JSON.stringify({
                  otp: row.method === "otp" ? otp : undefined,
                  signatureName: row.method === "signature" ? signature : undefined,
                  proofImage: proof,
                }),
              });
              return "Handover completed and custody chain updated.";
            } catch (err) {
              return err instanceof Error ? `Error: ${err.message}` : null;
            }
          })
        }
      >
        {busy ? <span className="spinner" /> : "Complete handover"}
      </button>
    </div>
  );
}

function MoveRow({
  item,
  locations,
  busy,
  onAct,
}: {
  item: PublicItem;
  locations: PublicLocation[];
  busy: boolean;
  onAct: (key: string, fn: () => Promise<string | null>) => Promise<void>;
}) {
  const [locationId, setLocationId] = useState(item.location.id);
  const [note, setNote] = useState("");

  return (
    <div className="row-card">
      <div className="grow">
        <Link href={`/items/${item.id}`}>
          <strong>{item.title}</strong>
        </Link>
        <div className="sub">
          {item.status.replace(/_/g, " ")} · now at {item.location.name}
        </div>
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          maxLength={300}
          style={{ marginTop: 6, maxWidth: 260 }}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <select value={locationId} onChange={(event) => setLocationId(event.target.value)} style={{ width: "auto" }}>
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.path.join(" › ")}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn secondary small"
        disabled={busy}
        onClick={() =>
          void onAct(`move-${item.id}`, async () => {
            try {
              await api(`/api/items/${item.id}/custody`, {
                method: "POST",
                body: JSON.stringify({ action: "moved", toLocationId: locationId, note: note || undefined }),
              });
              return "Custody movement recorded.";
            } catch (err) {
              return err instanceof Error ? `Error: ${err.message}` : null;
            }
          })
        }
      >
        Move
      </button>
    </div>
  );
}
