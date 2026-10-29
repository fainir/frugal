#!/usr/bin/env bash
# Install the frugal skill (and optionally its hook and always-on rule) for the coding agents on this
# machine. One copy goes to ~/.agents/skills/frugal, which Codex, Cursor, Gemini CLI, GitHub Copilot,
# OpenCode, Amp and Devin Desktop read; Claude Code, Cline and Antigravity CLI get a link to it.
#
#   bash install.sh                 skill for every agent found, plus ~/.config/frugal
#   bash install.sh --all           skill + hook + rule
#   bash install.sh --hook --rule   pick extras one by one
#   bash install.sh --link          symlink to this checkout so `git pull` updates the skill
#   bash install.sh --agents claude,codex
#   bash install.sh --dry-run       print what would change, change nothing
#   bash install.sh --uninstall     remove everything frugal added
#
# Run it from a clone, or straight from GitHub:
#   curl -fsSL https://raw.githubusercontent.com/fainir/frugal/main/install.sh | bash -s -- --all
set -euo pipefail

REPO_URL="https://github.com/fainir/frugal"
HOME_DIR="${FRUGAL_HOME:-$HOME}"
CONFIG_DIR="$HOME_DIR/.config/frugal"
SHARED_DIR="$HOME_DIR/.agents/skills/frugal"

want_hook=0; want_rule=0; link=0; dry=0; uninstall=0; profile=1; force=0; agents_arg=""
while [ $# -gt 0 ]; do
  case "$1" in
    --all) want_hook=1; want_rule=1 ;;
    --hook) want_hook=1 ;;
    --rule) want_rule=1 ;;
    --link) link=1 ;;
    --dry-run) dry=1 ;;
    --uninstall) uninstall=1 ;;
    --no-profile) profile=0 ;;
    --force) force=1 ;;
    --agents) shift; agents_arg="${1:-}" ;;
    --agents=*) agents_arg="${1#--agents=}" ;;
    -h|--help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "frugal: unknown option $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

# Find the skill source: this checkout, or a fresh clone when run through curl.
src_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"
if [ -z "$src_dir" ] || [ ! -f "$src_dir/skills/frugal/SKILL.md" ]; then
  src_dir="$HOME_DIR/.local/share/frugal"
  if [ "$dry" -eq 0 ]; then
    command -v git >/dev/null || { echo "frugal: git is needed to download the skill" >&2; exit 1; }
    if [ -d "$src_dir/.git" ]; then git -C "$src_dir" pull -q --ff-only; else git clone -q --depth 1 "$REPO_URL" "$src_dir"; fi
    link=1
  fi
fi
SKILL_SRC="$src_dir/skills/frugal"

say() { printf '  %s\n' "$*"; }
run() { if [ "$dry" -eq 1 ]; then say "[dry-run] $*"; else "$@"; fi; }

ALL_AGENTS="claude codex cursor gemini copilot opencode cline antigravity"

has_agent() {
  case "$1" in
    claude) [ -d "$HOME_DIR/.claude" ] || command -v claude >/dev/null 2>&1 ;;
    codex) [ -d "$HOME_DIR/.codex" ] || command -v codex >/dev/null 2>&1 ;;
    cursor) [ -d "$HOME_DIR/.cursor" ] || command -v cursor >/dev/null 2>&1 || command -v cursor-agent >/dev/null 2>&1 ;;
    gemini) [ -d "$HOME_DIR/.gemini" ] || command -v gemini >/dev/null 2>&1 ;;
    copilot) [ -d "$HOME_DIR/.copilot" ] || command -v copilot >/dev/null 2>&1 ;;
    opencode) [ -d "$HOME_DIR/.config/opencode" ] || command -v opencode >/dev/null 2>&1 ;;
    cline) [ -d "$HOME_DIR/.cline" ] ;;
    antigravity) [ -d "$HOME_DIR/.gemini/antigravity-cli" ] || command -v agy >/dev/null 2>&1 ;;
    *) return 1 ;;
  esac
}

# Agents that do not read ~/.agents/skills get a link to it. Everything else reads the shared copy.
skill_dir_for() {
  case "$1" in
    claude) echo "$HOME_DIR/.claude/skills/frugal" ;;
    cline) echo "$HOME_DIR/.cline/skills/frugal" ;;
    antigravity) echo "$HOME_DIR/.gemini/antigravity-cli/skills/frugal" ;;
  esac
}

