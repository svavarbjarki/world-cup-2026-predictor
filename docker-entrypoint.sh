#!/bin/sh
set -e

# The SQLite database MUST live on a persistent Northflank volume mounted at the
# directory in DATABASE_URL (default file:/data/prod.db). If it does not, every
# deploy starts with an empty database and all users and predictions are lost.

echo "DATABASE_URL=${DATABASE_URL}"
echo "Applying database migrations..."
npx prisma migrate deploy

# Seed only reference data (teams, fixtures, award players) and only when it is
# missing. The seed is idempotent and never touches users or predictions, so this
# is safe. We count via Prisma because sqlite3 is not installed in the image, and
# we force CommonJS so it works regardless of the project's module type. Any error
# (for example a brand new database) falls back to 0 so the seed runs.
echo "Checking if reference data needs seeding..."
TEAM_COUNT=$(node --input-type=commonjs -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.team.count().then(async n=>{process.stdout.write(String(n));await p.\$disconnect();}).catch(async()=>{process.stdout.write('0');try{await p.\$disconnect();}catch(e){}});" 2>/dev/null || echo 0)

if [ "$TEAM_COUNT" = "0" ]; then
  echo "No reference data found -> running seed..."
  npx prisma db seed
else
  echo "Reference data present ($TEAM_COUNT teams) -> skipping seed"
fi

echo "Starting Next.js..."
exec npm run start
