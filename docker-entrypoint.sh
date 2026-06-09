#!/bin/sh
# Container startup: bring the SQLite database up to date, ensure the fixed
# reference data exists (idempotent), then start the server. Both Prisma steps
# read DATABASE_URL from the environment.
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Seeding reference data (idempotent)..."
npx prisma db seed

echo "Starting Next.js..."
exec npm run start
