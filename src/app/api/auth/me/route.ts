import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { readSession } from "@/lib/auth";
import { users } from "@/models/collections";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const session = await readSession(req);
  if (!session) return json({ user: null });
  const db = await getDb();
  const user = await users(db).findOne({ _id: session.sub });
  if (!user || !user.active) return json({ user: null });
  return json({
    user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department },
  });
});
