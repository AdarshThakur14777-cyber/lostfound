"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useMe, isConfigRole } from "@/lib/client/me";
import type { PublicCategory, PublicLocation } from "@/lib/serialize/public";

interface Reports {
  totals: {
    reported: number;
    lost: number;
    found: number;
    returned: number;
    disposed: number;
    open: number;
    inCustody: number;
    disposalPending: number;
  };
  returnRate: number;
  medianHoursToReturn: number | null;
  hotspots: { locationId: string; name: string; count: number }[];
  categories: { categoryId: string; name: string; count: number }[];
  ageing: { dueForDisposal: number; ageingWarnings: number; retentionDays: number };
  verification: { attempted: number; failed: number; failureRate: number };
  disposals: { recorded: number };
  pendingMatches: number;
}

interface Settings {
  retentionDays: number;
  ageingWarningDays: number;
  challengeCount: number;
  requiredCorrect: number;
  maxClaimAttempts: number;
  matchThreshold: number;
  matchTopK: number;
  timeHalfLifeDays: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
}

export default function AdminPage() {
  const { user, loading } = useMe();
  const [tab, setTab] = useState<"overview" | "taxonomy" | "settings" | "users">("overview");
  const [reports, setReports] = useState<Reports | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [locations, setLocations] = useState<PublicLocation[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !isConfigRole(user.role)) return;
    try {
      const [r, t, s, u] = await Promise.all([
        api<Reports>("/api/admin/reports"),
        api<{ categories: PublicCategory[]; locations: PublicLocation[] }>("/api/taxonomy"),
        api<{ settings: Settings }>("/api/admin/settings"),
        api<{ users: UserRow[] }>("/api/admin/users"),
      ]);
      setReports(r);
      setCategories(t.categories);
      setLocations(t.locations);
      setSettings(s.settings);
      setUsers(u.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="container page"><div className="skeleton" /></div>;

  if (!user || !isConfigRole(user.role)) {
    return (
      <div className="container page">
        <div className="empty">
          <p>The administration dashboard is available to campus and system administrators.</p>
          <Link href="/login?next=/admin" className="btn">
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
          <h1>Administration</h1>
          <p>Inventory · retention · taxonomy · users · reporting.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              void (async () => {
                try {
                  const result = await api<{ checked: number; suggestions: number }>(
                    "/api/admin/matches/refresh",
                    { method: "POST", body: "{}" },
                  );
                  setNotice(`Match refresh: ${result.checked} reports, ${result.suggestions} suggestions.`);
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Refresh failed");
                }
              })()
            }
          >
            Refresh matches
          </button>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}
      {notice && <div className="notice success">{notice}</div>}

      <div className="tabs">
        <button type="button" className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button type="button" className={tab === "taxonomy" ? "active" : ""} onClick={() => setTab("taxonomy")}>
          Categories &amp; locations
        </button>
        <button type="button" className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          Retention &amp; matching
        </button>
        <button type="button" className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Users
        </button>
      </div>

      {tab === "overview" && reports && <Overview reports={reports} onAgeing={load} />}
      {tab === "overview" && !reports && <div className="skeleton" style={{ height: 240 }} />}

      {tab === "taxonomy" && (
        <TaxonomyPanel
          categories={categories}
          locations={locations}
          onChanged={load}
          onError={setError}
        />
      )}

      {tab === "settings" && settings && (
        <SettingsPanel settings={settings} onSaved={load} onError={setError} onNotice={setNotice} />
      )}

      {tab === "users" && <UsersPanel users={users} onChanged={load} onError={setError} />}
    </div>
  );
}

function Overview({ reports, onAgeing }: { reports: Reports; onAgeing: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const maxHot = Math.max(1, ...reports.hotspots.map((row) => row.count));
  const maxCat = Math.max(1, ...reports.categories.map((row) => row.count));

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="value">{reports.totals.reported}</div>
          <div className="label">Reported</div>
        </div>
        <div className="stat">
          <div className="value">{reports.totals.returned}</div>
          <div className="label">Returned</div>
        </div>
        <div className="stat">
          <div className="value">{Math.round(reports.returnRate * 100)}%</div>
          <div className="label">Return rate</div>
        </div>
        <div className="stat">
          <div className="value">
            {reports.medianHoursToReturn === null
              ? "—"
              : reports.medianHoursToReturn < 48
                ? `${Math.round(reports.medianHoursToReturn)}h`
                : `${Math.round(reports.medianHoursToReturn / 24)}d`}
          </div>
          <div className="label">Median time to return</div>
        </div>
      </div>

      <div className="grid two mb">
        <div className="card plain">
          <h3>Loss hotspots</h3>
          <div className="bars">
            {reports.hotspots.slice(0, 6).map((row) => (
              <div className="bar-row" key={row.locationId}>
                <span>{row.name}</span>
                <div className="track">
                  <div className="fill" style={{ width: `${(row.count / maxHot) * 100}%` }} />
                </div>
                <span className="num">{row.count}</span>
              </div>
            ))}
            {reports.hotspots.length === 0 && <p className="muted">No data yet.</p>}
          </div>
        </div>

        <div className="card plain">
          <h3>Category distribution</h3>
          <div className="bars">
            {reports.categories.slice(0, 6).map((row) => (
              <div className="bar-row" key={row.categoryId}>
                <span>{row.name}</span>
                <div className="track">
                  <div className="fill" style={{ width: `${(row.count / maxCat) * 100}%` }} />
                </div>
                <span className="num">{row.count}</span>
              </div>
            ))}
            {reports.categories.length === 0 && <p className="muted">No data yet.</p>}
          </div>
        </div>
      </div>

      <div className="grid three mb">
        <div className="stat">
          <div className="value">{reports.totals.inCustody}</div>
          <div className="label">In custody</div>
        </div>
        <div className="stat">
          <div className="value">{reports.totals.disposalPending}</div>
          <div className="label">Disposal queue</div>
        </div>
        <div className="stat">
          <div className="value">{Math.round(reports.verification.failureRate * 100)}%</div>
          <div className="label">Verification failure rate</div>
        </div>
      </div>

      <div className="notice">
        {reports.ageing.dueForDisposal} item(s) past the {reports.ageing.retentionDays}-day retention ·{" "}
        {reports.ageing.ageingWarnings} nearing it · {reports.pendingMatches} match suggestions pending review ·{" "}
        {reports.disposals.recorded} disposal record(s).
      </div>

      <button
        type="button"
        className="btn secondary"
        disabled={busy}
        onClick={() =>
          void (async () => {
            setBusy(true);
            try {
              await api("/api/admin/ageing", { method: "POST", body: "{}" });
              await onAgeing();
            } finally {
              setBusy(false);
            }
          })()
        }
      >
        {busy ? <span className="spinner dark" /> : "Run ageing pass"}
      </button>
    </div>
  );
}

function TaxonomyPanel({
  categories,
  locations,
  onChanged,
  onError,
}: {
  categories: PublicCategory[];
  locations: PublicLocation[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [catName, setCatName] = useState("");
  const [catParent, setCatParent] = useState("");
  const [catAttrs, setCatAttrs] = useState("");
  const [locName, setLocName] = useState("");
  const [locParent, setLocParent] = useState("");

  async function addCategory() {
    try {
      await api("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          name: catName,
          parentId: catParent || null,
          attributes: catAttrs
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      setCatName("");
      setCatAttrs("");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function addLocation() {
    try {
      await api("/api/admin/locations", {
        method: "POST",
        body: JSON.stringify({ name: locName, parentId: locParent || null }),
      });
      setLocName("");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function remove(kind: "category" | "location", id: string) {
    try {
      await api(`/api/admin/${kind === "category" ? "categories" : "locations"}/${id}`, { method: "DELETE" });
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="grid two">
      <div className="card plain">
        <h3>Categories</h3>
        <div className="list mb">
          {categories.map((category) => (
            <div className="row-card" key={category.id} style={{ padding: "9px 12px" }}>
              <div className="grow">
                <strong style={{ fontSize: "0.92rem" }}>
                  {category.parentId ? "↳ " : ""}
                  {category.name}
                </strong>
                {category.attributes.length > 0 && (
                  <div className="sub">attributes: {category.attributes.join(", ")}</div>
                )}
              </div>
              <button type="button" className="btn ghost small" onClick={() => void remove("category", category.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <div className="field">
          <label>New category</label>
          <input type="text" value={catName} placeholder="Name" onChange={(e) => setCatName(e.target.value)} />
        </div>
        <div className="field">
          <label>Parent</label>
          <select value={catParent} onChange={(e) => setCatParent(e.target.value)}>
            <option value="">Top level</option>
            {categories.filter((category) => !category.parentId).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Attributes (comma separated)</label>
          <input
            type="text"
            value={catAttrs}
            placeholder="colour, brand"
            onChange={(e) => setCatAttrs(e.target.value)}
          />
        </div>
        <button type="button" className="btn" disabled={catName.trim().length < 2} onClick={() => void addCategory()}>
          Add category
        </button>
      </div>

      <div className="card plain">
        <h3>Campus locations</h3>
        <div className="list mb" style={{ maxHeight: 360, overflow: "auto" }}>
          {locations.map((location) => (
            <div className="row-card" key={location.id} style={{ padding: "9px 12px" }}>
              <div className="grow" style={{ fontSize: "0.9rem" }}>
                {location.path.join(" › ")}
              </div>
              <button type="button" className="btn ghost small" onClick={() => void remove("location", location.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <div className="field">
          <label>New location</label>
          <input type="text" value={locName} placeholder="Name" onChange={(e) => setLocName(e.target.value)} />
        </div>
        <div className="field">
          <label>Parent</label>
          <select value={locParent} onChange={(e) => setLocParent(e.target.value)}>
            <option value="">Top level</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.path.join(" › ")}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn" disabled={locName.trim().length < 2} onClick={() => void addLocation()}>
          Add location
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({
  settings,
  onSaved,
  onError,
  onNotice,
}: {
  settings: Settings;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const [form, setForm] = useState<Settings>(settings);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(settings), [settings]);

  const numberField = (key: keyof Settings, label: string, min: number, max: number) => (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
      />
    </div>
  );

  return (
    <div className="card plain" style={{ maxWidth: 640 }}>
      <div className="row-inline">
        {numberField("retentionDays", "Retention before disposal (days)", 1, 365)}
        {numberField("ageingWarningDays", "Ageing warning window (days)", 1, 120)}
      </div>
      <div className="row-inline">
        {numberField("challengeCount", "Questions per challenge", 1, 6)}
        {numberField("requiredCorrect", "Correct answers required", 1, 6)}
      </div>
      <div className="row-inline">
        {numberField("maxClaimAttempts", "Max claim attempts", 1, 10)}
        {numberField("matchTopK", "Suggestions per report", 1, 20)}
      </div>
      <div className="row-inline">
        {numberField("matchThreshold", "Match score threshold (0-1)", 0, 1)}
        {numberField("timeHalfLifeDays", "Time proximity half-life (days)", 1, 60)}
      </div>
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() =>
          void (async () => {
            setBusy(true);
            try {
              await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(form) });
              onNotice("Settings saved.");
              await onSaved();
            } catch (err) {
              onError(err instanceof Error ? err.message : "Save failed");
            } finally {
              setBusy(false);
            }
          })()
        }
      >
        {busy ? <span className="spinner" /> : "Save settings"}
      </button>
    </div>
  );
}

function UsersPanel({
  users,
  onChanged,
  onError,
}: {
  users: UserRow[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      setName("");
      setEmail("");
      setPassword("");
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid two">
      <div className="card plain">
        <h3>Accounts</h3>
        <div className="list" style={{ maxHeight: 460, overflow: "auto" }}>
          {users.map((row) => (
            <div className="row-card" key={row.id} style={{ padding: "9px 12px" }}>
              <div className="grow">
                <strong style={{ fontSize: "0.92rem" }}>{row.name}</strong>
                <div className="sub">
                  {row.email} · {row.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card plain">
        <h3>Create account</h3>
        <p className="muted" style={{ fontSize: "0.88rem" }}>
          Security and administrator accounts are created here, never through open registration.
        </p>
        <div className="field">
          <label>Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
            <option value="security">Security</option>
            <option value="admin">Campus administrator</option>
            <option value="sysadmin">System administrator</option>
          </select>
        </div>
        <button
          type="button"
          className="btn"
          disabled={busy || !name || !email || password.length < 8}
          onClick={() => void create()}
        >
          Create
        </button>
      </div>
    </div>
  );
}
