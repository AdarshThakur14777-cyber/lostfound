import { getDb } from "@/lib/db";
import { handler, json } from "@/lib/http";
import { sessionCookie } from "@/lib/auth";
import { users } from "@/models/collections";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  await getDb();
  const cookie = await sessionCookie(null);
  const response = json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
});
