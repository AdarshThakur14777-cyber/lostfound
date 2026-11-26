"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, timeAgo } from "@/lib/client/api";
import { MeContext, isConfigRole, isModeratorRole, type Me, type MeState } from "@/lib/client/me";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  at: string;
}

function Bell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ notifications: NotificationRow[]; unreadCount: number }>(
        "/api/notifications?unread=1",
      );
      setUnread(data.unreadCount);
      const all = await api<{ notifications: NotificationRow[] }>("/api/notifications");
      setRows(all.notifications.slice(0, 15));
    } catch {
      setRows([]);
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 45_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markRead() {
    try {
      await api("/api/notifications/read", { method: "POST", body: "{}" });
      setUnread(0);
      setRows((current) => current.map((row) => ({ ...row, read: true })));
    } catch {
      /* ignore */
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="bell"
        aria-label="Notifications"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
      >
        🔔
        {unread > 0 && <span className="dot">{unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>Notifications</strong>
            <button type="button" className="btn ghost small" onClick={markRead}>
              Mark all read
            </button>
          </div>
          {rows.length === 0 && <div className="row muted">Nothing yet.</div>}
          {rows.map((row) => (
            <a
              key={row.id}
              href={row.link ?? "#"}
              className={`row ${row.read ? "" : "unread"}`}
              style={{ display: "block", color: "inherit" }}
              onClick={() => setOpen(false)}
            >
              <strong>{row.title}</strong>
              <span>
                {row.body} · {timeAgo(row.at)}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: Me | null }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
    } finally {
      setUser(null);
      router.push("/");
    }
  }, [router]);

  const state: MeState = { user, loading, refresh, logout };
  const navClass = (href: string) => (pathname === href ? "active" : "");

  return (
    <MeContext.Provider value={state}>
      <header className="site-header">
        <div className="container inner">
          <Link href="/" className="logo">
            <span className="mark" />
            Campus Lost &amp; Found
          </Link>
          <nav className="nav">
            <Link href="/board" className={navClass("/board")}>
              Board
            </Link>
            <Link href="/report" className={navClass("/report")}>
              Report
            </Link>
            {user && (
              <Link href="/me" className={navClass("/me")}>
                My items
              </Link>
            )}
            {user && isModeratorRole(user.role) && (
              <Link href="/security" className={`${navClass("/security")} hide-sm`}>
                Security
              </Link>
            )}
            {user && isConfigRole(user.role) && (
              <Link href="/admin" className={`${navClass("/admin")} hide-sm`}>
                Admin
              </Link>
            )}
            {user && <Bell />}
            {!user && !loading && (
              <>
                <Link href="/login" className="hide-sm">
                  Sign in
                </Link>
                <Link href="/register" className="btn small">
                  Register
                </Link>
              </>
            )}
            {user && (
              <button type="button" className="btn secondary small" onClick={() => void logout()}>
                Sign out
              </button>
            )}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="container">
          <strong>Campus Lost &amp; Found</strong> · Public board is redacted: identifying details are held
          privately and used only for ownership verification. Handovers are supervised and recorded in a
          custody chain.
        </div>
      </footer>
    </MeContext.Provider>
  );
}
