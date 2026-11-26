import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { handler, json, badRequest } from "@/lib/http";
import { verifyPassword } from "@/lib/crypto";
import { sessionCookie, type SessionUser } from "@/lib/auth";
import { users } from "@/models/collections";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});

export const POST = handler(async (req: NextRequest) => {
  const body = schema.parse(await req.json());
  const db = await getDb();
  const user = await users(db).findOne({ email: body.email.toLowerCase() });
  if (!user || !user.active) throw badRequest("Invalid email or password");

  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) throw badRequest("Invalid email or password");

  const session: SessionUser = { sub: user._id, role: user.role, name: user.name, email: user.email };
  const cookie = await sessionCookie(session);
  const response = json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
    // Bearer token for the mobile app; browsers ignore it and use the cookie.
    token: cookie.value,
  });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
});
