#!/usr/bin/env bash
# Run every prompt in prompts.jsonl twice through `claude -p`: with the frugal plugin loaded and
# without it, from an empty folder, with user settings and MCP servers off so only frugal differs.
# Usage: bash evals/run.sh [model]   (default: sonnet). Results land in evals/runs/<timestamp>/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL="${1:-sonnet}"
OUT="$ROOT/evals/runs/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
echo '{"mcpServers":{}}' > "$OUT/mcp.json"

one() { # id arm prompt
  local id="$1" arm="$2" prompt="$3" work
  work="$(mktemp -d)"
  local extra=()
  [ "$arm" = "with" ] && extra=(--plugin-dir "$ROOT")
  (cd "$work" && claude -p "$prompt" --model "$MODEL" --output-format stream-json --verbose \
      --setting-sources project --strict-mcp-config --mcp-config "$OUT/mcp.json" \
      --allowedTools "WebSearch WebFetch Skill Read Glob Grep" --max-budget-usd 2 \
      --no-session-persistence ${extra[@]+"${extra[@]}"} > "$OUT/$id.$arm.jsonl" 2> "$OUT/$id.$arm.err" || true)
  echo "done $id $arm"
}
export -f one; export ROOT MODEL OUT

node -e 'for (const l of require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n")) { const p = JSON.parse(l); for (const arm of ["with", "without"]) console.log([p.id, arm, p.prompt].join("\t")); }' "$ROOT/evals/prompts.jsonl" \
  | while IFS=$'\t' read -r id arm prompt; do printf '%s\0%s\0%s\0' "$id" "$arm" "$prompt"; done \
  | xargs -0 -n 3 -P "${PARALLEL:-4}" bash -c 'one "$0" "$1" "$2"'
echo "$OUT"
