import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SKILL_DIR = join(ROOT, "skills", "frugal");

export function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if ([".git", "node_modules", "runs"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const data = {};
  let parent = null;
  for (const line of m[1].split("\n")) {
    const nested = line.match(/^  ([\w-]+):\s*(.*)$/);
    const top = line.match(/^([\w-]+):\s*(.*)$/);
    if (nested && parent) data[parent][nested[1]] = unquote(nested[2]);
    else if (top) {
      parent = top[2] === "" ? top[1] : null;
      data[top[1]] = top[2] === "" ? {} : unquote(top[2]);
    }
  }
  return data;
}

function unquote(v) {
  return /^".*"$/.test(v) ? JSON.parse(v) : v;
}

export const read = (p) => readFileSync(p, "utf8");
