# World Cup 2026 Predictor (app)

This directory holds the Next.js application. For the full project overview,
setup, environment variables, scripts, and deployment notes, see the
[root README](../README.md).

## Quick start

```bash
npm install
cp .env.example .env      # then fill in real values (do not commit .env)
npx prisma migrate dev    # create the SQLite DB and apply migrations
npx prisma db seed        # seed teams, fixtures, and award players
npm run dev
```

Open http://localhost:3000.

## Common commands

```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # production server
npm run lint    # eslint
npm test        # Vitest unit tests
```

Built with Next.js (App Router), React, TypeScript, Prisma + SQLite, and
Tailwind CSS.
