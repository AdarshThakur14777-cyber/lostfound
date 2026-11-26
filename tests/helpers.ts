import { NextRequest } from "next/server";
import { getDb } from "../src/lib/db";
import { C } from "../src/models/collections";
import { encrypt, hashPassword, randomId } from "../src/lib/crypto";
import { signSession } from "../src/lib/auth";
import * as registerRoute from "../src/app/api/auth/register/route";
import * as loginRoute from "../src/app/api/auth/login/route";
import * as logoutRoute from "../src/app/api/auth/logout/route";
import * as meRoute from "../src/app/api/auth/me/route";
import * as boardRoute from "../src/app/api/board/route";
import * as taxonomyRoute from "../src/app/api/taxonomy/route";
import * as uploadsRoute from "../src/app/api/uploads/route";
import * as itemsRoute from "../src/app/api/items/route";
import * as itemRoute from "../src/app/api/items/[id]/route";
import * as matchesRoute from "../src/app/api/items/[id]/matches/route";
import * as custodyRoute from "../src/app/api/items/[id]/custody/route";
import * as claimsRoute from "../src/app/api/claims/route";
import * as claimRoute from "../src/app/api/claims/[id]/route";
import * as verifyRoute from "../src/app/api/claims/[id]/verify/route";
import * as decisionRoute from "../src/app/api/claims/[id]/decision/route";
import * as handoversRoute from "../src/app/api/handovers/route";
import * as completeRoute from "../src/app/api/handovers/[id]/complete/route";
import * as notificationsRoute from "../src/app/api/notifications/route";
import * as matchRoute from "../src/app/api/matches/[id]/route";
import * as settingsRoute from "../src/app/api/admin/settings/route";
import * as categoriesRoute from "../src/app/api/admin/categories/route";
import * as categoryRoute from "../src/app/api/admin/categories/[id]/route";
import * as locationsRoute from "../src/app/api/admin/locations/route";
import * as locationRoute from "../src/app/api/admin/locations/[id]/route";
import * as reportsRoute from "../src/app/api/admin/reports/route";
import * as queueRoute from "../src/app/api/admin/queue/route";
import * as ageingRoute from "../src/app/api/admin/ageing/route";
import * as disposeRoute from "../src/app/api/admin/items/[id]/dispose/route";
import * as refreshRoute from "../src/app/api/admin/matches/refresh/route";
import * as adminUsersRoute from "../src/app/api/admin/users/route";
import * as adminUserRoute from "../src/app/api/admin/users/[id]/route";
import * as filesRoute from "../src/app/api/files/[name]/route";
import type {
  ItemCategoryDoc,
  ItemDoc,
  LocationDoc,
  PrivateDetailDoc,
  Role,
  UserDoc,
} from "../src/models/types";

export async function resetDb(): Promise<void> {
  const db = await getDb();
  await Promise.all(Object.values(C).map((name) => db.collection(name).deleteMany({})));
}

export async function makeUser(
  overrides: Partial<UserDoc> = {},
): Promise<UserDoc> {
  const db = await getDb();
  const doc: UserDoc = {
    _id: randomId(9),
    name: "Test User",
    email: `user-${randomId(4)}@test.local`,
    passwordHash: await hashPassword("Password123!"),
    role: "student",
    active: true,
    createdAt: new Date(),
    phone: "+91 90000 00000",
    ...overrides,
  };
  await db.collection<UserDoc>(C.users).insertOne(doc);
  return doc;
}

