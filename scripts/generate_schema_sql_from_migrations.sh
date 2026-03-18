#!/usr/bin/env bash
set -euo pipefail

# Generate a single SQL file from supabase migrations.
# Output includes tables, functions, policies, etc. exactly as in migrations (ordered).
#
# Usage:
#   bash scripts/generate_schema_sql_from_migrations.sh
#   bash scripts/generate_schema_sql_from_migrations.sh --out schema.sql
#
# Notes:
# - Supabase SQL Editor doesn't support \i, so we concatenate into one file.
# - We do NOT wrap everything in a transaction, because some migrations may manage their own.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-"${REPO_ROOT}/supabase/migrations"}"
OUT="${OUT:-"${REPO_ROOT}/schema.sql"}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out) OUT="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 [--out <path>]"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2;;
  esac
done

if [[ ! -d "${MIGRATIONS_DIR}" ]]; then
  echo "ERROR: migrations dir not found: ${MIGRATIONS_DIR}" >&2
  exit 1
fi

shopt -s nullglob
files=("${MIGRATIONS_DIR}"/*.sql)
if [[ ${#files[@]} -eq 0 ]]; then
  echo "ERROR: no .sql migrations found in ${MIGRATIONS_DIR}" >&2
  exit 1
fi

# Sort by filename (Supabase migration filenames are timestamp-prefixed)
IFS=$'\n' sorted=($(printf '%s\n' "${files[@]}" | sort))
unset IFS

tmp="${OUT}.tmp"
{
  echo "-- Generated from supabase/migrations on $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "-- Source: ${MIGRATIONS_DIR}"
  echo ""
  for f in "${sorted[@]}"; do
    base="$(basename -- "$f")"
    echo ""
    echo "-- ===================================================================="
    echo "-- BEGIN MIGRATION: ${base}"
    echo "-- ===================================================================="
    echo ""
    cat "$f"
    echo ""
    echo "-- ===================================================================="
    echo "-- END MIGRATION: ${base}"
    echo "-- ===================================================================="
    echo ""
  done
} > "${tmp}"

mv "${tmp}" "${OUT}"
echo "Wrote: ${OUT}"

