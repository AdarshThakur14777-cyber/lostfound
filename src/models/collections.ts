import type { Db } from "mongodb";
import {
  AuditEntryDoc,
  ClaimDoc,
  CustodyRecordDoc,
  DisposalRecordDoc,
  HandoverDoc,
  ItemCategoryDoc,
  ItemDoc,
  LocationDoc,
  MatchSuggestionDoc,
  NotificationDoc,
  PrivateDetailDoc,
  SettingsDoc,
  UserDoc,
  VerificationChallengeDoc,
} from "./types";

export const C = {
  users: "users",
  categories: "categories",
  locations: "locations",
  items: "items",
  privateDetails: "private_details",
  matches: "match_suggestions",
  claims: "claims",
  challenges: "verification_challenges",
  custody: "custody_records",
  handovers: "handovers",
  disposals: "disposal_records",
  audit: "audit_entries",
  notifications: "notifications",
  settings: "settings",
} as const;

export function users(db: Db) {
  return db.collection<UserDoc>(C.users);
}
export function categories(db: Db) {
  return db.collection<ItemCategoryDoc>(C.categories);
}
export function locations(db: Db) {
  return db.collection<LocationDoc>(C.locations);
}
export function items(db: Db) {
  return db.collection<ItemDoc>(C.items);
}
export function privateDetails(db: Db) {
  return db.collection<PrivateDetailDoc>(C.privateDetails);
}
export function matches(db: Db) {
  return db.collection<MatchSuggestionDoc>(C.matches);
}
export function claims(db: Db) {
  return db.collection<ClaimDoc>(C.claims);
}
export function challenges(db: Db) {
  return db.collection<VerificationChallengeDoc>(C.challenges);
}
export function custody(db: Db) {
  return db.collection<CustodyRecordDoc>(C.custody);
}
export function handovers(db: Db) {
  return db.collection<HandoverDoc>(C.handovers);
}
export function disposals(db: Db) {
  return db.collection<DisposalRecordDoc>(C.disposals);
}
export function audit(db: Db) {
  return db.collection<AuditEntryDoc>(C.audit);
}
export function notifications(db: Db) {
  return db.collection<NotificationDoc>(C.notifications);
}
export function settings(db: Db) {
  return db.collection<SettingsDoc>(C.settings);
}

let indexReady = false;

export async function ensureIndexes(db: Db): Promise<void> {
  if (indexReady) return;
  indexReady = true;
  await Promise.all([
    users(db).createIndex({ email: 1 }, { unique: true }),
    items(db).createIndex({ status: 1, createdAt: -1 }),
    items(db).createIndex({ reporterId: 1, createdAt: -1 }),
    items(db).createIndex({ categoryId: 1 }),
    items(db).createIndex({ locationId: 1 }),
    items(db).createIndex({ type: 1, status: 1 }),
    items(db).createIndex(
      { title: "text", description: "text" },
      { name: "item_text", weights: { title: 3, description: 1 } },
    ),
    privateDetails(db).createIndex({ itemId: 1 }, { unique: true }),
    matches(db).createIndex({ itemId: 1, otherItemId: 1 }, { unique: true }),
    matches(db).createIndex({ otherItemId: 1 }),
    claims(db).createIndex({ itemId: 1, claimantId: 1 }),
    claims(db).createIndex({ claimantId: 1, createdAt: -1 }),
    claims(db).createIndex({ status: 1, createdAt: 1 }),
    challenges(db).createIndex({ claimId: 1 }, { unique: true }),
    custody(db).createIndex({ itemId: 1, seq: 1 }),
    handovers(db).createIndex({ status: 1, createdAt: 1 }),
    handovers(db).createIndex({ claimId: 1 }),
    notifications(db).createIndex({ userId: 1, read: 1, at: -1 }),
    audit(db).createIndex({ entityId: 1, at: -1 }),
    audit(db).createIndex({ at: -1 }),
    locations(db).createIndex({ parentId: 1 }),
    categories(db).createIndex({ parentId: 1 }),
  ]).catch((err) => {
    indexReady = false;
    throw err;
  });
}
