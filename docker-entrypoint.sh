#!/bin/sh
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Checking if database should be seeded..."

if [ -f /data/prod.db ]; then
  USER_COUNT=$(sqlite3 /data/prod.db "SELECT COUNT(*) FROM User;" 2>/dev/null || echo 0)
else
  USER_COUNT=0
fi

if [ "$USER_COUNT" -eq "0" ]; then
  echo "No users found → running seed..."
  npx prisma db seed
else
  echo "Users already exist → skipping seed"
fi

echo "Starting Next.js..."
exec npm run start