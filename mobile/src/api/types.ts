export type Role = "student" | "staff" | "security" | "admin" | "sysadmin";

export type ItemStatus =
  | "open"
  | "claim_pending"
  | "in_custody"
  | "returned"
  | "disposal_pending"
  | "disposed"
  | "expired";

export type ClaimStatus =
  | "pending"
  | "verification_passed"
  | "verification_failed"
  | "approved"
  | "rejected"
  | "handed_over"
  | "cancelled";

export interface MeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
}

export interface AuthResponse {
  user: MeUser;
  token?: string;
}

export interface PublicCategory {
  id: string;
  name: string;
  parentId: string | null;
  attributes: string[];
}

export interface PublicLocation {
  id: string;
  name: string;
  parentId: string | null;
  path: string[];
}

export interface Taxonomy {
  categories: PublicCategory[];
  locations: PublicLocation[];
}

export interface PublicItem {
  id: string;
  type: "lost" | "found";
  title: string;
  description: string;
  category: { id: string; name: string };
  location: { id: string; name: string; path: string[] };
  occurredAt: string;
  postedAt: string;
  status: ItemStatus;
  images: string[];
  attributes: Record<string, string>;
  claimable: boolean;
  hasVerification: boolean;
  redacted: true;
}

export type PublicListItem = Pick<
  PublicItem,
  | "id"
  | "type"
  | "title"
  | "category"
  | "location"
  | "occurredAt"
  | "postedAt"
  | "status"
  | "images"
  | "claimable"
  | "redacted"
>;

export interface BoardPage {
  items: PublicListItem[];
  nextCursor: string | null;
}

export interface MyItemRow extends PublicItem {
  claimCount: number;
  matchCount: number;
  custodyCount: number;
  claims: {
    id: string;
    status: ClaimStatus;
    passed: boolean;
    attempts: number;
    claimantName: string;
    createdAt: string;
    note: string;
  }[];
}

export interface ClaimView {
  id: string;
  itemId: string;
  status: ClaimStatus;
  passed: boolean;
  attempts: number;
  correctCount: number;
  requiredCorrect: number;
  attemptsLeft: number;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  note: string;
  claimantName: string;
  item: PublicItem | null;
  questions: { entryId: string; question: string }[] | null;
}

export interface CreateClaimResponse {
  claim: ClaimView;
  challenge: { id: string; requiredCorrect: number; maxAttempts: number };
}

export interface VerifyOutcome {
  passed: boolean;
  correctCount: number;
  attemptsLeft: number;
  requiredCorrect: number;
  status: "pending" | "passed" | "failed" | "consumed";
  results: { entryId: string; correct: boolean; similarity: number }[];
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  at: string;
}

export interface NotificationsPage {
  notifications: NotificationRow[];
  unreadCount: number;
}

export interface CustodyRecord {
  id: string;
  seq: number;
  action: "reported" | "received" | "moved" | "transferred" | "handed_over";
  at: string;
  actorName: string;
  fromLocation?: string | null;
  toLocation?: string | null;
  fromHolder?: string | null;
  toHolder?: string | null;
  note?: string | null;
  proofImage?: string | null;
}

export interface MatchRow {
  id: string;
  score: number;
  reasons: string[];
  status: "auto" | "dismissed" | "confirmed";
  item: PublicItem | null;
}

export interface HandoverRow {
  id: string;
  claimId: string;
  itemId: string;
  status: "scheduled" | "completed" | "cancelled";
  method: "otp" | "signature";
  createdAt: string;
  completedAt: string | null;
  itemTitle: string;
  itemImages: string[];
  claimantName: string;
  claimantEmail: string;
  securityName: string;
}

export interface ScheduleHandoverResponse {
  id: string;
  method: "otp" | "signature";
  status: "scheduled" | "completed" | "cancelled";
  expiresAt: string | null;
}

export interface AdminQueue {
  ageing: {
    id: string;
    title: string;
    type: "lost" | "found";
    category: string;
    location: string;
    ageDays: number;
    remainingDays: number;
    due: boolean;
  }[];
  disposalQueue: {
    id: string;
    title: string;
    type: "lost" | "found";
    category: string;
    location: string;
    ageDays: number;
    queuedAt: string;
  }[];
  verificationQueue: {
    id: string;
    itemId: string;
    itemTitle: string;
    claimantName: string;
    status: ClaimStatus;
    passed: boolean;
    attempts: number;
    createdAt: string;
  }[];
  custodyInventory: { locationId: string; name: string; count: number }[];
}

export interface AdminReports {
  totals: {
    reported: number;
    lost: number;
    found: number;
    returned: number;
    disposed: number;
    open: number;
    inCustody: number;
    disposalPending: number;
  };
  returnRate: number;
  medianHoursToReturn: number;
  hotspots: { name: string; count: number }[];
  categories: { name: string; count: number }[];
  ageing: { dueForDisposal: number; ageingWarnings: number; retentionDays: number };
  verification: {
    attempted: number;
    failed: number;
    failureRate: number;
    byStatus: Record<string, number>;
  };
  disposals: { recorded: number };
  pendingMatches: number;
  custodyChainLength: number;
}

export interface Settings {
  _id: "main";
  retentionDays: number;
  ageingWarningDays: number;
  challengeCount: number;
  requiredCorrect: number;
  maxClaimAttempts: number;
  matchThreshold: number;
  matchTopK: number;
  timeHalfLifeDays: number;
  updatedAt: string;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string;
}

export type DisposalMethod =
  | "discarded"
  | "donated"
  | "returned_to_originator"
  | "archive";
