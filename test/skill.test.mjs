import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { frontmatter, read, ROOT, SKILL_DIR, walk } from "./helpers.mjs";

const skill = read(join(SKILL_DIR, "SKILL.md"));
const fm = frontmatter(skill);

test("SKILL.md frontmatter follows the Agent Skills spec", () => {
  assert.ok(fm, "frontmatter present");
  assert.equal(fm.name, "frugal");
  assert.match(fm.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(fm.description.length > 0 && fm.description.length <= 1024, `description is ${fm.description.length} chars`);
  const allowed = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  for (const key of Object.keys(fm)) assert.ok(allowed.has(key), `unexpected frontmatter key ${key}`);
  for (const [k, v] of Object.entries(fm.metadata || {})) assert.equal(typeof v, "string", `metadata.${k} must be a string`);
});

test("the description names the moments it should trigger on", () => {
  for (const word of ["buying", "subscribing", "upgrading", "checkout", "promo code", "alternatives", "never pays"]) {
    assert.ok(fm.description.toLowerCase().includes(word), `description mentions ${word}`);
  }
});

test("SKILL.md stays small enough to load on every activation", () => {
  assert.ok(skill.split("\n").length < 500);
});

test("every relative link in the markdown resolves", () => {
  const missing = [];
  for (const file of walk(ROOT).filter((p) => p.endsWith(".md"))) {
    for (const m of read(file).matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1].split("#")[0];
      if (!target || /^(https?:|mailto:)/.test(target)) continue;
      if (!existsSync(resolve(dirname(file), target))) missing.push(`${relative(ROOT, file)} -> ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("references are split small: no single file an agent must swallow whole", () => {
  for (const file of walk(join(SKILL_DIR, "references"))) {
    assert.ok(read(file).length < 20000, `${relative(ROOT, file)} is too large`);
  }
});

test("house style: no em or en dashes anywhere", () => {
  const offenders = walk(ROOT)
    .filter((p) => /\.(md|mjs|js|json|sh|yml|yaml|mdc)$/.test(p))
    .filter((p) => [0x2013, 0x2014].some((c) => read(p).includes(String.fromCharCode(c))))
    .map((p) => relative(ROOT, p));
  assert.deepEqual(offenders, []);
});

test("Codex metadata ships with the skill", () => {
  const yaml = read(join(SKILL_DIR, "agents", "openai.yaml"));
  assert.match(yaml, /allow_implicit_invocation: true/);
});
