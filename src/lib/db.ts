import fs from "node:fs/promises";
import path from "node:path";
import { Db, MongoClient } from "mongodb";
import { ensureIndexes } from "@/models/collections";

const DEFAULT_URI = "mongodb://127.0.0.1:27117/lostfound";
const MEMORY_PORT = 27117;

interface Cached {
  client: MongoClient;
  db: Db;
}

const globalStore = globalThis as unknown as {
  __lfDb?: Cached;
  __lfMemoryServer?: { stop(): Promise<boolean> };
};

function isLocal(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  } catch {
    return false;
  }
}

async function connect(uri: string): Promise<MongoClient> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  return client;
}

/**
 * Returns the MongoDB handle.
 *
 * If MONGODB_URI is unset or points at a local server that is not running, an
 * in-memory MongoDB is started on the same host/port so development and tests
 * work with zero setup. A configured remote URI is never silently replaced.
 */
export async function getDb(): Promise<Db> {
  if (globalStore.__lfDb) return globalStore.__lfDb.db;

  const uri = process.env.MONGODB_URI?.trim() || DEFAULT_URI;
  let client: MongoClient | null = null;

  try {
    client = await connect(uri);
  } catch (err) {
    if (!isLocal(uri)) throw err;
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const url = new URL(uri);
    const dbName = url.pathname.replace(/^\//, "") || "lostfound";
    const port = Number(url.port || MEMORY_PORT);
    // Keep the data on disk (per port) so `npm run seed` survives the seed
    // process exiting and the dev server restarts. Tests use a separate port.
    const dbPath = path.join(process.cwd(), ".data", `mongo-${port}`);
    await fs.mkdir(dbPath, { recursive: true });
    const server = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1", port, dbPath },
      // custom dbPaths are preserved on stop(); only tmp instances are removed
    });
    globalStore.__lfMemoryServer = server;
    client = await connect(server.getUri(dbName));
  }

  const db = client.db();
  globalStore.__lfDb = { client, db };
  await ensureIndexes(db);
  return db;
}

export async function closeDb(): Promise<void> {
  const store = globalStore.__lfDb;
  if (store) {
    await store.client.close().catch(() => undefined);
    globalStore.__lfDb = undefined;
  }
  const mem = globalStore.__lfMemoryServer;
  if (mem) {
    await mem.stop().catch(() => undefined);
    globalStore.__lfMemoryServer = undefined;
  }
}
