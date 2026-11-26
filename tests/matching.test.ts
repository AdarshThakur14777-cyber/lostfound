import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "../src/lib/db";
import { refreshAllMatches } from "../src/lib/matching/suggest";
import { scorePair, textSimilarity, locationSimilarity } from "../src/lib/matching/score";
import { request } from "./helpers";
import { makeUser, resetDb, seedItem, seedTaxonomy, type SeedItemInput } from "./helpers";
import type { UserDoc } from "../src/models/types";

/**
 * Spec section 15: "Match suggestions returned for at least 70% of seeded
 * matching pairs in the test fixture."
 */

interface Pair {
  lost: string;
  found: string;
}

describe("matching engine", () => {
  let reporter: UserDoc;
  const pairs: Pair[] = [];

  beforeAll(async () => {
    await resetDb();
    await seedTaxonomy();
    reporter = await makeUser({ name: "Matcher" });

    const seeds: {
      lost: Omit<SeedItemInput, "reporterId">;
      found: Omit<SeedItemInput, "reporterId">;
    }[] = [
      {
        lost: {
          title: "Black smartphone in a navy blue case",
          description: "Lost a black phone in a navy blue protective case near the library.",
          locationId: "loc-lib",
          occurredAt: new Date(Date.now() - 2 * 86_400_000),
        },
        found: {
          title: "Found a black smartphone with a blue case",
          description: "Picked up a black smartphone in a blue protective case at the library.",
          locationId: "loc-lib",
          occurredAt: new Date(Date.now() - 86_400_000),
        },
      },
      {
        lost: {
          title: "Keys with a red keyring and tag",
          description: "Lost my keys with a red plastic tag and a steel ring.",
          locationId: "loc-hall",
          occurredAt: new Date(Date.now() - 3 * 86_400_000),
        },
        found: {
          title: "Bunch of keys with a red tag",
          description: "Found a bunch of keys on a steel ring with a red plastic tag.",
          locationId: "loc-hall",
          occurredAt: new Date(Date.now() - 86_400_000),
        },
      },
      {
        lost: {
          title: "Blue backpack with white drawstrings",
          description: "Left my blue backpack with white drawstrings in the lecture hall.",
          locationId: "loc-hall",
          occurredAt: new Date(Date.now() - 2 * 86_400_000),
        },
        found: {
          title: "Blue backpack left behind",
          description: "A blue backpack with white drawstrings was left in the lecture hall.",
          locationId: "loc-hall",
          occurredAt: new Date(Date.now() - 86_400_000),
        },
      },
      {
        lost: {
          title: "Silver laptop charger with velcro strap",
          description: "Lost a silver laptop charger wrapped in a black velcro strap.",
          locationId: "loc-lib",
          occurredAt: new Date(Date.now() - 4 * 86_400_000),
        },
        found: {
          title: "Laptop charger wrapped with velcro strap",
          description: "Found a silver laptop charger with a black velcro strap in the library.",
          locationId: "loc-lib",
          occurredAt: new Date(Date.now() - 86_400_000),
        },
      },
      {
        lost: {
          title: "Grey metal water bottle with stickers",
          description: "Grey stainless steel bottle covered in travel stickers, lost at the hall.",
          locationId: "loc-hall",
          occurredAt: new Date(Date.now() - 5 * 86_400_000),
        },
        found: {
          title: "Grey steel bottle covered in stickers",
          description: "A grey stainless steel water bottle with travel stickers was found here.",
          locationId: "loc-hall",
          occurredAt: new Date(Date.now() - 86_400_000),
        },
      },
    ];

    for (const seed of seeds) {
      const lost = await seedItem({ ...seed.lost, type: "lost", reporterId: reporter._id });
      const found = await seedItem({
        ...seed.found,
        type: "found",
        reporterId: reporter._id,
        privateDetails: [["What is on the base?", "marker-xyz"]],
      });
      pairs.push({ lost: lost._id, found: found._id });
    }

    // Noise: unrelated reports that must not crowd out the real matches.
    await seedItem({
      type: "lost",
      title: "Grey umbrella with wooden handle",
      description: "A grey folding umbrella with a wooden handle left in the hall.",
      locationId: "loc-hall",
      reporterId: reporter._id,
    });
    await seedItem({
      type: "found",
      title: "Stainless steel water flask",
      description: "A plain steel flask without any stickers was found at the library entrance.",
      locationId: "loc-lib",
      reporterId: reporter._id,
      privateDetails: [["Any engraving?", "none"]],
    });
    await seedItem({
      type: "found",
      title: "Red notebook with spiral binding",
      description: "A red spiral notebook found on a bench, no writing inside.",
      locationId: "loc-lib",
      reporterId: reporter._id,
      privateDetails: [["Page count?", "96"]],
    });
  });

  it("returns at least 70% of seeded matching pairs in the top 5 suggestions", async () => {
    const db = await getDb();
    await refreshAllMatches(db);

    let matched = 0;
    for (const pair of pairs) {
      const res = await request(`/api/items/${pair.lost}/matches`, {
        user: { sub: reporter._id, role: "student" },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { matches: { item: { id: string } | null }[] };
      const topFive = body.matches.slice(0, 5).map((entry) => entry.item?.id);
      if (topFive.includes(pair.found)) matched += 1;
    }

    expect(matched / pairs.length).toBeGreaterThanOrEqual(0.7);
  });

  it("attaches human-readable reasons to every suggestion", async () => {
    const db = await getDb();
    await refreshAllMatches(db);
    const res = await request(`/api/items/${pairs[0].lost}/matches`, {
      user: { sub: reporter._id, role: "student" },
    });
    const body = (await res.json()) as { matches: { reasons: string[]; score: number }[] };
    expect(body.matches.length).toBeGreaterThan(0);
    for (const entry of body.matches) {
      expect(entry.reasons.length).toBeGreaterThan(0);
      expect(entry.score).toBeGreaterThan(0);
    }
  });

  it("is only visible to the reporter and staff", async () => {
    const other = await makeUser();
    const res = await request(`/api/items/${pairs[0].lost}/matches`, {
      user: { sub: other._id, role: "student" },
    });
    expect(res.status).toBe(403);
  });

  it("scores similar reports above unrelated ones", () => {
    const ctx = {
      locationPaths: new Map([
        ["loc-root", [] as string[]],
        ["loc-lib", ["loc-root"]],
        ["loc-hall", ["loc-root"]],
      ]),
      categoryParents: new Map([["cat-leaf", "cat-parent"]]),
      timeHalfLifeDays: 3,
    };
    const similar = scorePair(
      {
        title: "Black smartphone in a navy blue case",
        description: "black phone navy blue protective case library",
        categoryId: "cat-leaf",
        locationId: "loc-lib",
        occurredAt: new Date(),
        attributes: {},
      },
      {
        title: "Found a black smartphone with a blue case",
        description: "black smartphone blue protective case library",
        categoryId: "cat-leaf",
        locationId: "loc-lib",
        occurredAt: new Date(Date.now() - 86_400_000),
        attributes: {},
      },
      ctx,
    );
    const unrelated = scorePair(
      {
        title: "Black smartphone in a navy blue case",
        description: "black phone navy blue protective case library",
        categoryId: "cat-leaf",
        locationId: "loc-lib",
        occurredAt: new Date(),
        attributes: {},
      },
      {
        title: "Grey umbrella with wooden handle",
        description: "grey folding umbrella wooden handle hall",
        categoryId: "cat-parent",
        locationId: "loc-hall",
        occurredAt: new Date(Date.now() - 20 * 86_400_000),
        attributes: {},
      },
      ctx,
    );
    expect(similar.score).toBeGreaterThan(unrelated.score);
    expect(similar.score).toBeGreaterThan(0.6);
    expect(unrelated.score).toBeLessThan(0.45);
  });

  it("handles text and location primitives", () => {
    const a = {
      title: "blue backpack",
      description: "blue backpack with white strings",
      categoryId: "cat-leaf",
      locationId: "loc-lib",
      occurredAt: new Date(),
      attributes: {},
    };
    const b = {
      title: "blue backpack",
      description: "blue backpack white strings",
      categoryId: "cat-leaf",
      locationId: "loc-lib",
      occurredAt: new Date(),
      attributes: {},
    };
    expect(textSimilarity(a, b)).toBeGreaterThan(0.8);
    expect(textSimilarity(a, { ...b, title: "umbrella", description: "wooden handle" })).toBeLessThan(0.3);
    expect(
      locationSimilarity("loc-lib", "loc-hall", new Map([
        ["loc-root", [] as string[]],
        ["loc-lib", ["loc-root"]],
        ["loc-hall", ["loc-root"]],
      ])),
    ).toBeCloseTo(0.5);
  });
});
