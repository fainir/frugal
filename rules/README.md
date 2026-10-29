# Always-on rules

The `frugal` skill loads itself when a task looks like spending. These short rules make the agent
think of it in the cases a skill description can miss, like picking a paid API in the middle of a
coding task. `install.sh --rule` adds them for you; to do it by hand:

| Agent | Where to put it |
|-------|-----------------|
| Claude Code | Append `frugal-rule.md` to `~/.claude/CLAUDE.md` (all projects) or a project's `CLAUDE.md` |
| Codex, Copilot, OpenCode, Amp, Jules and other AGENTS.md agents | Append `frugal-rule.md` to `~/.codex/AGENTS.md` or a project's `AGENTS.md` |
| Cursor | Copy `cursor/frugal.mdc` to `.cursor/rules/frugal.mdc` in a project, or paste its body into Cursor Settings > Rules |
| Gemini CLI | Append `frugal-rule.md` to `~/.gemini/GEMINI.md` |
| Anything else | Paste `frugal-rule.md` into the agent's system prompt or custom instructions |

The markers `<!-- frugal:start -->` and `<!-- frugal:end -->` let the installer update or remove
the block without touching the rest of your file.
