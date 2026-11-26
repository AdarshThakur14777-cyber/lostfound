import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { forbidden, handler, json, notFound } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { users } from "@/models/collections";
import { publicUser } from "@/lib/users";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  role: z.enum(["student", "staff", "security", "admin", "sysadmin"]).optional(),
  active: z.boolean().optional(),
});

export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const actor = await requireUser(req, ["admin", "sysadmin"]);
  const body = patchSchema.parse(await req.json());
  if (body.role === "sysadmin" && actor.role !== "sysadmin") {
    throw forbidden("Only a system administrator can grant that role");
  }
  const db = await getDb();
  const result = await users(db).updateOne(
    { _id: id },
    { $set: { ...(body.role ? { role: body.role } : {}), ...(body.active !== undefined ? { active: body.active } : {}) } },
  );
  if (result.matchedCount === 0) throw notFound("User not found");
  const updated = await users(db).findOne({ _id: id });
  return json({ user: publicUser(updated!) });
});
