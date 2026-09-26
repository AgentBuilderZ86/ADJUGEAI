#!/usr/bin/env bash
# Applique les migrations Netlify Database dans l'ordre, comme le fait Netlify au déploiement.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL requis}"
for f in $(ls -d netlify/database/migrations/*/ | sort); do
  echo "→ ${f}"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "${f}migration.sql"
done
