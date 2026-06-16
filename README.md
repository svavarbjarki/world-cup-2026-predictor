# World Cup 2026 Predictor

A small web app for a group of friends to predict the 2026 FIFA World Cup and
compete on a points leaderboard. Players predict group-stage scorelines, fill in
a knockout bracket, and pick the tournament awards. An organizer enters the real
results, and the app scores everyone on the fly.

Built mobile-first, since everyone uses it on their phones.

## Features

- Group-stage scoreline predictions for all 72 group matches.
- Knockout bracket predictions seeded from the real Round of 32.
- Award predictions (winner, Golden Ball, Golden Boot, Golden Glove, Young Player).
- Live leaderboard with per-phase points, computed on the fly from results.
- Front page highlights: next/recent matches, predicted champions, a champion-pick
  ticker, a "perfect score" shoutout, and leaderboard movement arrows after each
  new result.
- Per-phase prediction privacy: you only see others' picks for a phase once you
  have submitted your own.
- Organizer admin area to enter the Round of 32, real results, and award winners.

## Tech stack

- Next.js 16 (App Router) and React 19, TypeScript.
- Prisma 6 with SQLite (a single database file).
- Tailwind CSS 4.
- Vitest for the scoring/engine unit tests.

## Project layout

```
.
├── Dockerfile             # builds the app (build context is the repo root)
├── docker-entrypoint.sh   # runs migrations + conditional seed, then starts the app
└── wc2026-predictor/      # the Next.js application
    ├── prisma/            # schema, migrations, seed
    ├── scripts/           # one-off maintenance scripts
    └── src/               # app routes, components, engine, lib
```

The application lives in `wc2026-predictor/`. Run the commands below from inside
that directory unless noted otherwise.

## Getting started (local development)

Requires Node.js 20+.

```bash
cd wc2026-predictor
npm install

# Configure environment (see "Environment variables" below)
cp .env.example .env
# then edit .env and fill in real values

# Set up the database (creates the SQLite file, applies migrations, seeds teams/fixtures)
npx prisma migrate dev
npx prisma db seed

npm run dev
```

Open http://localhost:3000.

To use the organizer tools, go to `/admin` and enter the admin password.

## Environment variables

Copy `wc2026-predictor/.env.example` to `.env` and fill in real values. Never
commit `.env` (it is git-ignored). Do not put real secrets in this README or any
tracked file.

| Variable         | Purpose |
| ---------------- | ------- |
| `DATABASE_URL`   | SQLite connection string, e.g. `file:./dev.db` locally. In production use an absolute path on a persistent volume (see Deployment). |
| `SHARED_PASSWORD`| The single access password the organizer hands out to all players. |
| `AUTH_SECRET`    | Secret used to sign auth cookies. Generate a long random value, e.g. `openssl rand -hex 32`. |
| `ADMIN_PASSWORD` | Organizer-only password that gates the `/admin` tools. Keep it different from the shared player password. |

## How accounts work

There is no email or per-user password. Access is gated by the single
`SHARED_PASSWORD`. Each player then claims a display name and is given a one-time
**resume code** (format `XXXX-XXXX`) that lets them log back in from any device or
browser. Treat resume codes as private; the organizer can look them up in the
admin dashboard if someone loses theirs.

## Scripts

Run from `wc2026-predictor/`:

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run start   # start the production server
npm run lint    # eslint
npm test        # run the Vitest unit tests (scoring/engine)

npx prisma db seed                         # seed reference data (teams, fixtures, players)
npx tsx scripts/backfill-resume-codes.ts   # give any user missing a resume code one
```

## Database and migrations

The schema is defined in `wc2026-predictor/prisma/schema.prisma`. Seed data
(teams, the 72 group fixtures, award-contender players) lives in
`prisma/seed.ts` and is fully idempotent. The seed only writes reference data and
never touches user accounts or predictions.

Apply schema changes with a migration so they ship and deploy cleanly:

```bash
npx prisma migrate dev --name <change-name>   # create + apply locally
npx prisma migrate deploy                      # apply in production
```

## Deployment

The repository includes a `Dockerfile` (build context is the repo root) and a
`docker-entrypoint.sh` that runs `prisma migrate deploy`, seeds reference data
only when it is missing, and then starts the server.

Because the database is SQLite (a single file), the most important deployment
detail is **persistence**: the file must live on a persistent volume that
survives redeploys, and `DATABASE_URL` must point at an absolute path on that
volume. For example, mount a persistent volume at `/data` and set:

```
DATABASE_URL=file:/data/prod.db
```

If the database file is on the container's ephemeral filesystem instead, every
deploy starts from an empty database and all users and predictions are lost. Run
a single instance, since SQLite cannot be shared safely across multiple
containers.
