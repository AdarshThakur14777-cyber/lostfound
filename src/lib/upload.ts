import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { uploadDir } from "./env";
import { badRequest } from "./http";

const MAX_BYTES = 8 * 1024 * 1024;
const NAME_PATTERN = /^[a-f0-9]{32}\.jpg$/;

/**
 * Photo pipeline. Sharp strips ALL metadata (EXIF, including the GPS coordinates
 * of whoever photographed the item) because `.withMetadata()` is never called -
 * stripping happens here, before bytes touch disk, not after.
 */
export async function saveImage(file: File): Promise<string> {
  if (file.size > MAX_BYTES) throw badRequest("Image is larger than 8MB");
  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    output = await sharp(input)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch {
    throw badRequest("File is not a readable image");
  }
  const name = `${randomBytes(16).toString("hex")}.jpg`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), output);
  return `/api/files/${name}`;
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (!NAME_PATTERN.test(name)) return null;
  try {
    return await readFile(path.join(uploadDir(), name));
  } catch {
    return null;
  }
}

export function isImagePath(value: unknown): value is string {
  return typeof value === "string" && /^\/api\/files\/[a-f0-9]{32}\.jpg$/.test(value);
}
