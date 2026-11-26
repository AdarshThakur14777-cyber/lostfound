import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { forbidden, handler, json, notFound } from "@/lib/http";
import { isModerator, requireUser } from "@/lib/auth";
import { matches } from "@/models/collections";

export const dynamic = "force-dynamic";

const schema = z.object({ status: z.enum(["confirmed", "dismissed", "auto"]) });

/** PATCH - staff confirms or dismisses a match suggestion (match review). */
export const PATCH = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  if (!isModerator(user.role)) throw forbidden("Staff only");
  const body = schema.parse(await req.json());
  const db = await getDb();
  const result = await matches(db).updateOne(
    { _id: id },
    { $set: { status: body.status, updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) throw notFound("Suggestion not found");
  return json({ ok: true, status: body.status });
});
