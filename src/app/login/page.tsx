"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { PasswordField } from "@/components/PasswordField";
import { AlertIcon, ArrowRightIcon, ShieldCheckIcon, SlidersIcon, UserIcon } from "@/components/icons";
import { api } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";

const DEMO_ACCOUNTS = [
  { label: "Student", email: "student@demo.local", icon: UserIcon },
  { label: "Security", email: "security@demo.local", icon: ShieldCheckIcon },
  { label: "Admin", email: "admin@demo.local", icon: SlidersIcon },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      refresh();
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Track reports, submit claims, and review handovers."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="auth-link">
            Create an account
          </Link>
        </>
      }
    >
      {error && (
        <div className="notice error" role="alert">
          <AlertIcon size={17} />
          <span>{error}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Campus email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@campus.edu"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Your password"
        />
        <button type="submit" className="btn btn-lg btn-block" disabled={busy}>
          {busy ? (
            <span className="spinner" />
          ) : (
            <>
              Sign in <ArrowRightIcon size={17} />
            </>
          )}
        </button>
      </form>

      <div className="auth-divider">
        <span>Demo access</span>
      </div>
      <div className="demo-grid">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            className="demo-chip"
            onClick={() => {
              setEmail(account.email);
              setPassword("Demo1234!");
              setError(null);
            }}
          >
            <span className="demo-icon">
              <account.icon size={16} />
            </span>
            <span>
              <strong>{account.label}</strong>
              <small>{account.email}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="demo-note">
        Demo password <code>Demo1234!</code> — click a role to fill the form.
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container page">
          <div className="skeleton" style={{ height: 420 }} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
