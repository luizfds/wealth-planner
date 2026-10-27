import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { superEstimate, propertyEstimate, dueAfterDays } from "../src/calc/estimates.js";
import { superEstimateSubHtml } from "../src/components/assets.js";

// v3.114.0: estimates between real figures. Invented figures.
test("super grows by employer contributions after tax and the return, from the last statement", () => {
  const a = { category: "Super", person: "Alex", history: [{ date: "2026-01-01", value: 100000 }] };
  const e = superEstimate(a, "2027-01-01", { returnPct: 7, sgYearly: 12000 });
  assert.equal(e.days, 365);
  assert.ok(Math.abs(e.growth - 7000) < 30, "about a year at 7%");
  assert.ok(Math.abs(e.contributions - 10200) < 30, "12,000 less 15%");
  assert.equal(e.from.value, 100000);
  assert.equal(superEstimate({ category: "Super", history: [] }, "2027-01-01"), null);
});

test("a property's value grows at the projection's rate, rounded to the thousand", () => {
  const e = propertyEstimate({ history: [{ date: "2025-01-01", value: 500000 }] }, "2027-01-01", { ratePct: 5 });
  assert.equal(e.value, 551000);
  assert.equal(e.ratePct, 5);
});

test("each kind is due a fresh value on its own rhythm", () => {
  assert.equal(dueAfterDays({ category: "Super" }, "2026-10-01"), 190);
  assert.equal(dueAfterDays({ category: "Cash" }, "2026-10-01"), 35);
  assert.equal(dueAfterDays({ category: "Vehicle", computed: true }, "2026-10-01"), null, "valued from its price and age");
  assert.equal(dueAfterDays({ category: "Shares", priceUpdated: "2026-09-28" }, "2026-10-01"), null, "priced from the sheet this week");
  assert.equal(dueAfterDays({ category: "Shares", priceUpdated: "2026-08-01" }, "2026-10-01"), 35);
});

test("a super row shows its estimate only once the statement is a month old", () => {
  const fresh = { category: "Super", person: "", history: [{ date: "2026-10-01", value: 50000 }] };
  assert.equal(superEstimateSubHtml(fresh, "2026-10-20"), "");
  assert.match(superEstimateSubHtml(fresh, "2026-12-20"), /≈ \$[\d,]+ today, estimated from \$50,000 on 1 Oct/);
});
