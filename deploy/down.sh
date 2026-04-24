#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose -p mashina-prod -f docker-compose.deploy.yml down
docker compose -p mashina-dev  -f docker-compose.deploy.yml down

echo "Stopped prod+dev."

