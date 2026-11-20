#!/bin/sh
set -eu
cd /workspace

case "${1:-migrate}" in
  migrate)
    exec pnpm --filter @filaretti/api db:migrate
    ;;
  seed-production)
    exec pnpm --filter @filaretti/api db:seed:production
    ;;
  provision-admin)
    # The existing provisioner requires a password on stdin and validates it.
    exec pnpm --filter @filaretti/api db:provision-admin
    ;;
  import-staging)
    exec node scripts/vps-import-staging.mjs --snapshot /snapshot/tables.json
    ;;
  *)
    printf '%s\n' 'Expected migrate, seed-production, provision-admin, or import-staging.' >&2
    exit 64
    ;;
esac
