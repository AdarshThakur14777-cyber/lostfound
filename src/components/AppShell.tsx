"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, timeAgo } from "@/lib/client/api";
import { MeContext, isConfigRole, isModeratorRole, type Me, type MeState } from "@/lib/client/me";
import {
  BellIcon,
  BoxIcon,
  BrandMark,
  ChevronDownIcon,
  GridIcon,
  LogInIcon,
  LogOutIcon,
  PlusCircleIcon,
  ShieldCheckIcon,
  SlidersIcon,
  UserIcon,
} from "./icons";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  at: string;
}

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  staff: "Staff",
  security: "Security",
  admin: "Admin",
  sysadmin: "System admin",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Bell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<{ notifications: NotificationRow[]; unreadCount: number }>("/api/notifications");
      setUnread(data.unreadCount);
      setRows(data.notifications.slice(0, 15));
    } catch {
      setRows([]);
      setUnread(0);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(load, 45_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function markRead() {
    setBusy(true);
    try {
      await api("/api/notifications", { method: "POST", body: "{}" });
      setUnread(0);
      setRows((current) => current.map((row) => ({ ...row, read: true })));
    } catch {
      /* keep the badge if it fails */
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="bell-wrap">
      <button
        type="button"
        className={`bell ${open ? "is-open" : ""}`}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void load();
        }}
      >
        <BellIcon size={19} />
        {unread > 0 && <span className="dot">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="popover-head">
            <div>
              <strong>Notifications</strong>
              <span className="popover-sub">
                {unread > 0 ? `${unread} unread` : "You're all caught up"}
              </span>
            </div>
            {unread > 0 && (
              <button type="button" className="btn ghost small" onClick={() => void markRead()} disabled={busy}>
                Mark all read
              </button>
            )}
          </div>
          <div className="popover-list">
            {rows.length === 0 && (
              <div className="popover-empty">
                <BellIcon size={28} />
                <span>Nothing yet. We&apos;ll let you know when something matches.</span>
              </div>
            )}
            {rows.map((row) => (
              <Link
                key={row.id}
                href={row.link ?? "/board"}
                className={`popover-row ${row.read ? "" : "unread"}`}
                onClick={() => setOpen(false)}
              >
                <span className="popover-dot" aria-hidden="true" />
                <span className="popover-copy">
                  <strong>{row.title}</strong>
                  <span>{row.body}</span>
                  <small>{timeAgo(row.at)}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, logout }: { user: Me; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className={`avatar-btn ${open ? "is-open" : ""}`}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="avatar">{initials(user.name)}</span>
        <span className="avatar-name">{user.name.split(" ")[0]}</span>
        <ChevronDownIcon size={15} className="avatar-chevron" />
      </button>
      {open && (
        <div className="user-popover" role="menu">
          <div className="user-card">
            <span className="avatar large">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span className="muted">{user.email}</span>
              <span className="badge role-badge">{ROLE_LABEL[user.role] ?? user.role}</span>
            </div>
          </div>
          <div className="user-links">
            <Link href="/me" role="menuitem" onClick={() => setOpen(false)}>
              <BoxIcon size={17} /> My items
            </Link>
            <Link href="/report" role="menuitem" onClick={() => setOpen(false)}>
              <PlusCircleIcon size={17} /> New report
            </Link>
            {isModeratorRole(user.role) && (
              <Link href="/security" role="menuitem" onClick={() => setOpen(false)}>
                <ShieldCheckIcon size={17} /> Security console
              </Link>
            )}
            {isConfigRole(user.role) && (
              <Link href="/admin" role="menuitem" onClick={() => setOpen(false)}>
                <SlidersIcon size={17} /> Admin settings
              </Link>
            )}
          </div>
          <button
            type="button"
            className="user-signout"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
          >
            <LogOutIcon size={17} /> Sign out
          </button>
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

  if (pathname === "/login" || pathname === "/register") {
    return (
      <MeContext.Provider value={state}>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </MeContext.Provider>
    );
  }

  const isActive = (href: string) =>
    href === "/me" ? pathname === "/me" || pathname.startsWith("/claims") : pathname === href;
  const navClass = (href: string) => (isActive(href) ? "active" : "");
  const mobileItems = [
    { href: "/board", label: "Board", icon: GridIcon },
    { href: "/report", label: "Report", icon: PlusCircleIcon },
    user
      ? { href: "/me", label: "My items", icon: BoxIcon }
      : { href: "/login", label: "Sign in", icon: LogInIcon },
    ...(user && isModeratorRole(user.role)
      ? [{ href: "/security", label: "Security", icon: ShieldCheckIcon }]
      : []),
  ];

  return (
    <MeContext.Provider value={state}>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="logo" aria-label="Campus Lost & Found home">
            <BrandMark size={38} />
            <span className="logo-text">
              <strong>
                Lost <span className="logo-amp">&amp;</span> Found
              </strong>
              <small>Campus</small>
            </span>
          </Link>

          <nav className="nav nav-links" aria-label="Main">
            <Link href="/board" className={navClass("/board")} aria-current={isActive("/board") ? "page" : undefined}>
              Board
            </Link>
            <Link href="/report" className={navClass("/report")} aria-current={isActive("/report") ? "page" : undefined}>
              Report
            </Link>
            {user && (
              <Link href="/me" className={navClass("/me")} aria-current={isActive("/me") ? "page" : undefined}>
                My items
              </Link>
            )}
            {user && isModeratorRole(user.role) && (
              <Link
                href="/security"
                className={navClass("/security")}
                aria-current={isActive("/security") ? "page" : undefined}
              >
                Security
              </Link>
            )}
            {user && isConfigRole(user.role) && (
              <Link href="/admin" className={navClass("/admin")} aria-current={isActive("/admin") ? "page" : undefined}>
                Admin
              </Link>
            )}
          </nav>

          <div className="header-actions">
            {loading && <span className="avatar placeholder" aria-hidden="true" />}
            {user && <Bell />}
            {user && <UserMenu user={user} logout={logout} />}
            {!user && !loading && (
              <>
                <Link href="/login" className="btn ghost small header-signin">
                  Sign in
                </Link>
                <Link href="/register" className="btn small header-register">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {children}
      </main>

      <footer className="footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link href="/" className="logo">
              <BrandMark size={32} />
              <span className="logo-text">
                <strong>
                  Lost <span className="logo-amp">&amp;</span> Found
                </strong>
                <small>Campus</small>
              </span>
            </Link>
            <p>
              A privacy-first way to reunite people with what they lose. Public listings are redacted;
              identifying details stay encrypted until ownership is verified.
            </p>
          </div>
          <nav className="footer-col" aria-label="Explore">
            <strong>Explore</strong>
            <Link href="/board">Public board</Link>
            <Link href="/report?type=lost">Report a lost item</Link>
            <Link href="/report?type=found">Report a found item</Link>
          </nav>
          <nav className="footer-col" aria-label="Account">
            <strong>Account</strong>
            {user ? (
              <>
                <Link href="/me">My items</Link>
                <Link href="/me">My claims</Link>
                {isModeratorRole(user.role) && <Link href="/security">Security console</Link>}
              </>
            ) : (
              <>
                <Link href="/login">Sign in</Link>
                <Link href="/register">Create account</Link>
              </>
            )}
          </nav>
          <div className="footer-col footer-note">
            <strong>Built for trust</strong>
            <span>
              <ShieldCheckIcon size={16} /> Encrypted secret details
            </span>
            <span>
              <UserIcon size={16} /> Supervised handovers
            </span>
            <span>
              <LockIconInline /> Audited custody chain
            </span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Campus Lost &amp; Found</span>
          <span className="footer-privacy">Public board is redacted · No contact details are exposed</span>
        </div>
      </footer>

      <nav className="tabbar" aria-label="Primary">
        {mobileItems.map(({ href, label, icon: MobileIcon }) => (
          <Link
            key={href}
            href={href}
            className={isActive(href) ? "active" : ""}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <MobileIcon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </MeContext.Provider>
  );
}

function LockIconInline() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}
