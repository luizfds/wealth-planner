import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtCompact } from "../src/lib/format.js";

// Item 190: one rule for a figure read at a glance, everywhere it's used.
test("whole dollars under $10,000, then k, then M, trailing zeros dropped", function(){
  assert.equal(fmtCompact(9457), "$9,457");
  assert.equal(fmtCompact(45200), "$45.2k");
  assert.equal(fmtCompact(673821), "$673.8k");
  assert.equal(fmtCompact(575000), "$575k");
  assert.equal(fmtCompact(1890000), "$1.89M");
  assert.equal(fmtCompact(2000000), "$2M");
  assert.equal(fmtCompact(4499439), "$4.5M");
  assert.equal(fmtCompact(12500000), "$12.5M");
});

test("the edges roll over rather than reading $1000k, and a minus is a minus sign", function(){
  assert.equal(fmtCompact(999960), "$1M");
  assert.equal(fmtCompact(9999.6), "$10k");
  assert.equal(fmtCompact(-452000), "−$452k");
  assert.equal(fmtCompact(-80), "−$80");
  assert.equal(fmtCompact(0), "$0");
  assert.equal(fmtCompact("abc"), "$0");
});
