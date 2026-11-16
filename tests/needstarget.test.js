import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { needsTargetFor, needsTargetPct, NEEDS_TARGET_DEFAULT } from "../src/calc/needstarget.js";

// #389: the take-home it would take for Needs to be at most a target share of it. Invented figures.
test("short of the target: required take-home, how much more, and as a share of today's", () => {
  const r = needsTargetFor({ needs: 4200, income: 7000 }, 50);
  assert.equal(r.state, "short");
  assert.equal(r.share, 0.6);
  assert.equal(r.required, 8400);
  assert.equal(r.more, 1400);
  assert.equal(r.increase, 0.2);
});

test("within the target: nothing more needed", () => {
  const r = needsTargetFor({ needs: 3000, income: 7000 }, 50);
  assert.equal(r.state, "met");
  assert.equal(r.more, 0);
  assert.equal(r.increase, 0);
  assert.equal(r.required, 6000);
  assert.equal(needsTargetFor({ needs: 3500, income: 7000 }, 50).state, "met", "exactly on the target is met");
});

test("a different target moves the answer; a target outside 1–100 falls back to the default", () => {
  assert.equal(needsTargetFor({ needs: 4200, income: 7000 }, 60).more, 0);
  assert.equal(needsTargetFor({ needs: 4200, income: 7000 }, 40).required, 10500);
  [0, -1, 120, "x", undefined].forEach(t => assert.equal(needsTargetFor({ needs: 4200, income: 7000 }, t).target, NEEDS_TARGET_DEFAULT));
  assert.equal(needsTargetPct({ needsTarget: 65 }), 65);
  assert.equal(needsTargetPct({}), 50);
  assert.equal(needsTargetPct({ needsTarget: 0 }), 50);
});

test("Needs above the whole take-home: what it takes to cover them, and to reach the target", () => {
  const r = needsTargetFor({ needs: 9000, income: 6000 }, 50);
  assert.equal(r.state, "over");
  assert.equal(r.cover, 3000);
  assert.equal(r.required, 18000);
  assert.equal(r.more, 12000);
  assert.equal(r.increase, 2);
});

test("no take-home or no Needs: said, never NaN or Infinity", () => {
  const none = needsTargetFor({ needs: 3000, income: 0 }, 50);
  assert.equal(none.state, "noIncome");
  assert.equal(none.share, null);
  assert.equal(none.increase, null);
  assert.equal(none.more, 6000);
  const neg = needsTargetFor({ needs: 3000, income: -500 }, 50);
  assert.equal(neg.state, "noIncome");
  const noNeeds = needsTargetFor({ needs: 0, income: 7000 }, 50);
  assert.equal(noNeeds.state, "noNeeds");
  assert.equal(noNeeds.more, 0);
  for(const r of [none, neg, noNeeds, needsTargetFor({}, 50), needsTargetFor(null, 50)]){
    Object.values(r).forEach(v => { if(typeof v === "number") assert.ok(Number.isFinite(v), JSON.stringify(r)); });
  }
});

test("setting the target: only 1–100, and only when it changes", async () => {
  const { setNeedsTarget } = await import("../src/calc/needstarget.js");
  const st = { needsTarget: 50 };
  assert.equal(setNeedsTarget(st, 60), true); assert.equal(st.needsTarget, 60);
  assert.equal(setNeedsTarget(st, 60), false);
  [0, 101, "x", -3].forEach(v => { assert.equal(setNeedsTarget(st, v), false); assert.equal(st.needsTarget, 60); });
});
