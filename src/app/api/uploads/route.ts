import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { badRequest, handler, json } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { saveImage } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** Photo upload (EXIF/GPS stripped by the sharp pipeline). */
export const POST = handler(async (req: NextRequest) => {
  await requireUser(req);
  const form = await req.formData();
  const files = [...form.getAll("files"), ...form.getAll("file")].filter(
    (entry): entry is File => entry instanceof File,
  );
  if (files.length === 0) throw badRequest("No image received");
  if (files.length > 6) throw badRequest("Too many images (max 6)");

  const paths: string[] = [];
  for (const file of files) paths.push(await saveImage(file));
  await getDb();
  return json({ paths }, 201);
});
