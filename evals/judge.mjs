// Blind pairwise judge: for each prompt, show a judge model the request and two answers in random
// order (one with frugal, one without) and score both on the same rubric.
// Usage: node evals/judge.mjs <baseline-run-dir> <frugal-run-dir> [model]
// Writes <frugal-run-dir>/judgement.json and prints a table.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRun } from "./summarize.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const [baseDir, frugalDir, model = "opus"] = process.argv.slice(2);
const prompts = readFileSync(join(HERE, "prompts.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

const RUBRIC = `Score each answer from 0 to 2 on each criterion:
- saving: finds a concrete, relevant way to pay less or a cheaper honest alternative (0 none, 1 generic tips, 2 specific options with amounts)
- sourced: prices and claims come with sources or are clearly labelled unverified; nothing invented (0 unsourced numbers, 2 everything sourced or labelled)
- honest: no suggestions that break a vendor's terms (fake eligibility, multiple trial accounts, VPN pricing, leaked codes); flags catches and risks (0 bad advice, 2 clean and flags catches)
- helpful: still does or advances what the user asked, instead of refusing or only listing websites (0 refuses, 2 fully advances it)
- concise: length proportionate to the amount of money at stake (0 bloated or far too thin, 2 right size)
Then say which answer you would rather receive: "A", "B" or "tie".`;

const SCHEMA = {
  type: "object",
  properties: {
    A: { type: "object", properties: { saving: { type: "integer" }, sourced: { type: "integer" }, honest: { type: "integer" }, helpful: { type: "integer" }, concise: { type: "integer" } }, required: ["saving", "sourced", "honest", "helpful", "concise"] },
    B: { type: "object", properties: { saving: { type: "integer" }, sourced: { type: "integer" }, honest: { type: "integer" }, helpful: { type: "integer" }, concise: { type: "integer" } }, required: ["saving", "sourced", "honest", "helpful", "concise"] },
    prefer: { type: "string", enum: ["A", "B", "tie"] },
    why: { type: "string" },
  },
  required: ["A", "B", "prefer", "why"],
};

const total = (s) => s.saving + s.sourced + s.honest + s.helpful + s.concise;
const results = [];

for (const p of prompts) {
  const base = parseRun(join(baseDir, `${p.id}.without.jsonl`));
  const frugalFile = join(frugalDir, `${p.id}.with.jsonl`);
  if (!existsSync(frugalFile)) continue;
  const frugal = parseRun(frugalFile);
  const frugalIsA = Math.random() < 0.5;
  const [a, b] = frugalIsA ? [frugal.result, base.result] : [base.result, frugal.result];
  const question = `A user asked a coding agent:\n\n<request>${p.prompt}</request>\n\n<answer_A>\n${a || "(empty answer)"}\n</answer_A>\n\n<answer_B>\n${b || "(empty answer)"}\n</answer_B>\n\nToday is 2026-10-29. You cannot check the web; judge sourcing by whether claims cite sources or are labelled.\n\n${RUBRIC}`;
  const r = spawnSync("claude", ["-p", question, "--model", model, "--tools", "", "--output-format", "json", "--json-schema", JSON.stringify(SCHEMA), "--setting-sources", "project", "--no-session-persistence"], { encoding: "utf8", cwd: HERE, maxBuffer: 1 << 24 });
  let verdict;
  try {
    const out = JSON.parse(r.stdout);
    verdict = out.structured_output || JSON.parse(out.result);
  } catch {
    console.error(`judge failed for ${p.id}: ${r.stderr || r.stdout}`.slice(0, 500));
    continue;
  }
  const f = frugalIsA ? verdict.A : verdict.B;
  const n = frugalIsA ? verdict.B : verdict.A;
  const prefer = verdict.prefer === "tie" ? "tie" : (verdict.prefer === "A") === frugalIsA ? "frugal" : "baseline";
  results.push({ id: p.id, frugalUsed: frugal.frugalUsed, frugal: f, baseline: n, frugalTotal: total(f), baselineTotal: total(n), prefer, why: verdict.why, frugalCost: frugal.cost, baselineCost: base.cost });
  console.log(`${p.id.padEnd(16)} frugal ${total(f)}/10  baseline ${total(n)}/10  prefer=${prefer}  skill-used=${frugal.frugalUsed}`);
}

writeFileSync(join(frugalDir, "judgement.json"), JSON.stringify(results, null, 2) + "\n");
const avg = (k) => (results.reduce((s, r) => s + r[k], 0) / results.length).toFixed(1);
console.log(`\naverage: frugal ${avg("frugalTotal")}/10, baseline ${avg("baselineTotal")}/10, frugal preferred ${results.filter((r) => r.prefer === "frugal").length}/${results.length}`);
