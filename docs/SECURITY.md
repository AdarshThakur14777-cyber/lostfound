# Public vs private fields (redaction contract)

This is the privacy statement for the Campus Lost and Found platform: exactly
which item fields are public, which are private, where private data lives, and
how it is protected. The guarantee is enforced by code and by tests
(`tests/redaction.test.ts`).

## Rule

**No response body ever contains a raw `ItemDoc` or `PrivateDetailDoc`.**
Every public response is produced by the allow-list serializers in
`src/lib/serialize/public.ts`, which are the only functions allowed to turn a
document into JSON. The private-details collection is not imported there, so
there is no code path from it into a public response.

## Public fields

Anyone (unauthenticated) may read these, from `GET /api/board`,
`GET /api/items`, `GET /api/items/[id]` and the site pages:

### Item detail (`PublicItem`)

| Field        | Notes                                                  |
| ------------ | ------------------------------------------------------ |
| `id`         | opaque item id                                         |
| `type`       | `lost` \| `found`                                      |
| `title`      | chosen by the reporter (must not contain secrets)      |
| `description`| free text, no identifying markers by policy            |
| `category`   | `{ id, name }`                                         |
| `location`   | `{ id, name, path[] }` (e.g. Building → Library → Desk) |
| `occurredAt` | when the loss/find happened (date only)                |
| `postedAt`   | when it was reported                                   |
| `status`     | one of `ITEM_STATUSES`                                 |
| `images`     | photo URLs, EXIF/GPS already stripped at upload        |
| `attributes` | category attributes (colour, brand…)                   |
| `claimable`  | whether claims are accepted right now                  |
| `hasVerification` | only "does a verification challenge exist"         |
| `redacted`   | always `true`, marks the projection as redacted        |

### Board list (`PublicListItem`)

`id, type, title, category, location, occurredAt, postedAt, status, images
(first one only), claimable, redacted`.

### Also public

- Category and location taxonomy (`id, name, parentId[, path]`).
- Aggregate analytics (`/api/admin/reports` output shape is fine for staff;
  the public dashboard only receives counts and trends, never identities).
- A claimant's verification questions are shown **only to that claimant**,
  and only in encrypted-at-rest form re-decrypted for the session that owns
  the claim — never on the board.

## Private fields (never public)

Stored outside the item document and never serialised publicly:

| Data                            | Where                             | Protection                          |
| ------------------------------- | --------------------------------- | ----------------------------------- |
| Verification questions/answers  | `private_details.entries[]`       | AES-256-GCM (`APP_ENCRYPTION_KEY`)  |
| Ownership proof notes/photos    | `private_details` / `custody.proofImage` | encrypted or staff-only route |
| Reporter & claimant identities  | `items.reporterId`, `claims.*`    | ids only, resolved for permitted roles |
| Contact details                 | `users.email/phone`               | auth/role-gated endpoints           |
| Password hashes                 | `users.passwordHash`              | bcrypt, never serialised            |
| Handover OTPs                   | `handovers.otpHash`               | hashed, delivered in-app to claimant only |
| Internal audit trail            | `audit_log`                       | staff/admin routes                  |
| Custody chain                   | `custody_chain`                   | reporter + staff/security/admin      |

The corresponding stored document types are in `src/models/types.ts`
(`PrivateDetailDoc`, `HandoverDoc.otpHash`, …).

## Who may see what

| Role     | Public board | Item detail | Private details | Claims/verify | Custody chain | Admin/config |
| -------- | ------------ | ----------- | --------------- | ------------- | ------------- | ------------ |
| anon     | yes          | yes (redacted) | no           | no            | no            | no (401)     |
| student  | yes          | yes (redacted) | own item/own claim | own     | own reports   | no (403)     |
| staff    | yes          | yes         | reported items   | assigned queue | yes          | no (403)     |
| security | yes          | yes         | queued items     | yes (decides) | yes           | no (403)*    |
| admin    | yes          | yes         | yes              | yes           | yes           | yes          |
| sysadmin | yes          | yes         | yes              | yes           | yes           | yes          |

\* `security` can act on the verification/disposal queues but is denied
config endpoints (`/api/admin/settings`, `/api/admin/users`) — those are
admin/sysadmin only.

## Additional guarantees

- **Photo pipeline** — uploads are re-encoded with sharp without
  `.withMetadata()`, which drops EXIF including GPS; the original bytes are
  never served.
- **Transport** — session is an HttpOnly `session` JWT cookie; state-changing
  endpoints re-read the role from the database, so a stale cookie cannot
  escalate privileges. The Android app has no cookie jar, so it sends the same
  JWT as `Authorization: Bearer <token>` (returned by `/api/auth/login`);
  tokens are stored in the Android Keystore via `expo-secure-store` and stop
  working as soon as the account is deactivated (role is re-read from the DB).
- **Verification challenges** reference private entries by id only; question
  and answer ciphertext never leaves the server except decrypted-for-the-owner
  during an active challenge.
- **Auditability** — every state change writes an `audit_log` entry with actor,
  role, entity and action.

## Enforcement

`tests/redaction.test.ts` fetches real responses, walks every key path, and
fails if any forbidden key or known ciphertext appears anywhere. If you add a
field to a public projection, add it to the allow-list in
`src/lib/serialize/public.ts` — not to a route handler — and the test will
confirm it is the only place you could have done so.