export async function seedTaxonomy(): Promise<{
  category: ItemCategoryDoc;
  leafCategory: ItemCategoryDoc;
  location: LocationDoc;
  otherLocation: LocationDoc;
}> {
  const db = await getDb();
  const parent: ItemCategoryDoc = {
    _id: "cat-parent",
    name: "Electronics",
    parentId: null,
    attributes: ["brand", "colour"],
    createdAt: new Date(),
  };
  const leaf: ItemCategoryDoc = {
    _id: "cat-leaf",
    name: "Phones",
    parentId: parent._id,
    attributes: ["brand", "colour"],
    createdAt: new Date(),
  };
  const root: LocationDoc = {
    _id: "loc-root",
    name: "Campus",
    parentId: null,
    path: [],
    createdAt: new Date(),
  };
  const lib: LocationDoc = {
    _id: "loc-lib",
    name: "Library",
    parentId: root._id,
    path: [root._id],
    createdAt: new Date(),
  };
  const hall: LocationDoc = {
    _id: "loc-hall",
    name: "Lecture Hall",
    parentId: root._id,
    path: [root._id],
    createdAt: new Date(),
  };
  await db.collection<ItemCategoryDoc>(C.categories).insertMany([parent, leaf]);
  await db.collection<LocationDoc>(C.locations).insertMany([root, lib, hall]);
  return { category: parent, leafCategory: leaf, location: lib, otherLocation: hall };
}

export interface SeedItemInput {
  type?: "lost" | "found";
  title?: string;
  description?: string;
  categoryId?: string;
  locationId?: string;
  reporterId: string;
  status?: ItemDoc["status"];
  createdAt?: Date;
  occurredAt?: Date;
  privateDetails?: [string, string][];
}

export async function seedItem(input: SeedItemInput): Promise<ItemDoc> {
  const db = await getDb();
  const now = new Date();
  const item: ItemDoc = {
    _id: randomId(9),
    type: input.type ?? "found",
    title: input.title ?? "Found black smartphone in blue case",
    description: input.description ?? "A black smartphone with a navy blue case, found on a desk.",
    categoryId: input.categoryId ?? "cat-leaf",
    locationId: input.locationId ?? "loc-lib",
    occurredAt: input.occurredAt ?? now,
    attributes: { colour: "black" },
    images: [],
    status: input.status ?? "open",
    reporterId: input.reporterId,
    hasPrivateDetails: Boolean(input.privateDetails?.length),
    createdAt: input.createdAt ?? now,
    updatedAt: input.createdAt ?? now,
  };
  if (item.type === "found") {
    item.custody = { locationId: item.locationId, holderId: item.reporterId, since: now };
  }
  await db.collection<ItemDoc>(C.items).insertOne(item);

  if (input.privateDetails?.length) {
    const doc: PrivateDetailDoc = {
      _id: item._id,
      itemId: item._id,
      ownerUserId: item.reporterId,
      entries: input.privateDetails.map(([question, answer]) => ({
        id: randomId(6),
        questionEnc: encrypt(question),
        answerEnc: encrypt(answer),
      })),
      updatedAt: new Date(),
    };
    await db.collection<PrivateDetailDoc>(C.privateDetails).insertOne(doc);
  }
  return item;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  user?: { sub: string; role: Role; name?: string; email?: string };
  headers?: Record<string, string>;
}

