import type { ObjectId } from "mongodb";

export type Role = "student" | "staff" | "security" | "admin" | "sysadmin";

export type ItemStatus =
  | "open"
  | "claim_pending"
  | "in_custody"
  | "returned"
  | "disposal_pending"
  | "disposed"
  | "expired";

export const ITEM_STATUSES: ItemStatus[] = [
  "open",
  "claim_pending",
  "in_custody",
  "returned",
  "disposal_pending",
  "disposed",
  "expired",
];

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  department?: string;
  phone?: string;
  active: boolean;
  createdAt: Date;
}

export interface ItemCategoryDoc {
  _id: string;
  name: string;
  parentId: string | null;
  /** Attributes this category asks reporters to fill in (colour, brand, ...). */
  attributes: string[];
  retentionDays?: number;
  createdAt: Date;
}

export interface LocationDoc {
  _id: string;
  name: string;
  parentId: string | null;
  /** Ancestor ids from root to self - powers proximity scoring. */
  path: string[];
  createdAt: Date;
}

/**
 * Identifying details recorded by the reporter of a found item (or the owner of
 * a lost item). Stored encrypted, in a collection that is structurally outside
 * the public read path - see src/lib/serialize/public.ts.
 */
export interface PrivateDetailDoc {
  _id: string;
  itemId: string;
  ownerUserId: string;
  entries: PrivateDetailEntry[];
  updatedAt: Date;
}

export interface PrivateDetailEntry {
  id: string;
  questionEnc: string;
  answerEnc: string;
}

export interface ItemDoc {
  _id: string;
  type: "lost" | "found";
  title: string;
  description: string;
  categoryId: string;
  locationId: string;
  occurredAt: Date;
  attributes: Record<string, string>;
  images: string[];
  status: ItemStatus;
  reporterId: string;
  hasPrivateDetails: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Physical custody snapshot for found items held by the campus. */
  custody?: { locationId: string; holderId: string | null; since: Date };
  returnedToUserId?: string;
  returnedAt?: Date;
  expiredAt?: Date;
}

export interface MatchSuggestionDoc {
  _id: string;
  itemId: string;
  otherItemId: string;
  score: number;
  reasons: string[];
  status: "auto" | "dismissed" | "confirmed";
  createdAt: Date;
  updatedAt: Date;
}

export type ClaimStatus =
  | "pending"
  | "verification_passed"
  | "verification_failed"
  | "approved"
  | "rejected"
  | "handed_over"
  | "cancelled";

export interface ClaimDoc {
  _id: string;
  itemId: string;
  claimantId: string;
  note: string;
  status: ClaimStatus;
  challengeId: string;
  attempts: number;
  correctCount: number;
  passed: boolean;
  createdAt: Date;
  decidedAt?: Date;
  decidedById?: string;
  decisionNote?: string;
}

export type ChallengeStatus = "pending" | "passed" | "failed" | "consumed";

export interface VerificationChallengeDoc {
  _id: string;
  claimId: string;
  itemId: string;
  /** References into private_details.entries - never the answers themselves. */
  entryIds: string[];
  questions: { entryId: string; questionEnc: string }[];
  requiredCorrect: number;
  maxAttempts: number;
  attempts: number;
  status: ChallengeStatus;
  scores: { attempt: number; correct: number; at: Date }[];
  createdAt: Date;
}

export type CustodyAction = "reported" | "received" | "moved" | "transferred" | "handed_over";

export interface CustodyRecordDoc {
  _id: string;
  itemId: string;
  seq: number;
  action: CustodyAction;
  fromLocationId?: string;
  toLocationId?: string;
  fromHolderId?: string;
  toHolderId?: string;
  actorId: string;
  at: Date;
  note?: string;
  proofImage?: string;
}

export interface HandoverDoc {
  _id: string;
  claimId: string;
  itemId: string;
  claimantId: string;
  securityId: string;
  method: "otp" | "signature";
  status: "scheduled" | "completed" | "cancelled";
  otpHash?: string;
  otpExpiresAt?: Date;
  otpAttempts?: number;
  signatureName?: string;
  proofImage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface DisposalRecordDoc {
  _id: string;
  itemId: string;
  reason: "unclaimed" | "expired";
  dueAt: Date;
  disposedAt: Date;
  disposedById: string;
  method: "discarded" | "donated" | "returned_to_originator" | "archive";
  notes?: string;
}

export interface AuditEntryDoc {
  _id: string;
  at: Date;
  actorId: string | null;
  actorRole: Role | "system";
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
}

export interface NotificationDoc {
  _id: string;
  userId: string;
  type:
    | "possible_match"
    | "claim_submitted"
    | "verification_required"
    | "verification_result"
    | "handover_scheduled"
    | "handover_completed"
    | "ageing_warning"
    | "disposal"
    | "claim_decided";
  title: string;
  body: string;
  link?: string;
  read: boolean;
  at: Date;
}

export interface SettingsDoc {
  _id: "main";
  retentionDays: number;
  ageingWarningDays: number;
  challengeCount: number;
  requiredCorrect: number;
  maxClaimAttempts: number;
  matchThreshold: number;
  matchTopK: number;
  timeHalfLifeDays: number;
  updatedAt: Date;
}

export const DEFAULT_SETTINGS: Omit<SettingsDoc, "updatedAt"> = {
  _id: "main",
  retentionDays: 30,
  ageingWarningDays: 25,
  challengeCount: 3,
  requiredCorrect: 2,
  maxClaimAttempts: 3,
  matchThreshold: 0.4,
  matchTopK: 5,
  timeHalfLifeDays: 3,
};

/** Cast helpers - ids are strings (uuid-style), not ObjectId. */
export type WithId = { _id: string };
export type MaybeId = ObjectId | string;
