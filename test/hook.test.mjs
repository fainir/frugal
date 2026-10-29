import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { moneyPage, spendMatch } from "../hooks/frugal-nudge.mjs";
import { ROOT } from "./helpers.mjs";

const HOOK = join(ROOT, "hooks", "frugal-nudge.mjs");
const stateDir = mkdtempSync(join(tmpdir(), "frugal-test-"));

function runHook(payload, env = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    env: { ...process.env, TMPDIR: stateDir, FRUGAL_HOOK: "", ...env },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

const SPENDING = [
  "I want to buy AirPods Pro",
  "we need to upgrade to the Team plan for 5 people",
  "find me a promo code for Figma",
  "book a flight from TLV to NYC in December",
  "how much does Vercel Pro cost",
  "renew our Notion subscription",
  "it costs $20/month per seat",
  "is there a cheaper alternative to Datadog?",
  "our AWS bill is too expensive",
  "add to cart the 27 inch monitor",
  "אני רוצה לקנות מקלדת",
  "Find me an economy flight from Tel Aviv to New York, Dec 20 to Jan 3.",
  "I want AirPods Pro 3. Where should I get them?",
  "is this a good deal for a used MacBook?",
  "A YouTube video says to start a dropshipping store with AutoDS. Help me sign up for all of them.",
  "sign me up for the Pro plan",
];

const NOT_SPENDING = [
  "add a buy button to the checkout page",
  "git checkout main",
  "refactor the pricing component",
  "subscribe to the websocket channel",
  "renew the TLS cert",
  "$1 is the first arg in bash",
  "fix the failing test in cart.test.ts",
  "just buy it, I want AirPods",
  "parse the flights table from the API response",
  "add a sign up form for new users",
  "write a tutorial that recommends our CLI",
  "",
];

test("spending prompts are recognised", () => {
  for (const p of SPENDING) assert.ok(spendMatch(p), `should match: ${p}`);
});

test("coding prompts and opt-outs stay quiet", () => {
  for (const p of NOT_SPENDING) assert.equal(spendMatch(p), null, `should not match: ${p}`);
});

test("long pasted code is not treated as a purchase", () => {
  const code = "```js\n" + "const buy = () => price * qty;\n".repeat(80) + "```";
  assert.equal(spendMatch(code), null);
});

test("pricing and checkout pages opened by a browser tool are recognised", () => {
  assert.deepEqual(moneyPage("mcp__Claude_Browser__navigate", { url: "https://vercel.com/pricing" }), { host: "vercel.com", path: "/pricing" });
  assert.ok(moneyPage("mcp__chrome-devtools__navigate_page", { url: "https://shop.example.com/cart?x=1" }));
  assert.ok(moneyPage("mcp__Claude_Browser__browser_batch", { actions: [{ name: "navigate", input: { url: "https://figma.com/upgrade" } }] }));
  assert.equal(moneyPage("mcp__Claude_Browser__navigate", { url: "https://vercel.com/docs" }), null);
  assert.equal(moneyPage("mcp__Claude_Browser__navigate", { url: "http://localhost:3000/checkout" }), null);
  assert.equal(moneyPage("Read", { url: "https://vercel.com/pricing" }), null);
});

test("UserPromptSubmit prints one line, then stays quiet for a while", () => {
  const payload = { hook_event_name: "UserPromptSubmit", session_id: "s1", prompt: "I want to buy a standing desk" };
  const first = runHook(payload);
  assert.match(first, /^frugal: this request may involve spending money/);
  assert.equal(first.split("\n").length, 1);
  assert.equal(runHook(payload), "");
  assert.match(runHook({ ...payload, session_id: "s2" }), /^frugal:/);
});

test("PostToolUse returns additionalContext once per host", () => {
  const payload = { hook_event_name: "PostToolUse", session_id: "s3", tool_name: "mcp__Claude_Browser__navigate", tool_input: { url: "https://www.notion.com/pricing" } };
  const out = JSON.parse(runHook(payload));
  assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(out.hookSpecificOutput.additionalContext, /www\.notion\.com\/pricing/);
  assert.equal(runHook(payload), "");
});

test("FRUGAL_HOOK=off, bad input and unrelated events never print or fail", () => {
  assert.equal(runHook({ hook_event_name: "UserPromptSubmit", session_id: "s4", prompt: "buy a laptop" }, { FRUGAL_HOOK: "off" }), "");
  assert.equal(runHook("not json"), "");
  assert.equal(runHook({ hook_event_name: "Stop", session_id: "s5" }), "");
});
