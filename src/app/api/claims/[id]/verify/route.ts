import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { verifyClaim } from "@/lib/claims";

export const dynamic = "force-dynamic";

const schema = z.object({
  answers: z
    .array(z.object({ entryId: z.string().min(1), answer: z.string().max(300) }))
    .min(1)
    .max(8),
});

/** POST - submit challenge answers; scoring happens server-side. */
export const POST = handler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser(req);
  const body = schema.parse(await req.json());
  const db = await getDb();
  const outcome = await verifyClaim(db, {
    claimId: id,
    claimantId: user.sub,
    answers: body.answers,
  });
  return json(outcome);
});
