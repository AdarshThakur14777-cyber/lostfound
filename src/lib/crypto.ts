import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from "node:crypto";
import bcrypt from "bcryptjs";
import { encryptionKey } from "./env";

const VERSION = "v1";

/**
 * AES-256-GCM. Used for every private identifying detail: the ciphertext lives in
 * the `private_details` collection, which no public serializer ever reads.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("Malformed ciphertext");
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Decrypt, but never throw - used where a corrupt value must not break a response. */
export function decryptSafe(payload: string): string | null {
  try {
    return decrypt(payload);
  } catch {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** One-way hash for OTPs and answer auditing; never reversible. */
export function hmac(value: string, purpose: string): string {
  return createHmac("sha256", encryptionKey()).update(`${purpose}:${value}`).digest("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomId(bytes = 12): string {
  return randomBytes(bytes).toString("base64url");
}

export function generateOtp(): string {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}
