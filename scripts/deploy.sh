#!/usr/bin/env bash
# Deploys to Vercel production. Needs VERCEL_TOKEN (vercel.com/account/tokens) and DATABASE_URL_NEON in .env.local.
# Uses the Node-based CLI (v48): the native v65 binary can't reach the network from some sandboxes.
set -euo pipefail
: "${VERCEL_TOKEN:?Set VERCEL_TOKEN first}"
V="npx --yes vercel@48 --token $VERCEL_TOKEN"
export VERCEL_TELEMETRY_DISABLED=1
$V link --yes --project kinetic-studio >/dev/null
url=$(grep '^DATABASE_URL_NEON=' .env.local | cut -d= -f2- || true)
if [ -n "$url" ]; then
  $V env rm DATABASE_URL production --yes >/dev/null 2>&1 || true
  printf '%s' "$url" | $V env add DATABASE_URL production >/dev/null
  echo "DATABASE_URL set on Vercel (production)"
fi
for k in ANTHROPIC_API_KEY FAL_KEY; do
  v=$(grep "^$k=" .env.local 2>/dev/null | cut -d= -f2- || true)
  [ -n "$v" ] && { $V env rm $k production --yes >/dev/null 2>&1 || true; printf '%s' "$v" | $V env add $k production >/dev/null; }
done
$V deploy --prod --yes
