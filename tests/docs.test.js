import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// v3.207.1 (item 239): CLAUDE.md stays a short list of what to do; the why lives in docs/decisions/.
const read = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const claude = read("CLAUDE.md");

test("CLAUDE.md stays under 150 lines", function(){
  assert.ok(claude.split("\n").length < 150, "CLAUDE.md is " + claude.split("\n").length + " lines — move the why into docs/decisions/");
});

test("every relative link in CLAUDE.md and the docs resolves", function(){
  const files = ["CLAUDE.md", "docs/architecture.md", "docs/decisions/README.md"];
  files.forEach(f => {
    const base = new URL("../" + f, import.meta.url);
    for(const m of read(f).matchAll(/\]\((?!https?:)([^)#]+)(#[^)]*)?\)/g)) assert.ok(fs.existsSync(new URL(m[1], base)), f + " links to missing " + m[1]);
  });
});

test("every decision record is listed in docs/decisions/README.md", function(){
  const dir = new URL("../docs/decisions/", import.meta.url), index = read("docs/decisions/README.md");
  fs.readdirSync(dir).filter(f => /^\d{4}-.*\.md$/.test(f)).forEach(f => assert.ok(index.includes("(" + f + ")"), f + " isn't in the index"));
});
