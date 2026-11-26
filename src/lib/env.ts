import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

let cachedKey: Buffer | null = null;

function devKey(): Buffer {
  if (cachedKey) return cachedKey;
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "dev-key");
  if (existsSync(file)) {
    cachedKey = Buffer.from(readFileSync(file, "utf8").trim(), "base64");
  } else {
    mkdirSync(dir, { recursive: true });
    const key = randomBytes(32);
    writeFileSync(file, key.toString("base64"), { mode: 0o600 });
    cachedKey = key;
  }
  return cachedKey;
}

/** 32-byte AES key. Required in production, generated once for development. */
export function encryptionKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes");
    return key;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_ENCRYPTION_KEY is required in production");
  }
  return devKey();
}

let cachedSecret: Buffer | null = null;

/** Secret used to sign session JWTs. */
export function sessionSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.APP_SESSION_SECRET;
  if (raw) {
    cachedSecret = Buffer.from(raw, "utf8");
    return cachedSecret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SESSION_SECRET is required in production");
  }
  cachedSecret = devKey();
  return cachedSecret;
}

export function uploadDir(): string {
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(process.cwd(), ".data", "uploads");
}

export function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000";
}
