"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { PasswordField } from "@/components/PasswordField";
import { AlertIcon, ArrowRightIcon, ShieldCheckIcon } from "@/components/icons";
import { api } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useMe();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, department: department || undefined }),
      });
      refresh();
      router.push("/report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your student account"
      subtitle="Open registration is for students only. Staff, security and admin accounts are created by campus administration."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="auth-link">
            Sign in
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

      <div className="auth-info">
        <ShieldCheckIcon size={18} />
        <span>
          <strong>Staff or security?</strong> Ask your campus administrator for an account — those roles cannot be
          self-registered.
        </span>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            placeholder="Your full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

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
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters. Use something unique to this account."
          placeholder="Create a password"
        />

        <div className="field">
          <label htmlFor="department">
            Department / course <span className="label-optional">optional</span>
          </label>
          <input
            id="department"
            name="department"
            type="text"
            autoComplete="organization"
            maxLength={120}
            placeholder="e.g. Computer Science"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-lg btn-block" disabled={busy}>
          {busy ? (
            <span className="spinner" />
          ) : (
            <>
              Create account <ArrowRightIcon size={17} />
            </>
          )}
        </button>
        <p className="form-legal">
          Your details are used only for ownership verification and handover coordination.
        </p>
      </form>
    </AuthLayout>
  );
}
