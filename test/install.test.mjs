import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ROOT } from "./helpers.mjs";

function install(home, ...args) {
  const r = spawnSync("bash", [join(ROOT, "install.sh"), ...args], { env: { ...process.env, FRUGAL_HOME: home }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  return r.stdout;
}

function fakeHome() {
  const home = mkdtempSync(join(tmpdir(), "frugal-home-"));
  for (const d of [".claude", ".codex", ".gemini"]) mkdirSync(join(home, d));
  writeFileSync(join(home, ".claude", "CLAUDE.md"), "# my rules\nkeep me\n");
  writeFileSync(join(home, ".codex", "hooks.json"), JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "mine.sh" }] }] } }));
  return home;
}

const count = (text, needle) => text.split(needle).length - 1;

test("--dry-run changes nothing", () => {
  const home = fakeHome();
  install(home, "--dry-run", "--all");
  assert.equal(existsSync(join(home, ".agents")), false);
  assert.equal(existsSync(join(home, ".config", "frugal")), false);
  assert.equal(readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8"), "# my rules\nkeep me\n");
});

test("--all installs the skill, hook and rule, and is idempotent", () => {
  const home = fakeHome();
  install(home, "--all");
  install(home, "--all");
  assert.ok(existsSync(join(home, ".agents", "skills", "frugal", "SKILL.md")));
  assert.ok(lstatSync(join(home, ".claude", "skills", "frugal")).isSymbolicLink());
  assert.ok(existsSync(join(home, ".claude", "skills", "frugal", "SKILL.md")));
  assert.ok(existsSync(join(home, ".config", "frugal", "profile.md")));
  assert.ok(existsSync(join(home, ".config", "frugal", "frugal-nudge.mjs")));

  const claudeMd = readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8");
  assert.ok(claudeMd.startsWith("# my rules\nkeep me\n"));
  assert.equal(count(claudeMd, "<!-- frugal:start -->"), 1);
  assert.equal(count(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8"), "<!-- frugal:start -->"), 1);

  const codexHooks = JSON.parse(readFileSync(join(home, ".codex", "hooks.json"), "utf8"));
  assert.equal(codexHooks.hooks.UserPromptSubmit.length, 2);
  assert.equal(codexHooks.hooks.UserPromptSubmit[0].hooks[0].command, "mine.sh");
  const claudeSettings = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8"));
  assert.equal(claudeSettings.hooks.UserPromptSubmit.length, 1);
  assert.equal(claudeSettings.hooks.PostToolUse.length, 1);
});

test("--uninstall removes what it added and keeps the user's own content", () => {
  const home = fakeHome();
  install(home, "--all");
  install(home, "--uninstall");
  assert.equal(existsSync(join(home, ".agents", "skills", "frugal")), false);
  assert.equal(existsSync(join(home, ".claude", "skills", "frugal")), false);
  assert.equal(readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8"), "# my rules\nkeep me\n");
  const codexHooks = JSON.parse(readFileSync(join(home, ".codex", "hooks.json"), "utf8"));
  assert.deepEqual(codexHooks, { hooks: { UserPromptSubmit: [{ hooks: [{ type: "command", command: "mine.sh" }] }] } });
  assert.ok(existsSync(join(home, ".config", "frugal", "profile.md")), "profile is kept");
});

test("never overwrites a folder that is not a frugal install", () => {
  const home = fakeHome();
  mkdirSync(join(home, ".claude", "skills", "frugal"), { recursive: true });
  writeFileSync(join(home, ".claude", "skills", "frugal", "SKILL.md"), "---\nname: something-else\n---\n");
  const out = install(home, "--agents", "claude");
  assert.match(out, /not a frugal install/);
  assert.match(readFileSync(join(home, ".claude", "skills", "frugal", "SKILL.md"), "utf8"), /something-else/);
});
