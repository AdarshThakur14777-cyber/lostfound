import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { notifications } from "@/models/collections";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: NextRequest) => {
  const user = await requireUser(req);
  const db = await getDb();
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "1";
  const docs = await notifications(db)
    .find(unreadOnly ? { userId: user.sub, read: false } : { userId: user.sub })
    .sort({ at: -1 })
    .limit(50)
    .toArray();

  return json({
    notifications: docs.map((doc) => ({
      id: doc._id,
      type: doc.type,
      title: doc.title,
      body: doc.body,
      link: doc.link ?? null,
      read: doc.read,
      at: doc.at.toISOString(),
    })),
    unreadCount: docs.filter((doc) => !doc.read).length,
  });
});

const readSchema = z.object({ ids: z.array(z.string()).max(100).optional() });

export const POST = handler(async (req: NextRequest) => {
  const user = await requireUser(req);
  const body = readSchema.parse(await req.json().catch(() => ({})));
  const db = await getDb();
  await notifications(db).updateMany(
    body.ids && body.ids.length > 0
      ? { userId: user.sub, _id: { $in: body.ids } }
      : { userId: user.sub, read: false },
    { $set: { read: true } },
  );
  return json({ ok: true });
});