# Older frugal versions and older agent releases used these; uninstall cleans them up.
LEGACY_DIRS="$HOME_DIR/.codex/skills/frugal $HOME_DIR/.cursor/skills/frugal $HOME_DIR/.gemini/skills/frugal"

if [ -n "$agents_arg" ]; then
  IFS=',' read -r -a agents <<< "$agents_arg"
else
  agents=()
  for a in $ALL_AGENTS; do has_agent "$a" && agents+=("$a"); done
fi

# Only ever replace or delete something that is ours: a frugal skill folder, or a dangling link.
is_frugal_dir() { grep -qs '^name: frugal' "$1/SKILL.md" || { [ -L "$1" ] && [ ! -e "$1" ]; }; }

remove_path() {
  local p="$1"
  if [ -L "$p" ] || [ -e "$p" ]; then
    if is_frugal_dir "$p" || [ "$force" -eq 1 ]; then run rm -rf "$p"; say "removed $p"
    else say "skipped $p: it is not a frugal install (use --force to replace it)"; return 1; fi
  fi
}

# JSON edits go through node, which the hook needs anyway.
edit_json() { # file, mode(add|remove), agent(claude|codex), hook_cmd
  local file="$1" mode="$2" agent="$3" cmd="$4"
  if ! command -v node >/dev/null 2>&1; then say "node not found: skipped hook in $file"; return 0; fi
  if [ "$dry" -eq 1 ]; then say "[dry-run] $mode frugal hook in $file"; return 0; fi
  mkdir -p "$(dirname "$file")"
  [ -f "$file" ] && cp "$file" "$file.frugal-backup"
  FRUGAL_FILE="$file" FRUGAL_MODE="$mode" FRUGAL_AGENT="$agent" FRUGAL_CMD="$cmd" node --input-type=module -e '
    import { existsSync, readFileSync, writeFileSync } from "node:fs";
    const { FRUGAL_FILE: file, FRUGAL_MODE: mode, FRUGAL_AGENT: agent, FRUGAL_CMD: cmd } = process.env;
    const data = existsSync(file) && readFileSync(file, "utf8").trim() ? JSON.parse(readFileSync(file, "utf8")) : {};
    data.hooks = data.hooks || {};
    const isOurs = (group) => (group.hooks || []).some((h) => String(h.command || "").includes("frugal-nudge.mjs"));
    for (const event of Object.keys(data.hooks)) {
      data.hooks[event] = data.hooks[event].filter((g) => !isOurs(g));
      if (!data.hooks[event].length) delete data.hooks[event];
    }
    if (mode === "add") {
      const hook = { type: "command", command: cmd, timeout: 10 };
      if (agent === "codex") hook.statusMessage = "frugal";
      (data.hooks.UserPromptSubmit = data.hooks.UserPromptSubmit || []).push({ hooks: [hook] });
      if (agent === "claude") {
        (data.hooks.PostToolUse = data.hooks.PostToolUse || []).push({
          matcher: "mcp__.*(navigate|new_page|open_url|preview_start|browser_batch|tabs_create).*",
          hooks: [{ ...hook }],
        });
      }
    }
    writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  '
  say "$mode frugal hook: $file"
}

edit_rule() { # file, mode(add|remove)
  local file="$1" mode="$2"
  if [ "$dry" -eq 1 ]; then say "[dry-run] $mode frugal rule in $file"; return 0; fi
  mkdir -p "$(dirname "$file")"; touch "$file"
  local tmp; tmp="$(mktemp)"
  # Drop any earlier frugal block, and the blank lines it leaves at the end of the file.
  awk '/<!-- frugal:start -->/{skip=1} !skip{ if (NF) { for (i = 0; i < blank; i++) print ""; blank = 0; print } else blank++ } /<!-- frugal:end -->/{skip=0}' "$file" > "$tmp"
  if [ "$mode" = "add" ]; then
    [ -s "$tmp" ] && echo >> "$tmp"
    cat "$src_dir/rules/frugal-rule.md" >> "$tmp"
  fi
  cat "$tmp" > "$file"; rm -f "$tmp"
  say "$mode frugal rule: $file"
}

rule_file_for() {
  case "$1" in
    claude) echo "$HOME_DIR/.claude/CLAUDE.md" ;;
    codex) echo "$HOME_DIR/.codex/AGENTS.md" ;;
    gemini) echo "$HOME_DIR/.gemini/GEMINI.md" ;;
  esac
}

