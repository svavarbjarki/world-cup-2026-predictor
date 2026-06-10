#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Checking if database is already seeded..."

# Check if any teams exist
TEAM_COUNT=$(sqlite3 /data/prod.db "SELECT COUNT(*) FROM Team;" 2>/dev/null || echo 0)

if [ "$TEAM_COUNT" -eq "0" ]; then
  echo "Database empty → seeding..."
  npx prisma db seed
else
  echo "Database already seeded → skipping seed"
fi

echo "Starting Next.js..."
exec npm run start