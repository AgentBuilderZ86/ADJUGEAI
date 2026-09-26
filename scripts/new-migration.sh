#!/usr/bin/env bash
# Crée une migration Netlify Database à partir de l'écart entre prisma/schema.prisma et une base
# sur laquelle toutes les migrations existantes sont appliquées (npm run db:apply).
# Usage : DATABASE_URL=... npm run db:migration -- nom-de-la-migration
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL requis}"
nom="${1:?nom de migration requis (minuscules, chiffres, tirets)}"
[[ "$nom" =~ ^[a-z0-9-]+$ ]] || { echo "Nom invalide : minuscules, chiffres et tirets uniquement"; exit 1; }
sql=$(npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script)
if [[ -z "$(grep -v '^--' <<<"$sql" | tr -d '[:space:]')" ]]; then
  echo "Aucun changement de schéma."; exit 0
fi
dossier="netlify/database/migrations/$(date -u +%Y%m%d%H%M%S)_${nom}"
mkdir -p "$dossier"
printf '%s\n' "$sql" > "$dossier/migration.sql"
echo "Créée : $dossier/migration.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$dossier/migration.sql"
echo "Appliquée à la base locale."
