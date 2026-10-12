#!/usr/bin/env bash
# Replace every person's email, name and handle in staging's copy of production
# with random ones (scripts/staging-anonymize.sql), after the credential scrub
# (scripts/staging-scrub.sql). A dry run, rolled back, unless --apply.
# Hardcoded to the staging container: production's database has the same name,
# so nothing but the container tells them apart.
#
#   scripts/staging-anonymize.sh            # dry run: counts, then rollback
#   scripts/staging-anonymize.sh --apply
#
# Addresses in .env.staging's ADMIN_EMAILS, and KEEP_EMAILS (comma-separated),
# are left alone, so staging's admin can still sign in.
set -euo pipefail
cd "$(dirname "$0")"
container=acceptodds-staging-postgres-1
project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$container")
if [ "$project" != acceptodds-staging ]; then
  echo "refusing: $container belongs to compose project '$project', not acceptodds-staging" >&2
  exit 1
fi

apply=false
[ "${1:-}" = --apply ] && apply=true

admins=$(sed -n 's/^ADMIN_EMAILS=//p' ../.env.staging 2>/dev/null | tr -d "\"' ")
keep=$(printf '%s,%s' "$admins" "${KEEP_EMAILS:-}" | tr -d ' ' | tr '[:upper:]' '[:lower:]' | sed 's/,,*/,/g; s/^,//; s/,$//')
echo "keeping: ${keep:-nobody}"

psql() { docker exec -i "$container" sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' psql "$@"; }
if $apply; then
  psql < staging-scrub.sql
fi
psql -v apply="$apply" -v keep="$keep" < staging-anonymize.sql
