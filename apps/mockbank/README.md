# FinCore Teller (mockbank)

A zero-dependency **mock back-office banking console** — the "FinCore Teller
(proxy)" target that the computer-use engine (`apps/engine`) discovers,
records, and replays capabilities against (decision D-040 in
`context/thought-process.md`). It is demo infrastructure, not the product:
real targets are legacy third-party apps; this app exists so evidence runs are
local, reproducible, and free of credentials, PII, and terms-of-service
exposure.

Everything is TypeScript + Hono (`@hono/node-server`) + server-rendered HTML + one inline
vanilla-JS confirm dialog. The target stays deliberately small and local; Hono
keeps the route surface explicit without changing the legacy UI.

## Run

```sh
pnpm --filter mockbank dev        # tsx watch src/server.ts
# listening on http://127.0.0.1:4010
```

Environment variables (all optional):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4010` | Listen port (binds `127.0.0.1` by default). |
| `MOCKBANK_HOST` | `127.0.0.1` | Bind host override; keep localhost for evidence runs. |
| `SESSION_TTL_MS` | `300000` (5 min) | Inactivity timeout before sessions expire. |
| `MOCKBANK_NO_DELAY` | unset | Set to `1` to disable the artificial latency (dev loops only; evidence runs should keep it on). |

Sign in with **any** username/password — it is a mock.

## Reset endpoint

`POST /__reset__` reseeds all members, accounts, and cards from the
deterministic seed, drops every session, and restarts the account-number and
confirmation-number counters. Call it before each evidence run:

```sh
curl -X POST http://127.0.0.1:4010/__reset__
```

New sub-accounts are numbered from `7100070001`, confirmation numbers from
`CNF-5001`; both restart at those values after every reset.

## Seed members

| Member ID | Name | Address | Accounts (type / number / balance) | Cards (last4 / status) |
| --- | --- | --- | --- | --- |
| 100231 | Margaret Ellison | 412 Birchwood Lane, Dayton, OH 45419 | savings 7100041201 $12,480.55 "Rainy day"; checking 7100041202 $1,204.10 | 4412 Active |
| 100774 | Deshawn Carter | 88 Fulton Street Apt 5B, Brooklyn, NY 11217 | checking 7100044401 $843.22; savings 7100044402 $5,900.00 "Vacation"; money-market 7100044403 $25,340.75 | 8801 Active; 9034 Frozen (stolen) |
| 101045 | Priya Raman | 2300 Guadalupe Street, Austin, TX 78705 | savings 7100047701 $3,412.89; checking 7100047702 $915.40 | 2255 Active |
| 102388 | Tom Kowalski | 17 Harbor View Drive, Duluth, MN 55802 | checking 7100051101 $19,002.44; savings 7100051102 $730.00 | 6630 Active; 1188 Active |
| 103520 | Lucia Fernandez | 502 Desert Willow Court, Tucson, AZ 85719 | savings 7100058801 $8,977.31 "House fund"; money-market 7100058802 $41,200.00 | 3456 Active |
| 104816 | Aaron Blake | 9 Chestnut Street, Burlington, VT 05401 | checking 7100062301 $156.78; savings 7100062302 $2,480.00 | 7789 Frozen (lost) |
| 105293 | Grace Nakamura | 1313 Mockingbird Lane, Portland, OR 97205 | savings 7100065601 $2,050.00; checking 7100065602 $4,321.65; money-market 7100065603 $10,000.00 "Emergency" | 5510 Active |

All data is fictional. Search matches on exact member ID or case-insensitive
name substring. Any ID outside the seed list (e.g. anything starting with
`0`) returns the **No member found** page — a business outcome, not an error
(HTTP 200).

## Workflows (the three catalog capabilities)

1. **Look up member balances** (`lookup_member_balance`):
   `POST /login` → `GET /dashboard` → `GET /search/results?q=<id-or-name>` →
   `GET /members/<id>` (name, address, accounts table with balances, cards
   with status).
2. **Open a sub-account** (`open_sub_account`):
   `GET /members/<id>/accounts/new` → `POST /members/<id>/accounts/review`
   (accountType `savings|checking|money-market`, initialDeposit, optional
   nickname) → review page with a browser-native `window.confirm` dialog **and**
   an "I confirm" checkbox → `POST /members/<id>/accounts` → redirect to
   `GET /members/<id>/accounts/<accountNumber>/confirmation?c=CNF-####`.
   Server-side validation: deposit must be a number >= 0, type must be valid;
   invalid input re-renders the form with an error message (HTTP 200, classic
   legacy behavior). A missing checkbox re-renders the review with an error.
3. **Freeze a debit card** (`freeze_card`):
   `GET /members/<id>/cards/<last4>/freeze` → reason select
   (`lost|stolen|fraud-suspected|member-request`) → `POST` same URL →
   redirect to `GET /members/<id>?notice=...` where the card reads
   `Frozen (<reason>)`. Freezing an already-Frozen card shows
   **"Card is already frozen"** (business outcome, HTTP 200, no changes).

Other routes: `GET /login`, `GET /logout`, `GET /session-expired`, `GET /`
(redirects to `/dashboard`), `GET /favicon.ico` (204), `POST /__reset__`.

## Deliberate hostility (the point of the exercise — D-040)

Replay must survive all of the following:

- **Legacy markup.** Deeply nested `<table>` layouts, generic class names
  (`tbl`, `row`, `cell`), presentational attributes (`border`, `cellpadding`).
- **No automation hooks.** No `id` attributes anywhere, no `data-*`
  attributes, no test IDs, no ARIA roles. Interactive elements are real
  `<a>`, `<button>`, `<input>`, `<select>`, and `<label>` tags, so
  accessibility-tree locators (role + name) still work.
- **Transient slowness.** Every request sleeps a random 50–400 ms;
  `GET /search/results` sleeps 1–2 s.
- **Transient 500.** Per session, every 7th `GET` (any page) returns
  HTTP 500 "Core system unavailable — try again" and recovers on retry. The
  counter is per session and deterministic (GETs 7, 14, 21, …), starts at
  login, and resets with `/__reset__`, so evidence runs can rely on it.
  Unauthenticated requests and `POST`s are never affected.
- **Session timeout.** Sessions expire after 5 minutes of inactivity
  (`SESSION_TTL_MS`); any further page redirects to `/session-expired` with a
  "Log in again" link.
- **A real confirmation dialog.** The sub-account review page gates submit on
  a browser-native `window.confirm()` plus an "I confirm" checkbox — the
  driver must accept the dialog *and* tick the box.
- **Business outcomes instead of errors.** Unknown member search → "No member
  found" (HTTP 200); already-frozen card → "Card is already frozen"
  (HTTP 200); invalid form input → the form re-renders with an error message
  (HTTP 200).
