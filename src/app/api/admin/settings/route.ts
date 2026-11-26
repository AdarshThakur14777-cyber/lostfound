import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["admin", "sysadmin"]);
  const db = await getDb();
  const settings = await getSettings(db);
  return json({ settings, viewerRole: user.role });
});

const patchSchema = z.object({
  retentionDays: z.number().int().min(1).max(365).optional(),
  ageingWarningDays: z.number().int().min(1).max(120).optional(),
  challengeCount: z.number().int().min(1).max(6).optional(),
  requiredCorrect: z.number().int().min(1).max(6).optional(),
  maxClaimAttempts: z.number().int().min(1).max(10).optional(),
  matchThreshold: z.number().min(0).max(1).optional(),
  matchTopK: z.number().int().min(1).max(20).optional(),
  timeHalfLifeDays: z.number().min(0.1).max(60).optional(),
});

export const PATCH = handler(async (req: NextRequest) => {
  const user = await requireUser(req, ["admin", "sysadmin"]);
  const body = patchSchema.parse(await req.json());
  const db = await getDb();
  const settings = await updateSettings(db, body);
  await writeAudit(db, {
    actorId: user.sub,
    actorRole: user.role,
    action: "settings.updated",
    entityType: "settings",
    entityId: "main",
    meta: body as Record<string, unknown>,
  });
  return json({ settings });
});
