import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { sessionSecret } from "./env";
import { forbidden, unauthorized } from "./http";
import { users } from "@/models/collections";
import { getDb } from "./db";
import type { Role, UserDoc } from "@/models/types";

export const SESSION_COOKIE = "session";
const SESSION_DAYS = 7;

export interface SessionUser {
  sub: string;
  role: Role;
  name: string;
  email: string;
}

const MODERATOR_ROLES: Role[] = ["security", "admin", "sysadmin"];
const CONFIG_ROLES: Role[] = ["admin", "sysadmin"];

export function isModerator(role: Role): boolean {
  return MODERATOR_ROLES.includes(role);
}

export function canConfigure(role: Role): boolean {
  return CONFIG_ROLES.includes(role);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role, name: user.name, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      role: payload.role as Role,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
    };
  } catch {
    return null;
  }
}

interface CookieGetter {
  cookies: { get(name: string): { value?: string } | undefined };
}

interface CookieStoreLike {
  get(name: string): { value?: string } | undefined | string;
}

function tokenFromHeader(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

type SessionSource =
  | CookieGetter
  | CookieStoreLike
  | Headers
  | Request
  | { headers: Headers }
  | null
  | undefined;

/** `Authorization: Bearer <jwt>` - used by the mobile app (no cookie jar). */
function bearerFrom(value: unknown): string | undefined {
  const headers = (value as { headers?: unknown } | null)?.headers;
  const get = (headers as Headers | undefined)?.get;
  if (typeof get !== "function") return undefined;
  const raw = get.call(headers as Headers, "authorization");
  const match = /^Bearer\s+(.+)$/i.exec(raw?.trim() ?? "");
  return match?.[1];
}

/** Reads the session from a route-handler request or a Next cookie store. */
export async function readSession(source: SessionSource): Promise<SessionUser | null> {
  if (!source) return null;
  let token: string | undefined = bearerFrom(source);

  if (!token && source instanceof Headers) {
    token = tokenFromHeader(source.get("cookie"));
  } else if (!token && source instanceof Request) {
    token = tokenFromHeader(source.headers.get("cookie"));
  } else if (!token) {
    const candidate = source as CookieGetter & CookieStoreLike & { headers?: Headers };
    if (candidate.cookies && typeof candidate.cookies.get === "function") {
      token = candidate.cookies.get(SESSION_COOKIE)?.value;
    } else if (typeof candidate.get === "function") {
      const stored = candidate.get(SESSION_COOKIE);
      token = typeof stored === "string" ? stored : stored?.value;
    } else if (candidate.headers && typeof candidate.headers.get === "function") {
      token = tokenFromHeader(candidate.headers.get("cookie"));
    }
  }

  if (!token) return null;
  return verifySessionToken(token);
}

export async function sessionFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSession(store);
}

export interface AuthedUser extends SessionUser {
  doc: UserDoc;
}

/**
 * Resolves the caller and enforces role. The role is re-read from the database
 * so a revoked account cannot keep acting on an old token.
 */
export async function requireUser(req: SessionSource, roles?: Role[]): Promise<AuthedUser> {
  const session = await readSession(req);
  if (!session) throw unauthorized();
  const db = await getDb();
  const doc = await users(db).findOne({ _id: session.sub });
  if (!doc || !doc.active) throw unauthorized("Account disabled");
  const user: AuthedUser = { sub: doc._id, role: doc.role, name: doc.name, email: doc.email, doc };
  if (roles && !roles.includes(user.role)) throw forbidden("Insufficient role");
  return user;
}

/** Value + options for setting (or clearing) the session cookie. */
export async function sessionCookie(user: SessionUser | null) {
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: user ? SESSION_DAYS * 24 * 60 * 60 : 0,
  } as const;
  return {
    name: SESSION_COOKIE,
    value: user ? await signSession(user) : "",
    options,
  };
}