hook_cmd="node --no-warnings \"$CONFIG_DIR/frugal-nudge.mjs\""

if [ "$uninstall" -eq 1 ]; then
  echo "frugal: uninstalling"
  for d in $(for a in $ALL_AGENTS; do skill_dir_for "$a"; done) $LEGACY_DIRS; do remove_path "$d" || true; done
  remove_path "$SHARED_DIR" || true
  [ -f "$HOME_DIR/.claude/settings.json" ] && edit_json "$HOME_DIR/.claude/settings.json" remove claude "$hook_cmd"
  [ -f "$HOME_DIR/.codex/hooks.json" ] && edit_json "$HOME_DIR/.codex/hooks.json" remove codex "$hook_cmd"
  for a in claude codex gemini; do f="$(rule_file_for "$a")"; [ -f "$f" ] && grep -q 'frugal:start' "$f" && edit_rule "$f" remove; done
  [ -f "$CONFIG_DIR/frugal-nudge.mjs" ] && run rm -f "$CONFIG_DIR/frugal-nudge.mjs"
  say "kept $CONFIG_DIR (your profile and savings log). Delete it yourself if you want."
  exit 0
fi

echo "frugal: installing from $src_dir"
[ "${#agents[@]}" -eq 0 ] && say "no agent folders found; installing to $SHARED_DIR only"

# 1. The skill: one real copy (or a link to this checkout) in ~/.agents/skills, linked from each agent.
remove_path "$SHARED_DIR" || exit 1
run mkdir -p "$(dirname "$SHARED_DIR")"
if [ "$link" -eq 1 ]; then run ln -s "$SKILL_SRC" "$SHARED_DIR"; else run cp -R "$SKILL_SRC" "$SHARED_DIR"; fi
say "skill: $SHARED_DIR"
for a in ${agents[@]+"${agents[@]}"}; do
  d="$(skill_dir_for "$a")"; [ -n "$d" ] || { say "$a: reads $SHARED_DIR"; continue; }
  remove_path "$d" || continue
  run mkdir -p "$(dirname "$d")"
  run ln -s "$SHARED_DIR" "$d"
  say "skill: $d"
done

# 2. Profile and savings log, so checks can skip questions and you can see what it saved.
if [ "$profile" -eq 1 ]; then
  run mkdir -p "$CONFIG_DIR"
  [ -f "$CONFIG_DIR/profile.md" ] || run cp "$SKILL_SRC/profile.example.md" "$CONFIG_DIR/profile.md"
  if [ ! -f "$CONFIG_DIR/savings.md" ]; then
    if [ "$dry" -eq 1 ]; then say "[dry-run] create $CONFIG_DIR/savings.md"
    else printf '# frugal savings log\n\ndate | item | baseline | paid | saved | how\n--- | --- | --- | --- | --- | ---\n' > "$CONFIG_DIR/savings.md"; fi
  fi
  say "profile: $CONFIG_DIR/profile.md (fill it in once, checks get faster)"
fi

# 3. Hook (optional): a local nudge when a prompt or an opened page involves spending.
if [ "$want_hook" -eq 1 ]; then
  run mkdir -p "$CONFIG_DIR"
  run cp "$src_dir/hooks/frugal-nudge.mjs" "$CONFIG_DIR/frugal-nudge.mjs"
  for a in ${agents[@]+"${agents[@]}"}; do
    case "$a" in
      claude) edit_json "$HOME_DIR/.claude/settings.json" add claude "$hook_cmd" ;;
      codex) edit_json "$HOME_DIR/.codex/hooks.json" add codex "$hook_cmd"
             say "Codex asks you to trust a new hook once; approve 'frugal' when it does." ;;
    esac
  done
fi

# 4. Rule (optional): a short always-on paragraph for each agent's global instructions.
if [ "$want_rule" -eq 1 ]; then
  for a in ${agents[@]+"${agents[@]}"}; do
    f="$(rule_file_for "$a")"
    if [ -n "$f" ]; then edit_rule "$f" add
    elif [ "$a" = "cursor" ]; then say "Cursor: copy $src_dir/rules/cursor/frugal.mdc into a project's .cursor/rules/ (user rules live in Cursor Settings > Rules)"; fi
  done
fi

echo "frugal: done. Try: \"I want to buy a 27-inch 4K monitor, what's the cheapest good option?\""
