# Waiver Wire Wizards

The league hub for Waiver Wire Wizards — rules, scoring, weekly challenges, and FAAB
tracking, built to replace the static rulebook PDF with something the commissioner can
update in real time.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io) + SQLite for local dev (swap the `DATABASE_URL` for
  Postgres/Turso/etc. in production — see below)
- A single password-protected `/admin` panel (no user accounts) for the commissioner to
  edit weekly challenge winners, FAAB moves, buy-in status, and the draft order note

## Pages

| Route          | Purpose                                                             |
| -------------- | -------------------------------------------------------------------- |
| `/`            | Overview — buy-in, payouts, FAAB budget, quick links                |
| `/rules`       | Full static rulebook: roster slots + every scoring category         |
| `/challenges`  | 14-week challenge schedule with live winners, plus tiebreakers      |
| `/faab`        | Per-team FAAB budgets, buy-in/playoff paid status, recent moves     |
| `/draft`       | Stub page — shows a placeholder note until the draft order is set   |
| `/admin`       | Commissioner-only dashboard to edit all of the above                |
| `/admin/login` | Password gate for `/admin`                                          |

## Getting started

```bash
npm install
npx prisma migrate dev # creates prisma/dev.db and applies the schema
npm run db:seed        # loads the 14 weekly challenges + 10 placeholder teams
npm run dev
```

Visit http://localhost:3000. Log into `/admin` with the password from `ADMIN_PASSWORD`
in your `.env` (defaults to `change-me-wizards` — **change this before sharing the site
with anyone**).

### Environment variables (`.env`)

```
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD="change-me-wizards"
SESSION_SECRET="dev-only-secret-please-change"
```

- `ADMIN_PASSWORD` — the single shared password for the commissioner admin panel.
- `SESSION_SECRET` — random string used to sign the admin session cookie. Change it to
  a long random value before deploying.

### First-time setup after seeding

The seed script creates 10 placeholder teams ("Team 1"..."Team 10") with `TBD` owners.
Go to `/admin` and rename them to your actual league's teams/owners before sharing the
site — the FAAB tracker and challenge-winner dropdowns pull from this list.

## Deploying

This app needs a persistent server (not a static host) because of the SQLite database
and admin session cookie. [Vercel](https://vercel.com) works well:

1. Swap SQLite for a hosted database — [Turso](https://turso.tech) (SQLite-compatible)
   or [Vercel Postgres](https://vercel.com/storage/postgres) are the easiest options.
   Update `datasource db` in `prisma/schema.prisma` if you switch providers, and run
   `npx prisma migrate deploy` against the hosted database.
2. Set `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` as environment variables
   in your host's dashboard (use a strong random value for `SESSION_SECRET`).
3. Deploy. `npm run build` / `npm run start` are the standard Next.js production
   scripts.

## Updating the rulebook content

The scoring tables and roster rules on `/rules` are static (they rarely change
mid-season) and live in [`lib/rulesData.ts`](lib/rulesData.ts). Edit that file and
redeploy if league rules change. Everything else (challenge winners, FAAB, buy-in
status, draft order note) is edited live through `/admin`.
