import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon, BrandMark, CheckIcon, LockIcon, ShieldCheckIcon } from "./icons";

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="auth-page">
      <aside className="auth-panel" aria-hidden="true">
        <div className="auth-panel-glow auth-panel-glow-one" />
        <div className="auth-panel-glow auth-panel-glow-two" />
        <Link href="/" className="logo logo-light">
          <BrandMark size={40} />
          <span className="logo-text">
            <strong>
              Lost <span className="logo-amp">&amp;</span> Found
            </strong>
            <small>Campus</small>
          </span>
        </Link>
        <div className="auth-panel-copy">
          <span className="eyebrow light">Privacy-first returns</span>
          <h2>
            Lost something?
            <br />
            We&apos;ll help it find its way back.
          </h2>
          <p>
            A campus-wide lost &amp; found built around private verification, supervised handovers, and a clear
            custody trail.
          </p>
          <ul className="auth-points">
            <li>
              <span className="auth-check">
                <CheckIcon size={13} />
              </span>
              Report an item in under a minute
            </li>
            <li>
              <span className="auth-check">
                <CheckIcon size={13} />
              </span>
              Get matched automatically
            </li>
            <li>
              <span className="auth-check">
                <CheckIcon size={13} />
              </span>
              Prove ownership without exposing details
            </li>
          </ul>
        </div>
        <div className="auth-panel-foot">
          <ShieldCheckIcon size={17} />
          Secret details are encrypted and never shown publicly.
        </div>
      </aside>

      <div className="auth-main">
        <div className="auth-mobile-brand">
          <BrandMark size={34} />
          <span>
            <strong>
              Lost <span className="logo-amp">&amp;</span> Found
            </strong>
            <small>Campus</small>
          </span>
        </div>
        <div className="auth-topbar">
          <Link href="/board" className="auth-back">
            <ArrowLeftIcon size={16} /> Back to the board
          </Link>
          <span className="auth-secure">
            <LockIcon size={14} /> Secure session
          </span>
        </div>
        <div className="auth-card">
          <div className="auth-heading">
            <span className="eyebrow muted">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
        <p className="auth-legal">
          Campus Lost &amp; Found · Public listings are redacted · Handovers are supervised and recorded
        </p>
      </div>
    </div>
  );
}
