#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose -p mashina-prod --env-file deploy/prod.env -f docker-compose.deploy.yml up -d --build
docker compose -p mashina-dev  --env-file deploy/dev.env  -f docker-compose.deploy.yml up -d --build

echo "OK: prod -> http://127.0.0.1:18080 , dev -> http://127.0.0.1:28080"

