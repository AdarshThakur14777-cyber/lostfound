"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";

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
      router.push(params.get("next") ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setBusy(false);
    }
  }

  return (
    <div className="container page" style={{ maxWidth: 440 }}>
      <div className="page-head">
        <div>
          <h1>Sign in</h1>
          <p>Track reports, submit claims, review handovers.</p>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      <form className="card plain" onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={busy} style={{ width: "100%" }}>
          {busy ? <span className="spinner" /> : "Sign in"}
        </button>
        <p className="center muted mt" style={{ marginBottom: 0 }}>
          No account? <Link href="/register">Register</Link>
        </p>
      </form>

      <div className="notice mt">
        Demo accounts (password <code>Demo1234!</code>): student@demo.local · security@demo.local ·
        admin@demo.local
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container page"><div className="skeleton" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
