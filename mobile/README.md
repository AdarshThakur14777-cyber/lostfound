# Campus Lost & Found - Android app (Expo / React Native)

Full-parity mobile client for the campus lost-and-found platform: browse the
redacted board, report lost/found items with photos, open and verify claims,
complete supervised handovers, and run the security/admin operations screens.

## Prerequisites

- Node.js 20+ and the repo's web API running (see the root `README.md`):

  ```bash
  cd ..            # repo root
  npm run seed
  npm run dev      # http://localhost:3000
  ```

- One of:
  - **Expo Go** on your Android phone (fastest - no SDK needed)
  - **Android emulator** (requires Android Studio / SDK)
  - **Dev build**: `npx expo run:android` (requires Android Studio + SDK)
  - **APK in the cloud**: `eas build -p android --profile preview` (Expo account)

## Run it

```bash
cd mobile
npm install
npm start          # Metro bundler + QR code for Expo Go
```

Then point the app at your API (the app remembers it):

| Where the API runs          | Base URL to enter on the **Me** tab |
| --------------------------- | ----------------------------------- |
| Android emulator            | `http://10.0.2.2:3000` (default)    |
| Phone + PC on the same Wi-Fi| `http://<your-PC-LAN-IP>:3000`      |
| iOS simulator               | `http://localhost:3000` (default)   |

You can also bake the URL in with an env var: `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 npm start`.

Demo accounts (password `Demo1234!`): `student@demo.local`,
`security@demo.local`, `admin@demo.local`, ...

## Scripts

| Command                     | What it does                                   |
| --------------------------- | ---------------------------------------------- |
| `npm start`                 | Start Metro (scan QR with Expo Go)             |
| `npm run android`           | Start Metro and launch an Android emulator     |
| `npm run typecheck`         | `tsc --noEmit`                                 |
| `npm run export:android`    | Produce a standalone Android JS bundle (CI check) |
| `npx expo run:android`      | Native debug build (needs Android Studio)      |
| `eas build -p android`      | Cloud-built APK/AAB (needs `eas-cli` + login)  |

## How it talks to the API

- **Auth**: `POST /api/auth/login` returns `{ user, token }`; the token is a
  JWT stored in the Android Keystore (`expo-secure-store`) and sent as
  `Authorization: Bearer <token>`. The web app keeps using its HttpOnly cookie,
  so both clients share one backend.
- **Uploads**: photos are picked with `expo-image-picker`, uploaded to
  `POST /api/uploads` as multipart form data; the server re-encodes them with
  sharp, stripping EXIF/GPS, and returns public paths.
- **Redaction**: the app only ever renders the public projection the API
  returns - private owner questions and answers never leave the server except
  as decrypted questions during an active verification challenge.
- **Handover OTP**: delivered only to the claimant's in-app notifications;
  the security officer types the code the claimant reads out.

## Screens

| Screen            | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| Login/Register    | Session creation, role selection (student/staff)                   |
| Board             | Search + category/location/status filters, cursor pagination       |
| Item detail       | Photos, attributes, custody chain, claim button, match review      |
| Report            | Lost/found form, category attributes, photo upload, secret Q&A     |
| Claim create      | "This is mine" note                                                |
| Claim detail      | Verification challenge, security decision, OTP/signature handover  |
| Me                | Profile, my claims, my reports, notifications, server URL, logout  |
| Notifications     | Claim/handover/ageing alerts, mark all read, deep links            |
| Operations        | Verification queue, handovers, ageing, disposal, custody inventory |
| Admin             | Analytics, settings, users, categories/locations                   |

Staff tabs appear only for the matching role (Operations: security+,
Admin: admin/sysadmin).

## Project layout

```
App.tsx                 providers + root navigator
src/api/client.ts       fetch wrapper, bearer token, base URL, uploads
src/api/types.ts        DTOs mirroring the server responses
src/state/              AuthContext, useAsync data hook
src/navigation/         tabs + stack, route param lists
src/components/         ui primitives, pickers, photo strip, item card
src/screens/            one file per screen
```

## Verifying a change

```bash
npm run typecheck        # must be clean
npm run export:android   # bundles the app for Android (catches import errors)
```
