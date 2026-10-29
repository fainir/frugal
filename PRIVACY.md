# Privacy

frugal has no server and collects nothing.

- **What it stores, only on your machine:** if you create them, `~/.config/frugal/profile.md`
  (eligibility facts you choose to write down, such as country or student status; never card
  numbers, IDs or passwords) and `~/.config/frugal/savings.md` (one line per saving you accept).
  You can read, edit or delete both at any time.
- **What it reads:** those two files, and the pricing and product pages your agent opens with its
  own web tools while it checks a purchase.
- **What it sends:** nothing of its own. Searches and page fetches go through the agent you already
  use (Claude Code, Codex, Cursor and others), under that agent's privacy terms. The optional hook
  is a local script with no network access: it reads the prompt or the URL your browser tool
  opened, and prints one line of text back to the agent.
- **Retention:** none outside your machine.
- **Payments:** frugal never pays, never enters card or bank details and never accepts terms.

Questions: open an issue at https://github.com/fainir/frugal/issues.
