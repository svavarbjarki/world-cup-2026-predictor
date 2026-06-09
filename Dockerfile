# syntax=docker/dockerfile:1
#
# The Next.js app lives in the wc2026-predictor/ subdirectory, so this Dockerfile
# is built with the repository ROOT as the build context:
#   docker build -t wc2026 .
#
# Runtime env vars to provide (see wc2026-predictor/.env.example):
#   SHARED_PASSWORD, ADMIN_PASSWORD, AUTH_SECRET, and optionally PORT.
# DATABASE_URL defaults to the SQLite file on the /data volume below.

FROM node:20-alpine AS base
WORKDIR /app
# Prisma's query engine on Alpine (musl) needs these.
RUN apk add --no-cache libc6-compat openssl
ENV NEXT_TELEMETRY_DISABLED=1

# --- deps: install all dependencies (dev deps are needed to build) ---
FROM base AS deps
COPY wc2026-predictor/package.json wc2026-predictor/package-lock.json ./
RUN npm ci

# --- builder: generate the Prisma client and build Next ---
FROM base AS builder
# A throwaway URL so anything that instantiates Prisma during the build has a
# valid datasource. The real database is provided at runtime.
ENV DATABASE_URL="file:/tmp/build.db"
COPY --from=deps /app/node_modules ./node_modules
COPY wc2026-predictor/ ./
RUN npx prisma generate
RUN npm run build

# --- runner: production image ---
FROM base AS runner
ENV NODE_ENV=production
# SQLite database on a persistent volume. Override DATABASE_URL to relocate it.
ENV DATABASE_URL="file:/data/prod.db"
RUN mkdir -p /data
VOLUME ["/data"]

# Copy the whole built app. This keeps the Prisma CLI, tsx, and the seed source
# files available at runtime so the entrypoint can run migrate deploy + db seed.
COPY --from=builder /app ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
