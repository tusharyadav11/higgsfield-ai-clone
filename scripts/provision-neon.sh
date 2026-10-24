#!/usr/bin/env bash
# Creates a Neon Postgres project and writes DATABASE_URL to .env.local (git-ignored), then migrates.
# Needs: NEON_API_KEY (console.neon.tech → Account settings → API keys). Never echoes the connection string.
set -euo pipefail
: "${NEON_API_KEY:?Set NEON_API_KEY first}"
NAME="${NEON_PROJECT_NAME:-kinetic}"
REGION="${NEON_REGION:-aws-us-east-2}"
res=$(curl -sS -f -X POST https://console.neon.tech/api/v2/projects \
  -H "Authorization: Bearer $NEON_API_KEY" -H 'Content-Type: application/json' \
  -d "{\"project\":{\"name\":\"$NAME\",\"region_id\":\"$REGION\"}}")
url=$(printf '%s' "$res" | jq -r '.connection_uris[0].connection_uri')
[ -n "$url" ] && [ "$url" != null ] || { echo "Neon did not return a connection string"; exit 1; }
touch .env.local; grep -v '^DATABASE_URL_NEON=' .env.local > .env.local.tmp || true
{ cat .env.local.tmp; echo "DATABASE_URL_NEON=$url"; } > .env.local; rm -f .env.local.tmp
DATABASE_URL="$url" npx drizzle-kit migrate
DATABASE_URL="$url" node -e "require('postgres')(process.env.DATABASE_URL).unsafe('select count(*) from users').then(r=>{console.log('Neon OK, users =',r[0].count);process.exit(0)})"
echo "Saved as DATABASE_URL_NEON in .env.local (local DATABASE_URL untouched). Next: scripts/deploy.sh"
