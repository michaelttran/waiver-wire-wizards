# Waiver Wire Wizards

The league hub for Waiver Wire Wizards — rules, scoring, weekly challenges, and FAAB
tracking, built to replace the static rulebook PDF with something the commissioner can
update in real time.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io) + [Supabase](https://supabase.com) Postgres, via the
  Wasm `@prisma/adapter-pg` driver adapter rather than Prisma's native binary query
  engine (see Deploying below for why)
- Deployed on [Vercel](https://vercel.com), including a daily [Vercel Cron](https://vercel.com/docs/cron-jobs)
  job that syncs teams/rosters/draft results from Sleeper
- Player grades pulled live from a linked Google Sheet (public CSV export, no API key)
- A single password-protected `/admin` panel (no user accounts) for the commissioner to
  edit weekly challenge winners, FAAB moves, buy-in status, the draft order note, and to
  manually trigger a Sleeper sync

## Pages

| Route          | Purpose                                                             |
| -------------- | -------------------------------------------------------------------- |
| `/`            | Overview — buy-in, payouts, FAAB budget, quick links                |
| `/rules`       | Full static rulebook: roster slots + every scoring category         |
| `/teams`       | Every team's current roster (synced from Sleeper), with per-player and per-team grades |
| `/challenges`  | 14-week challenge schedule with live winners, plus tiebreakers      |
| `/faab`        | Per-team FAAB budgets, buy-in/playoff paid status, recent moves     |
| `/draft`       | Draft order + full round-by-round draft results board              |
| `/punishments` | Proposed punishments for whoever finishes last of the toilet bowl   |
| `/data`        | Link to the Google Sheet that powers the grades shown on `/teams`   |
| `/admin`       | Commissioner-only dashboard to edit all of the above                |
| `/admin/login` | Password gate for `/admin`                                          |

## Getting started

Create a [Supabase](https://supabase.com) project (free tier is fine), then copy
`.env.example` to `.env` and fill in its two connection strings from your project's
**Settings > Database** page — `DATABASE_URL` is the pooled connection (port 6543,
`?pgbouncer=true`) that the app queries with at runtime, and `DIRECT_URL` is the direct
connection (port 5432) Prisma needs to run migrations.

```bash
npm install
npx prisma migrate deploy # applies the schema to your Supabase database
npm run db:seed           # loads the 14 weekly challenges + placeholder teams
npm run dev
```

Visit http://localhost:3000. Log into `/admin` with the password from `ADMIN_PASSWORD`
in your `.env` (defaults to `change-me-wizards` — **change this before sharing the site
with anyone**).

### Environment variables (`.env`)

See [`.env.example`](.env.example) for the full list with descriptions. In short:

- `DATABASE_URL` / `DIRECT_URL` — Supabase Postgres connection strings (pooled / direct).
- `ADMIN_PASSWORD` — the single shared password for the commissioner admin panel.
- `SESSION_SECRET` — random string used to sign the admin session cookie. Change it to
  a long random value before deploying.
- `SLEEPER_LEAGUE_ID` — optional; enables `npm run sync:sleeper`, the "Sync from
  Sleeper" button on `/admin`, and the daily cron to pull real teams/draft results/rosters
  from a Sleeper league.
- `CRON_SECRET` — optional; secures the daily `/api/cron/sleeper-sync` endpoint that
  Vercel Cron hits (see Deploying below). Not needed for local dev.
- `PLAYER_GRADES_SHEET_URL` — optional; a Google Sheet link (the normal "Share" link)
  with a "Player Grades" tab, used to grade rostered players on `/teams` and linked from
  `/data`. The sheet must be shared as "Anyone with the link" can view.

### First-time setup after seeding

The seed script creates 10 placeholder teams ("Team 1"..."Team 10") with `TBD` owners.
Go to `/admin` and rename them to your actual league's teams/owners before sharing the
site — the FAAB tracker and challenge-winner dropdowns pull from this list.

## Deploying

1. Create a Supabase project if you haven't already, and run
   `npx prisma migrate deploy` against it once (from your machine, with `.env` pointed
   at that project) to create the schema.
2. In your Vercel project settings, add `DATABASE_URL`, `DIRECT_URL`, `ADMIN_PASSWORD`,
   `SESSION_SECRET`, and (optionally) `SLEEPER_LEAGUE_ID`, `CRON_SECRET`, and
   `PLAYER_GRADES_SHEET_URL` as environment variables — use a strong random value for
   `SESSION_SECRET` and `CRON_SECRET`, both generated with `openssl rand -hex 32`.
3. Deploy. `npm install` runs `prisma generate` automatically via the `postinstall`
   script, so no extra build configuration is needed on Vercel's end. [`vercel.json`](vercel.json)
   defines a daily Vercel Cron job (`/api/cron/sleeper-sync`) that Vercel picks up
   automatically on deploy — once `CRON_SECRET` is set, Vercel sends it as the
   `Authorization: Bearer <value>` header the route checks, so nobody else can trigger it.
4. Future schema changes: run `npx prisma migrate dev` locally against a dev database to
   create the migration, commit the generated `prisma/migrations/` folder, then run
   `npx prisma migrate deploy` against the production Supabase project before or after
   deploying the code that depends on it. Vercel does not run migrations automatically.

### Why a driver adapter instead of Prisma's default engine

Prisma's schema (`generator client`) sets `engineType = "client"`, and
[`lib/prisma.ts`](lib/prisma.ts) constructs the client with a `@prisma/adapter-pg`
adapter instead of a plain connection string. This is deliberate, not incidental —
Prisma's default setup ships a native Rust query engine binary (`libquery_engine-*.so.node`)
alongside the generated client, and that binary reliably failed to survive Vercel's
serverless bundling for this project's custom generator `output` path (`app/generated/prisma`
instead of the default `node_modules/@prisma/client`), surfacing as
`PrismaClientInitializationError: ... could not locate the Query Engine for runtime
"rhel-openssl-3.0.x"` — a well-documented Prisma+Vercel+custom-output issue. `binaryTargets`
and Next's `outputFileTracingIncludes` are the commonly suggested workarounds, but didn't
resolve it here even after confirming the binary was correctly traced into the build
output. The driver adapter sidesteps the whole problem: `engineType = "client"` compiles
queries in pure TypeScript with no native binary or Wasm file at all (verified — `prisma
generate` produces only `.ts` files under `app/generated/prisma`), so there's nothing for
Vercel's bundler to lose track of. If you ever regenerate `lib/prisma.ts` from a Prisma
example/template, keep the adapter — reverting to `new PrismaClient()` alone will
reintroduce this failure on deploy even though it works fine locally.

## Updating the rulebook content

The scoring tables and roster rules on `/rules` are static (they rarely change
mid-season) and live in [`lib/rulesData.ts`](lib/rulesData.ts). Edit that file and
redeploy if league rules change. Everything else (challenge winners, FAAB, buy-in
status, draft order note) is edited live through `/admin`.

## Teams, rosters & player grades

`/teams` shows who owns which players, plus a grade for every graded player and an
overall grade per team. This combines two independent data sources:

- **Rosters, teams, and draft results** ([`lib/sleeper.ts`](lib/sleeper.ts)) come from
  the Sleeper API and are stored in Postgres (`Team`, `DraftPick`, `RosterPlayer`). This
  data only updates when a sync runs — automatically once a day via the Vercel Cron job
  in [`vercel.json`](vercel.json) (`app/api/cron/sleeper-sync/route.ts`), or immediately
  via the "Sync from Sleeper" button on `/admin`. A roster move made on Sleeper (waiver,
  trade, etc.) won't show up on `/teams` until one of those two things runs.
- **Player grades** ([`lib/playerGrades.ts`](lib/playerGrades.ts)) are read live from the
  "Player Grades" tab of the Google Sheet at `PLAYER_GRADES_SHEET_URL`, fetched as a
  public CSV export (no API key or auth needed — the sheet just needs to be shared as
  "Anyone with the link" can view). Columns are read by header name, not position, since
  the sheet is actively edited and has already been reshuffled once. The fetch is cached
  for up to an hour via `unstable_cache` — independent of the page's own rendering, since
  every page in this app sets `revalidate = 0` (fully dynamic), which would otherwise
  force a live Google Sheets round-trip on every single page view. The sheet only grades
  RB/WR/TE, so QB/K/DEF (and any player the sheet doesn't cover) render without a grade.
  The per-team grade is the average score of that team's graded players, converted to a
  letter using the sheet's own "Cutoff → Grade" legend (read dynamically, not hardcoded,
  so it can't drift out of sync with the sheet).

Rostered players are matched to sheet rows by normalized name only (accents/punctuation/
suffixes stripped, case-insensitive) — there's no shared ID between Sleeper and the
sheet. This is reliable in practice but not bulletproof: a rare exact-name collision
between two active NFL players could grab the wrong grade.

## Security

- **Admin auth** — a single shared password (`ADMIN_PASSWORD`) gates `/admin`. On
  success, an HMAC-signed, `httpOnly`/`secure`/`sameSite=lax` session cookie is issued
  (see [`lib/auth.ts`](lib/auth.ts)); password and signature checks both use
  `crypto.timingSafeEqual` to avoid timing attacks. There are no other accounts, tokens,
  or roles.
- **Cron auth** — `/api/cron/sleeper-sync` checks the `Authorization: Bearer <value>`
  header against `CRON_SECRET` before running a sync, so only Vercel's own cron invocation
  (which Vercel sends that header for automatically once the env var is set) can trigger
  it — anyone else hitting the URL gets a 401.
- **Rate limiting** — [`lib/rateLimit.ts`](lib/rateLimit.ts) implements a sliding-window
  limiter backed by the database (so it holds up across Vercel's independent serverless
  instances, unlike an in-memory counter). It's applied to:
  - `/admin/login` — 5 attempts per 15 minutes per IP, to slow down password guessing.
  - The Sleeper sync action — 3 per minute (global), so a mis-click or double-submit
    can't hammer Sleeper's API or churn the database.

  Every other mutation (teams, FAAB, challenge winners, draft picks) already requires an
  authenticated admin session, so it isn't separately rate-limited.
- **Security headers** — set globally in `next.config.ts`: `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY` (blocks the login page from being framed for
  clickjacking), `Referrer-Policy: strict-origin-when-cross-origin`, and a
  `Permissions-Policy` that disables camera/microphone/geolocation. There's no
  Content-Security-Policy yet — adding one is worth doing but needs care to avoid
  breaking Next's inline scripts/styles and Google Fonts, so it wasn't rushed in here.
- **Dependencies** — `npm audit` is clean. The one finding at the time of writing
  (`deepmerge-ts` < 8.0.0, pulled in transitively by `@prisma/config`, used only by the
  Prisma CLI at build/dev time — not part of the deployed app) is pinned to a patched
  version via `overrides` in `package.json` rather than downgrading Prisma itself.
- **Secrets** — `ADMIN_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET`, `DATABASE_URL`/
  `DIRECT_URL`, and the local HTTPS dev certificate (`/certificates`) are all gitignored.
  Change the default `ADMIN_PASSWORD` and generate real `SESSION_SECRET`/`CRON_SECRET`
  values before sharing the site with anyone (see Environment variables above).
  `PLAYER_GRADES_SHEET_URL` isn't sensitive — it only works unauthenticated because the
  sheet is link-shared as view-only.
