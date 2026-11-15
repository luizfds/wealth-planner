import "./_env.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { rowImportKey, markRowImportDuplicates, rowImportLostDestinations, rowImportTouched, applyRowImport, snapshotRowImport, checkRowImportUndo, undoRowImport } from "../src/calc/rowimport.js";

// #265: the Budget, Income and Assets CSV imports after their review. Invented household and rows.
function household(){
  return {
    accounts: [{ id: "a1", name: "Bank One Everyday", type: "everyday" }],
    shared: [{ id: "s1", what: "Groceries", amount: 200, freq: "Weekly", classification: "Needs" }, { id: "s2", what: "Rent", amount: 2000, freq: "Monthly", homeCost: true }],
    properties: [{ id: "p1", what: "1 Example St", kind: "IP", expenses: [{ id: "pe1", what: "Strata", amount: 300, freq: "Quarterly" }] }, { id: "p2", what: "Home", kind: "PPOR", expenses: [] }],
    categories: ["Groceries"], transactions: [], home: {},
    income: [{ what: "Pay", person: "Alex", incomeType: "Net", amount: 4000, freq: "Monthly" }],
    assets: [{ what: "Savings", category: "Cash", amount: 1000 }, { what: "Fund", category: "Shares", symbol: "EXA", quantity: 10, price: 5, amount: 50 }]
  };
}
const exp = (what, amount, extra) => Object.assign({ what, amount, freq: "Monthly", classification: "Needs", category: "", account: "", source: "Shared", propertyId: null }, extra);

test("duplicates: a row the household has, or an earlier row in the file — by name, amount, frequency and destination", () => {
  const st = household();
  const items = [exp("groceries ", 200, { freq: "weekly" }), exp("Groceries", 200, { freq: "Weekly", source: "Housing" }), exp("Strata", 300, { freq: "Quarterly", source: "1 Example St", propertyId: "p1" }),
    exp("Gym", 40), exp("Gym", 40), exp("Gym", 41)];
  assert.equal(markRowImportDuplicates("expenses", items, st), 3);
  assert.deepEqual(items.map(i => i.duplicate), ["existing", null, "existing", null, "file", null]);
  const inc = [{ what: "Pay", person: "Alex", incomeType: "Net", amount: 4000, freq: "Monthly" }, { what: "Pay", person: "Sam", incomeType: "Net", amount: 4000, freq: "Monthly" }];
  markRowImportDuplicates("income", inc, st);
  assert.deepEqual(inc.map(i => i.duplicate), ["existing", null]);
  const as = [{ what: "Fund", category: "Shares", symbol: "exa", quantity: 10, price: 9 }, { what: "Savings", category: "Cash", amount: 1000 }, { what: "Savings", category: "Other", amount: 1000 }];
  markRowImportDuplicates("assets", as, st);
  assert.deepEqual(as.map(i => i.duplicate), ["existing", "existing", null]);
  assert.notEqual(rowImportKey("expenses", exp("A", 1)), rowImportKey("expenses", exp("A", 1, { propertyId: "p1" })));
});

test("apply puts rows where the review said, links accounts by id, and registers new categories once", () => {
  const st = household();
  const r = applyRowImport("expenses", [exp("Gym", 40, { account: "Bank One Everyday", category: "Fitness" }), exp("Water", 90, { source: "Housing" }), exp("Land fee", 50, { source: "1 Example St", propertyId: "p1", category: "Fitness" }), exp("Card", 5, { account: "Card Z" })], st, "2026-11-03");
  assert.equal(r.created.length, 4);
  const gym = st.shared.find(x => x.what === "Gym");
  assert.equal(gym.accountId, "a1");
  assert.equal(st.shared.find(x => x.what === "Card").account, "Card Z");
  assert.equal(st.shared.find(x => x.what === "Card").accountId, undefined);
  assert.ok(st.shared.find(x => x.what === "Water").homeCost);
  assert.ok(st.properties[0].expenses.some(x => x.what === "Land fee" && x.id));
  assert.deepEqual(r.categories, ["Fitness"]);
  assert.deepEqual(st.categories, ["Groceries", "Fitness"]);
  assert.deepEqual(rowImportTouched("expenses"), ["shared", "properties", "categories"]);
});

