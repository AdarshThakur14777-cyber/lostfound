import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/db";
import { disposals, items, notifications } from "../src/models/collections";
import { request } from "./helpers";
import { makeUser, resetDb, seedItem, seedTaxonomy } from "./helpers";
import type { ItemDoc, UserDoc } from "../src/models/types";

const DAY = 86_400_000;

describe("unclaimed ageing and disposal", () => {
  let reporter: UserDoc;
  let security: UserDoc;
  let admin: UserDoc;
  let overdue: ItemDoc;
  let nearlyDue: ItemDoc;
  let fresh: ItemDoc;

  beforeAll(async () => {
    await resetDb();
    await seedTaxonomy();
    reporter = await makeUser({ name: "Reporter" });
    security = await makeUser({ name: "Officer", role: "security" });
    admin = await makeUser({ name: "Admin", role: "admin" });

    overdue = await seedItem({
      reporterId: reporter._id,
      type: "found",
      title: "Found an old umbrella",
      createdAt: new Date(Date.now() - 40 * DAY),
      privateDetails: [["Any monogram?", "letters-jm"]],
    });
    nearlyDue = await seedItem({
      reporterId: reporter._id,
      type: "lost",
      title: "Lost calculator",
      createdAt: new Date(Date.now() - 29 * DAY),
    });
    fresh = await seedItem({
      reporterId: reporter._id,
      type: "found",
      title: "Found headphones",
      createdAt: new Date(Date.now() - 2 * DAY),
      privateDetails: [["Any sticker?", "star"]],
    });
  });

  it("moves overdue items into the disposal queue and warns the rest", async () => {
    const res = await request("/api/admin/ageing", {
      method: "POST",
      user: { sub: admin._id, role: "admin" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { warned: string[]; queued: string[] };
    expect(body.queued).toContain(overdue._id);
    expect(body.warned).toContain(nearlyDue._id);

    const db = await getDb();
    expect((await items(db).findOne({ _id: overdue._id }))?.status).toBe("disposal_pending");
    expect((await items(db).findOne({ _id: nearlyDue._id }))?.status).toBe("open");
    expect((await items(db).findOne({ _id: fresh._id }))?.status).toBe("open");

    const notes = await notifications(db).find({ userId: reporter._id }).toArray();
    expect(notes.some((note) => note.type === "ageing_warning")).toBe(true);
    expect(notes.some((note) => note.type === "disposal")).toBe(true);
  });

  it("lists the queue for staff", async () => {
    const res = await request("/api/admin/queue", { user: { sub: security._id, role: "security" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      disposalQueue: { id: string }[];
      ageing: { id: string }[];
      custodyInventory: { count: number }[];
    };
    expect(body.disposalQueue.map((row) => row.id)).toContain(overdue._id);
    expect(body.ageing.map((row) => row.id)).toContain(nearlyDue._id);
    expect(body.custodyInventory.length).toBeGreaterThan(0);
  });

  it("refuses to dispose items that are not queued", async () => {
    const res = await request(`/api/admin/items/${fresh._id}/dispose`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { method: "discarded" },
    });
    expect(res.status).toBe(409);
  });

  it("records disposal for queued items only", async () => {
    const denied = await request(`/api/admin/items/${overdue._id}/dispose`, {
      method: "POST",
      user: { sub: reporter._id, role: "student" },
      body: { method: "discarded" },
    });
    expect(denied.status).toBe(403);

    const ok = await request(`/api/admin/items/${overdue._id}/dispose`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { method: "donated", notes: "Donated to the student shop." },
    });
    expect(ok.status).toBe(200);

    const db = await getDb();
    expect((await items(db).findOne({ _id: overdue._id }))?.status).toBe("disposed");
    const record = await disposals(db).findOne({ itemId: overdue._id });
    expect(record?.method).toBe("donated");
    expect(record?.disposedById).toBe(security._id);

    const again = await request(`/api/admin/items/${overdue._id}/dispose`, {
      method: "POST",
      user: { sub: security._id, role: "security" },
      body: { method: "discarded" },
    });
    expect(again.status).toBe(409);
  });

  it("produces return-rate and verification analytics for the dashboard", async () => {
    const res = await request("/api/admin/reports", { user: { sub: admin._id, role: "admin" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      totals: { reported: number; disposalPending: number };
      returnRate: number;
      verification: { attempted: number; failureRate: number };
      hotspots: unknown[];
      categories: unknown[];
      ageing: { retentionDays: number };
    };
    expect(body.totals.reported).toBeGreaterThanOrEqual(3);
    expect(body.returnRate).toBeGreaterThanOrEqual(0);
    expect(body.returnRate).toBeLessThanOrEqual(1);
    expect(body.verification.attempted).toBeGreaterThanOrEqual(0);
    expect(body.ageing.retentionDays).toBeGreaterThan(0);
    expect(Array.isArray(body.hotspots)).toBe(true);
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it("keeps admin endpoints away from students", async () => {
    for (const [path, method] of [
      ["/api/admin/reports", "GET"],
      ["/api/admin/settings", "GET"],
      ["/api/admin/users", "GET"],
      ["/api/admin/queue", "GET"],
    ] as const) {
      const res = await request(path, {
        method,
        user: { sub: reporter._id, role: "student" },
      });
      expect(res.status, path).toBe(403);
    }
  });
});
