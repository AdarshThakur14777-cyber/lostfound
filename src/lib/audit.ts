import type { Db } from "mongodb";
import { audit, notifications } from "@/models/collections";
import type { AuditEntryDoc, NotificationDoc, Role } from "@/models/types";
import { randomId } from "./crypto";

export async function writeAudit(
  db: Db,
  input: {
    actorId: string | null;
    actorRole: Role | "system";
    action: string;
    entityType: string;
    entityId: string;
    meta?: Record<string, unknown>;
  },
): Promise<AuditEntryDoc> {
  const doc: AuditEntryDoc = {
    _id: randomId(10),
    at: new Date(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    meta: input.meta,
  };
  await audit(db).insertOne(doc);
  return doc;
}

export async function notify(
  db: Db,
  input: Omit<NotificationDoc, "_id" | "read" | "at">,
): Promise<NotificationDoc> {
  const doc: NotificationDoc = {
    _id: randomId(10),
    ...input,
    read: false,
    at: new Date(),
  };
  await notifications(db).insertOne(doc);
  return doc;
}