test("a property gone or no longer an investment property is reported, and never receives or redirects a row", () => {
  const st = household();
  const items = [exp("Land fee", 50, { source: "1 Example St", propertyId: "p1" }), exp("Other", 1, { source: "Home", propertyId: "p2" }), exp("Gym", 40)];
  assert.deepEqual(rowImportLostDestinations("expenses", items, st).map(i => i.what), ["Other"]);
  st.properties.shift();
  assert.deepEqual(rowImportLostDestinations("expenses", items, st).map(i => i.what), ["Land fee", "Other"]);
  const sharedWas = st.shared.length;
  applyRowImport("expenses", items, st, "2026-11-03");
  assert.equal(st.shared.length, sharedWas + 1, "only the row with no property lands in the budget");
  assert.deepEqual(rowImportLostDestinations("income", [{ propertyId: "p9" }], st), []);
});

test("Undo removes exactly the imported rows, wherever they are now, and the categories nothing uses", () => {
  const st = household();
  const r = applyRowImport("expenses", [exp("Gym", 40, { category: "Fitness" }), exp("Land fee", 50, { source: "1 Example St", propertyId: "p1", category: "Strata fees" })], st, "2026-11-03");
  snapshotRowImport(r);
  st.shared.splice(0, 1); // an older row deleted since
  st.shared.push({ what: "Later", amount: 1, freq: "Monthly", category: "Fitness" }); // a row added since, using a new category
  assert.deepEqual(undoRowImport(r, st), { ok: true });
  assert.deepEqual(st.shared.map(x => x.what), ["Rent", "Later"]);
  assert.deepEqual(st.properties[0].expenses.map(x => x.what), ["Strata"]);
  assert.deepEqual(st.categories, ["Groceries", "Fitness"], "a category a later row uses stays");
});

test("Undo refuses after an imported row is edited or removed, or the household replaced — and changes nothing", () => {
  const st = household();
  const r = applyRowImport("income", [{ what: "Side work", person: "Sam", incomeType: "Net", amount: 100, freq: "Monthly" }, { what: "Bonus", person: "Sam", incomeType: "Gross", amount: 900, freq: "Yearly" }], st, "2026-11-03");
  snapshotRowImport(r);
  st.income[1].amount = 120;
  st.income.splice(2, 1);
  const was = JSON.stringify(st);
  assert.deepEqual(undoRowImport(r, st), { ok: false, reason: "changed", changed: 2 });
  assert.equal(JSON.stringify(st), was);
  assert.deepEqual(checkRowImportUndo(r, household()), { ok: false, reason: "replaced", changed: 0 });
});

test("an asset's own updates (a share price read, a vehicle written down) don't block Undo", () => {
  const st = household();
  const r = applyRowImport("assets", [{ what: "Wagon", category: "Vehicle", purchasePrice: 20000, purchaseDate: "2024-01-01", depreciationRate: 15, amount: 0 }, { what: "Index", category: "Shares", symbol: "IDX", market: "ASX", quantity: 4, avgCost: null, price: 10, amount: 40 }], st, "2026-11-03");
  assert.equal(st.assets[3].priceUpdated, "2026-11-03");
  assert.equal(st.assets[3].history.length, 1);
  snapshotRowImport(r);
  st.assets[2].amount = 15000; st.assets[3].price = 11; st.assets[3].amount = 44; st.assets[3].priceUpdated = "2026-11-04";
  assert.equal(checkRowImportUndo(r, st).ok, true);
  st.assets[3].quantity = 5;
  assert.deepEqual(checkRowImportUndo(r, st), { ok: false, reason: "changed", changed: 1 });
});