type RouteHandler = (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => Promise<Response>;

interface RouteEntry {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
}

/**
 * Minimal in-process router: maps a path+method onto the exported Next.js route
 * handler so tests exercise the real endpoints (auth, validation, serialization)
 * without booting a server.
 */
const routes: RouteEntry[] = [
  { method: "POST", pattern: /^\/api\/auth\/register$/, keys: [], handler: registerRoute.POST as RouteHandler },
  { method: "POST", pattern: /^\/api\/auth\/login$/, keys: [], handler: loginRoute.POST as RouteHandler },
  { method: "POST", pattern: /^\/api\/auth\/logout$/, keys: [], handler: logoutRoute.POST as RouteHandler },
  { method: "GET", pattern: /^\/api\/auth\/me$/, keys: [], handler: meRoute.GET as RouteHandler },
  { method: "GET", pattern: /^\/api\/board$/, keys: [], handler: boardRoute.GET as RouteHandler },
  { method: "GET", pattern: /^\/api\/taxonomy$/, keys: [], handler: taxonomyRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/uploads$/, keys: [], handler: uploadsRoute.POST as RouteHandler },
  { method: "GET", pattern: /^\/api\/items$/, keys: [], handler: itemsRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/items$/, keys: [], handler: itemsRoute.POST as RouteHandler },
  { method: "GET", pattern: /^\/api\/items\/([^/]+)$/, keys: ["id"], handler: itemRoute.GET as RouteHandler },
  {
    method: "GET",
    pattern: /^\/api\/items\/([^/]+)\/matches$/,
    keys: ["id"],
    handler: matchesRoute.GET as RouteHandler,
  },
  {
    method: "GET",
    pattern: /^\/api\/items\/([^/]+)\/custody$/,
    keys: ["id"],
    handler: custodyRoute.GET as RouteHandler,
  },
  {
    method: "POST",
    pattern: /^\/api\/items\/([^/]+)\/custody$/,
    keys: ["id"],
    handler: custodyRoute.POST as RouteHandler,
  },
  { method: "GET", pattern: /^\/api\/claims$/, keys: [], handler: claimsRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/claims$/, keys: [], handler: claimsRoute.POST as RouteHandler },
  { method: "GET", pattern: /^\/api\/claims\/([^/]+)$/, keys: ["id"], handler: claimRoute.GET as RouteHandler },
  {
    method: "POST",
    pattern: /^\/api\/claims\/([^/]+)\/verify$/,
    keys: ["id"],
    handler: verifyRoute.POST as RouteHandler,
  },
  {
    method: "POST",
    pattern: /^\/api\/claims\/([^/]+)\/decision$/,
    keys: ["id"],
    handler: decisionRoute.POST as RouteHandler,
  },
  { method: "GET", pattern: /^\/api\/handovers$/, keys: [], handler: handoversRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/handovers$/, keys: [], handler: handoversRoute.POST as RouteHandler },
  {
    method: "POST",
    pattern: /^\/api\/handovers\/([^/]+)\/complete$/,
    keys: ["id"],
    handler: completeRoute.POST as RouteHandler,
  },
  { method: "GET", pattern: /^\/api\/notifications$/, keys: [], handler: notificationsRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/notifications$/, keys: [], handler: notificationsRoute.POST as RouteHandler },
  { method: "PATCH", pattern: /^\/api\/matches\/([^/]+)$/, keys: ["id"], handler: matchRoute.PATCH as RouteHandler },
  { method: "GET", pattern: /^\/api\/admin\/settings$/, keys: [], handler: settingsRoute.GET as RouteHandler },
  { method: "PATCH", pattern: /^\/api\/admin\/settings$/, keys: [], handler: settingsRoute.PATCH as RouteHandler },
  { method: "GET", pattern: /^\/api\/admin\/categories$/, keys: [], handler: categoriesRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/admin\/categories$/, keys: [], handler: categoriesRoute.POST as RouteHandler },
  {
    method: "PATCH",
    pattern: /^\/api\/admin\/categories\/([^/]+)$/,
    keys: ["id"],
    handler: categoryRoute.PATCH as RouteHandler,
  },
  {
    method: "DELETE",
    pattern: /^\/api\/admin\/categories\/([^/]+)$/,
    keys: ["id"],
    handler: categoryRoute.DELETE as RouteHandler,
  },
  { method: "GET", pattern: /^\/api\/admin\/locations$/, keys: [], handler: locationsRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/admin\/locations$/, keys: [], handler: locationsRoute.POST as RouteHandler },
  {
    method: "PATCH",
    pattern: /^\/api\/admin\/locations\/([^/]+)$/,
    keys: ["id"],
    handler: locationRoute.PATCH as RouteHandler,
  },
  {
    method: "DELETE",
    pattern: /^\/api\/admin\/locations\/([^/]+)$/,
    keys: ["id"],
    handler: locationRoute.DELETE as RouteHandler,
  },
  { method: "GET", pattern: /^\/api\/admin\/reports$/, keys: [], handler: reportsRoute.GET as RouteHandler },
  { method: "GET", pattern: /^\/api\/admin\/queue$/, keys: [], handler: queueRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/admin\/ageing$/, keys: [], handler: ageingRoute.POST as RouteHandler },
  {
    method: "POST",
    pattern: /^\/api\/admin\/items\/([^/]+)\/dispose$/,
    keys: ["id"],
    handler: disposeRoute.POST as RouteHandler,
  },
  {
    method: "POST",
    pattern: /^\/api\/admin\/matches\/refresh$/,
    keys: [],
    handler: refreshRoute.POST as RouteHandler,
  },
  { method: "GET", pattern: /^\/api\/admin\/users$/, keys: [], handler: adminUsersRoute.GET as RouteHandler },
  { method: "POST", pattern: /^\/api\/admin\/users$/, keys: [], handler: adminUsersRoute.POST as RouteHandler },
  {
    method: "PATCH",
    pattern: /^\/api\/admin\/users\/([^/]+)$/,
    keys: ["id"],
    handler: adminUserRoute.PATCH as RouteHandler,
  },
  { method: "GET", pattern: /^\/api\/files\/([^/]+)$/, keys: ["name"], handler: filesRoute.GET as RouteHandler },
];

/** Dispatches a request to the matching route handler. */
export async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const [pathname] = path.split("?");
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.user) {
    const token = await signSession({
      sub: options.user.sub,
      role: options.user.role,
      name: options.user.name ?? "Tester",
      email: options.user.email ?? "tester@test.local",
    });
    headers.cookie = `session=${token}`;
  }

  const req = new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(pathname);
    if (!match) continue;
    const params: Record<string, string> = {};
    route.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(match[index + 1]);
    });
    return route.handler(req, { params: Promise.resolve(params) });
  }

  return new Response(JSON.stringify({ error: `No test route for ${method} ${pathname}` }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Maps challenge entry ids to the plaintext answers, in the order the private
 * details were seeded. (Challenge questions are deliberately shuffled.)
 */
export async function answerKeyFor(
  itemId: string,
  secrets: [string, string][],
): Promise<Map<string, string>> {
  const db = await getDb();
  const doc = await db
    .collection<PrivateDetailDoc>(C.privateDetails)
    .findOne({ itemId });
  const map = new Map<string, string>();
  doc?.entries.forEach((entry, index) => map.set(entry.id, secrets[index]?.[1] ?? ""));
  return map;
}

/** Walks a parsed response and returns every key path that looks private. */
export function findForbidden(
  value: unknown,
  forbidden: RegExp,
  path = "",
): string[] {
  const hits: string[] = [];
  if (value && typeof value === "object") {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => hits.push(...findForbidden(entry, forbidden, `${path}[${index}]`)));
      return hits;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${key}` : key;
      if (forbidden.test(key)) hits.push(next);
      hits.push(...findForbidden(child, forbidden, next));
    }
  }
  return hits;
}

/** Returns every string in the payload that contains one of the secrets. */
export function findSecretValues(value: unknown, secrets: string[], path = ""): string[] {
  const hits: string[] = [];
  if (typeof value === "string") {
    for (const secret of secrets) {
      if (secret && value.includes(secret)) hits.push(`${path} contains "${secret.slice(0, 24)}"`);
    }
    return hits;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      hits.push(...findSecretValues(child, secrets, path ? `${path}.${key}` : key));
    }
  }
  return hits;
}

/**
 * Keys that must never appear on any public endpoint. Matched case-insensitively
 * against every key name in the response.
 */
export const FORBIDDEN_PUBLIC_KEYS =
  /private|answer|secret|question|otp|password|hash|email|phone|contact|encrypt|challenge|entryid|claimantid|reporterid|holderid|note/i;
