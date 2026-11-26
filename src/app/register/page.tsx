"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { useMe } from "@/lib/client/me";

export default function RegisterPage() {
  const router = useRouter();
  const { refresh } = useMe();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "staff">("student");
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
        body: JSON.stringify({ name, email, password, role, department: department || undefined }),
      });
      refresh();
      router.push("/report");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  return (
    <div className="container page" style={{ maxWidth: 440 }}>
      <div className="page-head">
        <div>
          <h1>Create your account</h1>
          <p>Students and staff register here. Security and admin accounts are created by staff.</p>
        </div>
      </div>

      {error && <div className="notice error">{error}</div>}

      <form className="card plain" onSubmit={submit}>
        <div className="field">
          <label>Full name</label>
          <input type="text" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="hint">At least 8 characters.</div>
        </div>
        <div className="row-inline">
          <div className="field">
            <label>I am a</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "student" | "staff")}>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="field">
            <label>Department (optional)</label>
            <input
              type="text"
              value={department}
              maxLength={120}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="btn" disabled={busy} style={{ width: "100%" }}>
          {busy ? <span className="spinner" /> : "Create account"}
        </button>
        <p className="center muted mt" style={{ marginBottom: 0 }}>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
