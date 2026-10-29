// Summarize a run folder: did frugal load, which tools ran, what it cost, and the final answer.
// Usage: node evals/summarize.mjs evals/runs/<timestamp> [--answers]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function parseRun(file) {
  const run = { tools: [], skills: [], frugalLoaded: false, frugalUsed: false, nudged: false, result: "", cost: 0, turns: 0 };
  let lines = [];
  try {
    lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  } catch {
    return run;
  }
  for (const line of lines) {
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (ev.type === "system" && ev.subtype === "init") {
      run.skills = ev.skills || [];
      run.frugalLoaded = JSON.stringify(ev.skills || []).includes("frugal") || JSON.stringify(ev.plugins || []).includes("frugal");
    }
    if (ev.type === "system" && JSON.stringify(ev).includes("frugal: ")) run.nudged = true;
    for (const part of ev.message?.content || []) {
      if (part.type === "tool_use") {
        run.tools.push(part.name);
        if (part.name === "Skill" && JSON.stringify(part.input).includes("frugal")) run.frugalUsed = true;
      }
      if (part.type === "text" && part.text.includes("frugal: this request")) run.nudged = true;
    }
    if (ev.type === "result") {
      run.result = ev.result || "";
      run.cost = ev.total_cost_usd || 0;
      run.turns = ev.num_turns || 0;
    }
  }
  return run;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  const answers = process.argv.includes("--answers");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".jsonl")).sort()) {
    const r = parseRun(join(dir, f));
    const counts = {};
    for (const t of r.tools) counts[t] = (counts[t] || 0) + 1;
    console.log(`${f.padEnd(30)} loaded=${r.frugalLoaded} used=${r.frugalUsed} cost=$${r.cost.toFixed(3)} turns=${r.turns} tools=${JSON.stringify(counts)} chars=${r.result.length}`);
    if (answers) console.log(r.result + "\n" + "-".repeat(80));
  }
}
