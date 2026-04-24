#!/usr/bin/env bash
# Full Mashinalar prod+dev update on VPS (paths/ports as on server).
set -euo pipefail

cd /opt/mashina-prod && git pull origin main

cd /opt/mashina-prod/api
rm -rf node_modules
npm ci
npx prisma generate
npm run build
# Skip if DB was created with db push / non-empty without migration history (P3005).
npx prisma migrate deploy || echo "WARN: prisma migrate deploy skipped (see P3005 baseline docs)"

cd /opt/mashina-prod/admin
npm ci
VITE_API_URL=/api npm run build

cd /opt/mashina-dev && git pull origin main

cd /opt/mashina-dev/api
rm -rf node_modules
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy || echo "WARN: prisma migrate deploy skipped on dev"

# Same admin bundle for both hosts (relative /api); avoids dev admin lockfile drift.
rsync -a --delete /opt/mashina-prod/admin/dist/ /opt/mashina-dev/admin/dist/

pm2 restart mashina-api-prod mashina-api-dev
echo "DONE"
