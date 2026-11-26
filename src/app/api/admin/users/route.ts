import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { conflict, handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { hashPassword, randomId } from "@/lib/crypto";
import { users } from "@/models/collections";
import { publicUser } from "@/lib/users";
import type { Role, UserDoc } from "@/models/types";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  await requireUser(req, ["admin", "sysadmin"]);
  const db = await getDb();
  const docs = await users(db).find({}).sort({ createdAt: -1 }).limit(200).toArray();
  return json({ users: docs.map(publicUser) });
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum(["student", "staff", "security", "admin", "sysadmin"]),
  department: z.string().trim().max(120).optional(),
});

/** POST - creates any role, including security and administrators. */
export const POST = handler(async (req: NextRequest) => {
  await requireUser(req, ["admin", "sysadmin"]);
  const body = createSchema.parse(await req.json());
  const db = await getDb();
  const email = body.email.toLowerCase();
  if (await users(db).findOne({ email })) throw conflict("Email already in use");

  const doc: UserDoc = {
    _id: randomId(9),
    name: body.name,
    email,
    passwordHash: await hashPassword(body.password),
    role: body.role as Role,
    department: body.department,
    active: true,
    createdAt: new Date(),
  };
  await users(db).insertOne(doc);
  return json({ user: publicUser(doc) }, 201);
});
