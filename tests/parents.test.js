import test from "node:test";
import assert from "node:assert/strict";
import { parentOf, ancestorsOf, sectionOf } from "../src/lib/parents.js";

// #425: every inner screen has one parent, and the chain of them names where it lives.
const household = { assets: [{ id: "h1", category: "Shares" }, { id: "c1", category: "Cash" }, { id: "x1", category: "Collectibles" }] };

test("roots have no parent; Today's other views go up to Today", () => {
  for(const page of ["dashboard", "expenses", "networth", "plan", "more"]) assert.equal(parentOf({ page }, household), null, page);
  assert.deepEqual(parentOf({ page: "dashboard", sub: "insights" }, household), { page: "dashboard", sub: "overview", title: "Today" });
  assert.equal(parentOf({ page: "dashboard", sub: "overview" }, household), null);
});

test("Net worth's pages go up to Net worth; More's to More", () => {
  for(const page of ["accounts", "assets", "properties"]) assert.equal(parentOf({ page }, household).page, "networth");
  for(const page of ["tax", "reports", "calc", "settings"]) assert.equal(parentOf({ page }, household).page, "more");
});

test("a Details page goes up to the list it's from", () => {
  const up = (kind, id) => parentOf({ page: "detail", detail: { kind, id } }, household);
  assert.deepEqual(up("asset", "h1"), { page: "assets", sub: "Shares", title: "Shares" });
  assert.deepEqual(up("asset", "c1"), { page: "assets", sub: "Cash", title: "Cash" });
  assert.equal(up("asset", "x1").sub, "Other", "a category with no tab of its own is under Other");
  assert.equal(up("transaction", "t").sub, "spending");
  assert.equal(up("merchant", "m").sub, "spending");
  assert.equal(up("line", "l").sub, "budget");
  assert.equal(up("income", "i").sub, "income");
  assert.equal(up("account", "a").page, "accounts");
  assert.equal(up("debt", "d").page, "accounts");
  assert.equal(up("loan", "l").page, "properties");
  assert.deepEqual(up("person", "Alex"), { page: "tax", sub: "people", title: "People" });
  assert.equal(up("nothing-known", "z"), null);
});

test("the chain runs top first, and the section is its top", () => {
  const holding = { page: "detail", detail: { kind: "asset", id: "h1" } };
  assert.deepEqual(ancestorsOf(holding, household).map(v => v.title), ["Net worth", "Shares"]);
  assert.equal(sectionOf(holding, household), "networth");
  assert.deepEqual(ancestorsOf({ page: "detail", detail: { kind: "line", id: "l" } }, household).map(v => v.title), ["Budget"]);
  assert.equal(sectionOf({ page: "detail", detail: { kind: "line", id: "l" } }, household), "expenses");
  assert.equal(sectionOf({ page: "scenario" }, household), "plan");
  assert.equal(sectionOf({ page: "expenses" }, household), "expenses");
});
