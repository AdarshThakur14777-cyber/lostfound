import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { handler, json, conflict } from "@/lib/http";
import { hashPassword, randomId } from "@/lib/crypto";
import { sessionCookie, type SessionUser } from "@/lib/auth";
import { publicUser } from "@/lib/users";
import { users } from "@/models/collections";
import type { Role, UserDoc } from "@/models/types";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(["student", "staff"]).optional(),
  department: z.string().trim().max(120).optional(),
});

export const POST = handler(async (req: NextRequest) => {
  const body = schema.parse(await req.json());
  const db = await getDb();
  const email = body.email.toLowerCase();
  const existing = await users(db).findOne({ email });
  if (existing) throw conflict("An account with that email already exists");

  const role: Role = body.role ?? "student";
  const doc: UserDoc = {
    _id: randomId(9),
    name: body.name,
    email,
    passwordHash: await hashPassword(body.password),
    role,
    department: body.department,
    active: true,
    createdAt: new Date(),
  };
  await users(db).insertOne(doc);

  const session: SessionUser = { sub: doc._id, role: doc.role, name: doc.name, email: doc.email };
  const cookie = await sessionCookie(session);
  const response = json({ user: publicUser(doc), token: cookie.value }, 201);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
});
