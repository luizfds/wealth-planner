import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { dataHealthChecks } from "../src/calc/health.js";

test("names used twice: accounts warn, other things are worth knowing", () => {
  const keep = { accounts: state.accounts, assets: state.assets, properties: state.properties, debts: state.debts };
  try {
    state.accounts = [{ name: "Everyday" }, { name: "everyday " }, { name: "Savings" }];
    state.assets = [{ what: "Fern Fund" }, { what: "Fern Fund" }];
    state.properties = [{ what: "1 Example St", loans: [{ what: "Main" }, { what: "Main" }] }];
    state.debts = [];
    const c = dataHealthChecks({ today: "2026-10-28", items: [] });
    const acc = c.find(x => x.id === "dup-accounts"), other = c.find(x => x.id === "dup-names");
    assert.equal(acc.severity, "warn"); assert.match(acc.detail, /everyday/);
    assert.equal(other.severity, "info"); assert.match(other.detail, /Fern Fund/); assert.match(other.detail, /Main/);
  } finally { Object.assign(state, keep); }
});
