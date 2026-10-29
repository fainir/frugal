import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { read, ROOT } from "./helpers.mjs";

const plugin = JSON.parse(read(join(ROOT, ".claude-plugin", "plugin.json")));
const market = JSON.parse(read(join(ROOT, ".claude-plugin", "marketplace.json")));
const hooks = JSON.parse(read(join(ROOT, "hooks", "hooks.json")));
const pkg = JSON.parse(read(join(ROOT, "package.json")));

test("plugin and marketplace manifests agree", () => {
  assert.equal(plugin.name, "frugal");
  assert.equal(market.plugins.length, 1);
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].source, "./");
  assert.equal(market.plugins[0].version, plugin.version);
  assert.equal(market.metadata.version, plugin.version);
  assert.ok(market.owner.name);
});

test("plugin hooks point at the script that ships with it", () => {
  for (const groups of Object.values(hooks.hooks)) {
    for (const group of groups) {
      for (const h of group.hooks) {
        const rel = h.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)/)[1];
        assert.ok(existsSync(join(ROOT, rel)), rel);
      }
    }
  }
});

test("the skill version matches the plugin version", () => {
  assert.match(read(join(ROOT, "skills", "frugal", "SKILL.md")), new RegExp(`version: "${plugin.version.replace(/\./g, "\\.")}"`));
  assert.equal(pkg.engines.node, ">=18");
});
