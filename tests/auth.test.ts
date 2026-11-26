import { beforeAll, describe, expect, it } from "vitest";
import { request } from "./helpers";
import { makeUser, resetDb, seedTaxonomy } from "./helpers";

describe("authentication and roles", () => {
  beforeAll(async () => {
    await resetDb();
    await seedTaxonomy();
  });

  it("registers, reads the session and logs out", async () => {
    const register = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "New Student",
        email: "new.student@test.local",
        password: "Password123!",
        role: "student",
      },
    });
    expect(register.status).toBe(201);
    const setCookie = register.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("HttpOnly");

    const token = setCookie.split("session=")[1]?.split(";")[0] ?? "";
    const me = await request("/api/auth/me", { headers: { cookie: `session=${token}` } });
    const meBody = (await me.json()) as { user: { email: string; role: string } | null };
    expect(meBody.user?.email).toBe("new.student@test.local");
    expect(meBody.user?.role).toBe("student");

    const duplicate = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Copycat", email: "new.student@test.local", password: "Password123!" },
    });
    expect(duplicate.status).toBe(409);

    const logout = await request("/api/auth/logout", {
      method: "POST",
      headers: { cookie: `session=${token}` },
    });
    expect(logout.status).toBe(200);
  });

  it("does not allow public staff registration", async () => {
    const res = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Self Made Staff",
        email: "not.staff@test.local",
        password: "Password123!",
        role: "staff",
      },
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe(
      "Staff accounts are created by campus administration",
    );

    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "not.staff@test.local", password: "Password123!" },
    });
    expect(login.status).toBe(400);
  });

  it("returns a bearer token for the mobile app and accepts it on requests", async () => {
    const user = await makeUser({ email: "mobile@test.local" });
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "mobile@test.local", password: "Password123!" },
    });
    expect(login.status).toBe(200);
    const body = (await login.json()) as { user: { id: string }; token?: string };
    expect(body.token).toBeTruthy();
    expect(body.user.id).toBe(user._id);

    // The mobile app has no cookie jar - it sends Authorization: Bearer.
    const me = await request("/api/auth/me", {
      headers: { authorization: `Bearer ${body.token}` },
    });
    const meBody = (await me.json()) as { user: { email: string } | null };
    expect(meBody.user?.email).toBe("mobile@test.local");

    const bad = await request("/api/auth/me", {
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(((await bad.json()) as { user: unknown }).user).toBeNull();
  });

  it("rejects bad credentials without leaking which field was wrong", async () => {
    const user = await makeUser({ email: "known@test.local" });
    void user;
    const res = await request("/api/auth/login", {
      method: "POST",
      body: { email: "known@test.local", password: "wrong-password" },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("Invalid email or password");
  });

  it("requires a session for reporting and claiming", async () => {
    const report = await request("/api/items", {
      method: "POST",
      body: {
        type: "lost",
        title: "Something",
        description: "A description long enough",
        categoryId: "cat-leaf",
        locationId: "loc-lib",
        occurredAt: new Date().toISOString(),
      },
    });
    expect(report.status).toBe(401);
  });

  it("honours active/disabled accounts", async () => {
    const user = await makeUser({ email: "disabled@test.local" });
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "disabled@test.local", password: "Password123!" },
    });
    expect(login.status).toBe(200);
    const token = login.headers.get("set-cookie")?.split("session=")[1]?.split(";")[0] ?? "";

    const { getDb } = await import("../src/lib/db");
    const { users } = await import("../src/models/collections");
    const db = await getDb();
    await users(db).updateOne({ _id: user._id }, { $set: { active: false } });

    const me = await request("/api/auth/me", { headers: { cookie: `session=${token}` } });
    expect(((await me.json()) as { user: unknown }).user).toBeNull();
  });
});
