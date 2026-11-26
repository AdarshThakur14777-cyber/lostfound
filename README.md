# Campus Lost and Found Platform

Track J (Next.js + Node.js + MongoDB) implementation of the campus lost-and-found
spec: a redacted public board, encrypted ownership-verification details, a
claim → verify → supervised handover workflow, a full custody chain, ageing and
disposal, an admin dashboard and analytics.

## Quick start

```bash
npm install
npm run seed        # demo data + demo accounts
npm run dev         # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

No MongoDB or Docker required. When `MONGODB_URI` is unset or points at a local
server that is not running, the app starts an in-memory MongoDB on
`mongodb://127.0.0.1:27117/lostfound` backed by `.data/mongo-27117`, so seeded
data survives process restarts. The test suite uses its own port
(`27118`) and can never wipe your seeded dev data.

## Android app

An Expo (React Native) client with full feature parity lives in [`mobile/`](mobile/):

```bash
cd mobile
npm install
npm start          # scan the QR code with Expo Go on your Android phone
```

Point it at this API from the **Me** tab (emulator default
`http://10.0.2.2:3000`, or your PC's LAN IP for a physical device). It
authenticates with `Authorization: Bearer <token>` - the same JWT as the web
session cookie, returned by `/api/auth/login`. See [`mobile/README.md`](mobile/README.md)
for emulator/EAS build options and the screen-by-screen tour.

### Demo accounts (password `Demo1234!`)

| Email                 | Role     | Sees                                    |
| --------------------- | -------- | --------------------------------------- |
| `student@demo.local`  | student  | own reports, claims, notifications      |
| `student2@demo.local` | student  | second claimant (competing claims)      |
| `staff@demo.local`    | staff    | reports + custody chains                |
| `security@demo.local` | security | verification queue, handovers, ageing   |
| `admin@demo.local`    | admin    | everything + settings/users/reports     |
| `sysadmin@demo.local` | sysadmin | everything (config role)                |

## Scripts

| Command                | What it does                                             |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Next.js dev server                                       |
| `npm run build`        | Production build                                          |
| `npm start`            | Serve the production build                               |
| `npm run typecheck`    | `tsc --noEmit`                                            |
| `npm test`             | Vitest (40 tests: redaction, claims, handover, ageing…)   |
| `npm run seed`         | Reset + seed users, taxonomy, 18 items, matches, custody  |
| `npm run refresh-matches` | Recompute match suggestions                           |
| `npm run ageing`       | Run the ageing/disposal sweep (also callable from admin)  |

## Environment (`.env.example`)

| Variable                | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `MONGODB_URI`           | Mongo connection (fallback described above)              |
| `APP_ENCRYPTION_KEY`    | base64 32-byte key for AES-256-GCM private details       |
| `APP_SESSION_SECRET`    | JWT secret for the session cookie                        |
| `UPLOAD_DIR`            | Photo storage (default `.data/uploads`)                  |
| `APP_URL`               | Base URL used in notifications                           |

Development generates throwaway keys in `.data/dev-key` if they are unset.
Set both secrets explicitly in production.

## How it fits together

```
report ──► /api/items ──► matching engine ──► match suggestions
   │                                          │
   ▼                                          ▼
private_details (AES-256-GCM)          claim ──► verification challenge
                                               │
                          security decision ◄──┘
                                   │
                                   ▼
                     supervised handover (OTP or signature)
                                   │
                                   ▼
                     custody chain (append-only) ──► returned
                                   │
                     ageing sweep ─┴─► disposal_pending ──► disposed
```

- **Public board** — `GET /api/board` and every item detail response are built
  exclusively by `toPublicItem`/`toPublicListItem`
  (`src/lib/serialize/public.ts`), an explicit allow-list. The private details
  live in a *separate collection* that this module does not import, so a
  private field cannot reach a public response by accident.
- **Ownership verification** — questions/answers are stored encrypted in
  `private_details`; challenges only ever reference `entryIds`. Wrong answers
  burn attempts (3 by default), after which the claim fails.
- **Supervised handover** — security schedules it; the claimant receives a
  short-lived OTP in-app (or signs on the desk tablet). A proof photo is
  mandatory; completing it appends `handed_over` to the custody chain and marks
  the item `in_custody`/`returned`.
- **Ageing & disposal** — items older than the configured retention window get
  an ageing warning, then move to `disposal_pending`; disposal records the
  method, actor and notes.
- **Roles** — `student`, `staff`, `security` (moderation), `admin` and
  `sysadmin` (config). Enforced server-side in `requireUser(req, roles?)`.

## API surface

```
POST /api/auth/register|login|logout      GET /api/auth/me
GET  /api/board                           GET /api/taxonomy
POST /api/uploads                         GET /api/files/[name]
GET|POST /api/items                       GET|PATCH|DELETE /api/items/[id]
GET  /api/items/[id]/matches              GET /api/items/[id]/custody
GET|POST /api/claims                      GET /api/claims/[id]
POST /api/claims/[id]/verify              POST /api/claims/[id]/decision
GET|POST /api/handovers                   POST /api/handovers/[id]/complete
GET  /api/notifications                   POST /api/matches/[id]
GET  /api/admin/reports|queue             GET|PATCH /api/admin/settings
GET|POST /api/admin/categories            PATCH|DELETE /api/admin/categories/[id]
GET|POST /api/admin/locations             PATCH|DELETE /api/admin/locations/[id]
GET  /api/admin/users                     PATCH /api/admin/users/[id]
POST /api/admin/ageing                    POST /api/admin/matches/refresh
POST /api/admin/items/[id]/dispose
```

## Tests

`npm test` runs the suite serially against a dedicated in-memory MongoDB:

- `redaction.test.ts` — exhaustive: every public projection is walked and
  checked against known private ciphertexts and forbidden keys (the core
  privacy guarantee).
- `verification.test.ts` — challenge creation, correct/wrong answers, attempt
  burn-down.
- `claims.test.ts` — competing claims, auto-rejection of losers, permissions.
- `handover.test.ts` — OTP delivery only to the claimant, wrong-OTP handling,
  proof photo requirement, custody chain visibility.
- `ageing.test.ts`, `matching.test.ts`, `auth.test.ts` — remaining rules.

Route handlers are invoked in-process through a dispatcher
(`tests/helpers.ts`), so no HTTP server is needed to test them.

## Project layout

```
src/app            pages + api route handlers (handlers only, no business logic)
src/lib            business logic: claims, custody, matching, settings, auth…
src/models         document types, collections, indexes
src/components     AppShell, BoardGrid, ItemCard
scripts            seed / refresh-matches / ageing
tests              vitest suite
docs/SECURITY.md   public-vs-private field statement (redaction contract)
```
