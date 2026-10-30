import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { categoryIconHtml, categoryColorClass } from "../src/lib/caticons.js";
import { modernPlainRowHtml, modernRowShellHtml, optionsHtml, historyTrendHtml } from "../src/lib/ledger-table.js";
import { categoryChartHtml, categoryLookPickerHtml, irregularBudgetSectionHtml, budgetComparisonRowHtml, transactionAccountOptionsHtml, budgetLineOptgroupsHtml, lineMatchesFilter, sortedCategories } from "../src/components/expenses.js";
import { todaysMixHtml } from "../src/components/assets.js";
import { sparklineHtml, sparklinePlaceholderHtml, dateAxisFormat } from "../src/lib/charts.js";
import { parseAmountInput } from "../src/lib/format.js";
import { openQuickLog, closeQuickLog, setQuickLogLink, setQuickLogSign, setQuickLogRefundOf, submitQuickLog, quickLogRefundChipsHtml, transactionSummaryText, quickLog } from "../src/components/expenses.js";
import { rangeByKey, rangeLabel, rangeStartDate, withinRange, bestFitRange, timeRangeControlHtml } from "../src/lib/timerange.js";

// Why this file exists.
//
// Twice in one sitting this suite went fully green over a page that did not render at all:
//
//   1. `merchantKey` imported from the wrong module — the whole bank-import component failed to
//      load, and the page was dead.
//   2. `lineIdAttr(item)` called inside modernRowShellHtml(), which takes (section, idx, opts) and
//      has no `item` in scope — every budget row threw, and the Expenses list was empty.
//
// Both passed `node --check`. Both passed every test. Both were caught only by opening a browser.
// The reason is that the suite tested `calc/` — pure arithmetic — and never once *called* the
// functions that build the app's HTML.
//
// It turns out most of those builders are pure string functions: they take data and return markup,
// touching no DOM. So they can be called straight from the test runner, with no jsdom, no bundler
// and no new dependency — which matters, because "no dependencies, no build step" is the point of
// this project.
//
// These tests deliberately assert almost nothing about *what* the markup says. Pinning exact HTML
// would make every copy change a test failure and teach whoever comes next to stop reading them.
// What they assert is that the function runs and returns markup — which is precisely, and only,
// what was broken both times.

function ledgerItem(overrides){
  return Object.assign({
    id: "e1", what: "Groceries", classification: "Needs", category: "Groceries",
    account: "Everyday", amount: 430, freq: "Weekly", irregular: false, dueMonth: null,
    history: []
  }, overrides || {});
}

test("modernPlainRowHtml builds a budget row without a DOM", function(){
  // The exact call the Expenses page makes for every one of its rows. This is the one that broke.
  var html = modernPlainRowHtml(ledgerItem(), 0, "shared", {}, {
    showClass: true, showDone: true, categories: state.categories, activeScenario: state.activeScenario
  });
  assert.equal(typeof html, "string");
  assert.ok(html.indexOf('class="m-row') !== -1, "should produce a row element");
  assert.ok(html.indexOf('data-section="shared"') !== -1);
  assert.ok(html.indexOf('data-line-id="e1"') !== -1, "an item with an id is addressable from outside the list");
});

test("modernPlainRowHtml survives an item with nothing filled in", function(){
  // A row created by "+ Add expense" before the user types anything, and a row from an old save
  // that predates half these fields. Neither should be able to throw.
  var bare = modernPlainRowHtml({ what: "", amount: 0, freq: "Monthly" }, 0, "shared", {}, {});
  assert.ok(bare.indexOf('class="m-row') !== -1);
  assert.ok(bare.indexOf("data-line-id") === -1, "no id means no id attribute, not undefined");
  var empty = modernPlainRowHtml({}, 3, "shared", {}, { showClass: true });
  assert.equal(typeof empty, "string");
});

test("modernPlainRowHtml renders an open row, a computed row and every section it serves", function(){
  // Each of these takes a different branch through the shell, and only one of them is exercised by
  // the default case above.
  var open = modernPlainRowHtml(ledgerItem(), 0, "shared", { "shared:0": true }, { showClass: true });
  assert.ok(open.indexOf("m-row open") !== -1, "an open row renders its edit panel");
  var computed = modernPlainRowHtml(ledgerItem({ computed: true, computedNote: "from the loan" }), 1, "home:Renting", {}, {});
  assert.ok(computed.indexOf("computed") !== -1);
  ["shared", "income", "home:Renting", "propinc:p1", "propexp:p1", "tx"].forEach(function(section){
    var html = modernPlainRowHtml(ledgerItem(), 2, section, {}, { showClass: section !== "income" });
    assert.ok(html.indexOf('data-section="' + section + '"') !== -1, "section " + section + " renders");
  });
});

test("modernRowShellHtml runs with only the arguments it actually declares", function(){
  // The second bug, exactly: this function takes (section, idx, openState, summary, edit, opts) and
  // reached for an `item` that was never passed to it.
  var shell = modernRowShellHtml("shared", 0, {}, "<span>summary</span>", "<div>edit</div>", {});
  assert.ok(shell.indexOf('data-section="shared"') !== -1);
  assert.ok(shell.indexOf("data-line-id") === -1, "no lineId in opts means the attribute is simply absent");
  var withId = modernRowShellHtml("shared", 0, {}, "<span>s</span>", "", { lineId: "e9", computed: true });
  assert.ok(withId.indexOf('data-line-id="e9"') !== -1);
});

test("optionsHtml and historyTrendHtml handle empty and populated inputs", function(){
  assert.ok(optionsHtml(["Monthly", "Weekly"], "Weekly").indexOf("selected") !== -1);
  assert.equal(typeof optionsHtml([], ""), "string");
  assert.equal(typeof historyTrendHtml({ history: [] }), "string");
  assert.equal(typeof historyTrendHtml({}), "string", "an item with no history array at all");
  assert.equal(typeof historyTrendHtml({ history: [{ date: "2026-01-01", value: 100 }, { date: "2026-06-01", value: 140 }] }), "string");
});

test("categoryChartHtml handles one group, many groups, and a negative one", function(){
  // The negative case is the one that had real geometry consequences (refunds), so it stays pinned
  // here as well as in its own test.
  assert.equal(categoryChartHtml([{ key: "Groceries", monthly: 300 }], "/mo"), "", "one group is not a breakdown");
  var many = categoryChartHtml([{ key: "Groceries", monthly: 300 }, { key: "Transport", monthly: 150 }], "/mo");
  assert.ok(many.indexOf("rule-seg") !== -1);
  var withNegative = categoryChartHtml([
    { key: "Groceries", monthly: 300 }, { key: "Transport", monthly: 150 }, { key: "Clothing", monthly: -40 }
  ], "/mo");
  assert.ok(withNegative.indexOf("is-credit") !== -1, "a net-refund category is labelled, not drawn as a slice");
  assert.ok(withNegative.indexOf("width:-") === -1, "and never given a negative width");
  assert.equal(categoryChartHtml([], "/mo"), "");
});

test("a category wears its colour and icon on a row, in a chart and in its picker (item 187)", function(){
  var icon = categoryIconHtml("Groceries");
  assert.match(icon, /class="cat-icon cat-c-\d+"/);
  assert.match(icon, /<svg[^>]*aria-hidden="true"/);
  var chart = categoryChartHtml([{ key: "Groceries", monthly: 300 }, { key: "Transport", monthly: 150 }], "/mo");
  assert.ok(chart.indexOf("rule-seg cat-seg " + categoryColorClass("Groceries")) !== -1, "the slice is the category's colour");
  state.categories = ["Groceries"];
  state.categoryLooks = { Groceries: { color: 6 } };
  var picker = categoryLookPickerHtml("Groceries", 0);
  assert.equal((picker.match(/data-cat-color=/g) || []).length, 12);
  assert.match(picker, /cat-swatch cat-c-6 is-on/);
  assert.match(picker, /data-cat-look-reset/, "a picked look can go back to the default");
  state.categoryLooks = {};
});

test("todaysMixHtml builds the composition bar, and refuses to when there is nothing to divide", function(){
  var buckets = [
    { key: "Super", colorClass: "series-color-0", records: [{ history: [], current: 142300 }] },
    { key: "Cash", colorClass: "series-color-2", records: [{ history: [], current: 2400 }] }
  ];
  var html = todaysMixHtml(buckets, "2026-09-12");
  assert.ok(html.indexOf("rule-seg series-color-0") !== -1, "a series-coloured segment per bucket");
  assert.ok(html.indexOf("rule-swatch series-color-2") !== -1, "and a matching legend swatch");
  assert.ok(html.indexOf("width:-") === -1);
  // A bucket holding nothing today is dropped rather than drawn as a zero-width sliver with a
  // legend entry nobody can point at.
  assert.ok(todaysMixHtml(buckets.concat([{ key: "Shares", colorClass: "series-color-1", records: [] }]), "2026-09-12")
    .indexOf("series-color-1") === -1);
  assert.equal(todaysMixHtml([], "2026-09-12"), "");
  assert.equal(todaysMixHtml([{ key: "Cash", colorClass: "series-color-2", records: [{ history: [], current: 0 }] }], "2026-09-12"), "",
    "nothing owned is not a pie chart of nothing");
});

test("the sparkline survives empty, single-point and flat histories", function(){
  // Every one of these is a real state of a new save: nothing logged, one snapshot, or a value that
  // hasn't moved. A divide-by-zero here draws a broken line rather than throwing, so "it didn't
  // error" is not evidence — the assertion is on the coordinates.
  assert.equal(sparklineHtml([]), "", "nothing to draw yet");
  assert.equal(sparklineHtml([{ date: "2026-01-01", value: 10 }]), "", "one point is not a trend");
  var flat = sparklineHtml([{ date: "2026-01-01", value: 10 }, { date: "2026-02-01", value: 10 }]);
  assert.ok(flat.indexOf("NaN") === -1, "a flat series divides by a zero range");
  var real = sparklineHtml([{ date: "2026-01-01", value: 10 }, { date: "2026-02-01", value: 40 }]);
  assert.ok(real.indexOf("NaN") === -1 && real.indexOf("<svg") !== -1);
  assert.equal(typeof sparklinePlaceholderHtml(), "string");
});

// renderLineChart() is deliberately NOT here: it takes a container element and builds its output
// with document.createElement, so it cannot run in this runner. Stubbing a document for it would
// buy a passing test and no real confidence — that one is verified by driving the app, which is
// the right tool for a function whose whole job is touching the DOM.

// ---------------- The shared time-range control ----------------

test("rangeStartDate is unbounded for All and a real date for every fixed window", function(){
  // null means "no lower bound", which callers must treat as unbounded rather than as today —
  // reading it as a date would silently hide everything.
  assert.equal(rangeStartDate(rangeByKey("all"), { today: "2026-09-12" }), null);
  assert.equal(rangeStartDate(rangeByKey("1d"), { today: "2026-09-12" }), "2026-09-11");
  assert.equal(rangeStartDate(rangeByKey("1m"), { today: "2026-09-12" }), "2026-08-13");
  assert.equal(rangeStartDate(rangeByKey("1y"), { today: "2026-09-12" }), "2025-09-12");
  // A window that crosses a month and a year boundary, which naive date arithmetic gets wrong.
  assert.equal(rangeStartDate(rangeByKey("3m"), { today: "2026-01-15" }), "2025-10-17");
});

test("the YTD window starts at the household's own year, not January", function(){
  // The household year is a preference — on the financial basis a "year to date" figure measured
  // from 1 January is simply a different number, which is why the caller passes the boundary in.
  assert.equal(rangeStartDate(rangeByKey("ytd"), { today: "2026-09-12", yearStart: "2026-07-01" }), "2026-07-01");
  assert.equal(rangeLabel(rangeByKey("ytd"), "financial"), "FYTD");
  assert.equal(rangeLabel(rangeByKey("ytd"), "calendar"), "YTD");
});

test("withinRange keeps what's inside, drops what's outside, and drops undated rows", function(){
  var rows = [
    { date: "2026-09-10", amount: 1 },
    { date: "2026-01-02", amount: 2 },
    { date: "", amount: 3 },
    { amount: 4 }
  ];
  var recent = withinRange(rows, rangeByKey("1m"), { today: "2026-09-12" });
  assert.deepEqual(recent.map(function(r){ return r.amount; }), [1]);
  // A row that can't say when it happened cannot honestly appear under "the last 3 months" —
  // but it must still survive "All", or it would be unreachable from the list entirely.
  var all = withinRange(rows, rangeByKey("all"), { today: "2026-09-12" });
  assert.deepEqual(all.map(function(r){ return r.amount; }), [1, 2],
    "undated rows are dropped even by All — they have no place on a dated axis");
});

test("dateAxisFormat picks days inside a quarter and months beyond it", function(){
  // "Aug 2026 / Sep 2026" is the whole axis of a four-week window, which is no axis at all — and
  // the range controls mean one chart now spans a week or a decade depending on the button.
  var day = 86400000;
  var short_ = dateAxisFormat([{ x: Date.UTC(2026, 7, 24) }, { x: Date.UTC(2026, 8, 12) }]);
  assert.ok(/\d/.test(short_(Date.UTC(2026, 8, 12))));
  assert.ok(short_(Date.UTC(2026, 8, 12)).indexOf("2026") === -1, "a three-week span doesn't need the year");
  var long_ = dateAxisFormat([{ x: Date.UTC(2025, 6, 31) }, { x: Date.UTC(2026, 8, 12) }]);
  assert.ok(long_(Date.UTC(2026, 8, 12)).indexOf("2026") !== -1, "a 13-month span does");
  // Exactly at the boundary, and with too few points to have a span at all.
  assert.ok(dateAxisFormat([{ x: 0 }, { x: 100 * day }])(0).indexOf("1970") === -1, "100 days is still short");
  assert.equal(typeof dateAxisFormat([])(0), "string");
  assert.equal(typeof dateAxisFormat(null)(0), "string");
});

test("bestFitRange opens a chart where its observations actually are", function(){
  var at = { today: "2026-09-12" };
  // A realistic shape: one super reading from July 2025, then a fortnight of daily share
  // logs. "All" spends 95% of the x-axis on the period before anything but super was tracked.
  var clustered = ["2025-07-31", "2026-08-31", "2026-09-07", "2026-09-08", "2026-09-09",
                   "2026-09-10", "2026-09-11", "2026-09-12"];
  assert.equal(bestFitRange(clustered, at), "1w", "six of eight points sit inside the last week");
  // The ordinary case — a year of even monthly logs — has no window better than all of it.
  var monthly = [];
  for(var m = 0; m < 12; m++) monthly.push("2025-" + String(m + 1).padStart(2, "0") + "-01");
  assert.equal(bestFitRange(monthly.concat(["2026-09-12"]), at), "all");
  // Too few points to be framing anything.
  assert.equal(bestFitRange(["2026-09-11", "2026-09-12"], at), "all");
  assert.equal(bestFitRange([], at), "all");
  assert.equal(bestFitRange(null, at), "all");
});

test("timeRangeControlHtml marks the selection and can omit windows", function(){
  var html = timeRangeControlHtml("3m", "tx-range", { omit: ["1d", "1w"] });
  assert.ok(html.indexOf('data-tx-range="3m"') !== -1);
  assert.ok(html.indexOf('aria-pressed="true"') !== -1, "the active option is announced, not just coloured");
  assert.ok(html.indexOf('data-tx-range="1d"') === -1, "omitted windows are absent, not disabled");
  assert.ok(html.indexOf('data-tx-range="all"') !== -1);
});

// Actual vs. planned: an irregular (reserve) row is drillable, and over its own year.
//
// These rows rendered as a flat bar with no expander at all, so the transactions making up their
// "actual" figure had nowhere to be seen — the one case where that matters most, since an
// irregular line's spend can be a single receipt from eleven months ago rather than something
// sitting in this month's Transactions list.
//
// The window is the row's reserve year, not the calendar month, so these use today's date, which
// falls inside all three bases (calendar, financial, rolling12) whichever one a row is set to.
function reserveItem(overrides){
  return Object.assign({
    id: "irr1", what: "Trips", classification: "Wants", category: "Travel",
    account: "Everyday", amount: 20000, freq: "Yearly", irregular: true, history: []
  }, overrides || {});
}
const TODAY_ISO = new Date().toLocaleDateString("en-CA");

test("irregularBudgetSectionHtml renders a reserve row", () => {
  const prev = state.transactions;
  state.transactions = [];
  try {
    const html = irregularBudgetSectionHtml([reserveItem()]);
    assert.match(html, /<div/);
    assert.match(html, /Trips/);
    assert.match(html, /budget-bar-fill/);
  } finally { state.transactions = prev; }
});

test("an irregular row with spend in its reserve year is expandable", () => {
  const prev = state.transactions;
  state.transactions = [{ date: TODAY_ISO, amount: 1200, what: "Flights", linkedExpenseId: "irr1" }];
  try {
    const html = irregularBudgetSectionHtml([reserveItem()]);
    assert.match(html, /data-budget-row-toggle="irr1"/);
    assert.match(html, /is-expandable/);
    assert.match(html, /aria-expanded="false"/);
  } finally { state.transactions = prev; }
});

test("an irregular row with nothing logged stays a plain row", () => {
  const prev = state.transactions;
  // Linked to a different line, so this row's own reserve year is empty.
  state.transactions = [{ date: TODAY_ISO, amount: 1200, what: "Flights", linkedExpenseId: "other" }];
  try {
    const html = irregularBudgetSectionHtml([reserveItem()]);
    assert.ok(!html.includes("data-budget-row-toggle"), "should carry no toggle");
    assert.ok(!html.includes("is-expandable"), "should not be marked expandable");
  } finally { state.transactions = prev; }
});

test("an irregular row ignores spend outside its reserve year", () => {
  const prev = state.transactions;
  // Ten years back is outside every reserve-year basis.
  const longAgo = String(Number(TODAY_ISO.slice(0, 4)) - 10) + TODAY_ISO.slice(4);
  state.transactions = [{ date: longAgo, amount: 1200, what: "Flights", linkedExpenseId: "irr1" }];
  try {
    const html = irregularBudgetSectionHtml([reserveItem()]);
    assert.ok(!html.includes("data-budget-row-toggle"), "out-of-window spend should not make it expandable");
  } finally { state.transactions = prev; }
});

// ---------------- One row builder for both kinds of budget line ----------------
// Regular and irregular rows were two hand-written builders drifting side by side, and that split
// produced two reported gaps in a row (no progress bar on irregular rows until v3.7.0, no
// drill-down until v3.8.0) — each time because a change landed on one builder and not the other.
// They share one now, with `cycle` as the only branch.

// A quarterly line whose cycle opened two months ago, so "inside the cycle" and "inside this
// calendar month" are genuinely different windows — which is the whole point of the drill-down
// reading off cycle.start/end rather than the month.
function quarterlyItem(){
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const cycleStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return { id: "q1", what: "Gas", amount: 230, freq: "Quarterly", irregular: false,
           dueMonth: cycleStart.getMonth() + 1, classification: "Needs", category: "", history: [] };
}
function isoInMonthsBack(n, day){
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return new Date(d.getFullYear(), d.getMonth() - n, day).toLocaleDateString("en-CA");
}

test("a multi-month cycle drills into its whole cycle, not just this month", () => {
  const prev = state.transactions;
  // One charge last month: inside the quarterly cycle, outside the calendar month. Counted in the
  // row's "actual" either way, so listing only this month left the list not adding up to the
  // figure sitting above it.
  state.transactions = [{ id: "t1", date: isoInMonthsBack(1, 15), amount: 117, what: "Gas (last month)", linkedExpenseId: "q1" }];
  try {
    const html = budgetComparisonRowHtml(quarterlyItem());
    assert.match(html, /is-expandable/, "a charge inside the cycle must make the row drillable");
    assert.match(html, /data-budget-row-toggle="q1"/);
  } finally { state.transactions = prev; }
});

test("a charge outside the cycle entirely does not make the row drillable", () => {
  const prev = state.transactions;
  state.transactions = [{ id: "t1", date: isoInMonthsBack(11, 15), amount: 117, what: "Ancient", linkedExpenseId: "q1" }];
  try {
    const html = budgetComparisonRowHtml(quarterlyItem());
    assert.ok(!html.includes("data-budget-row-toggle"), "out-of-cycle spend is not this cycle's");
  } finally { state.transactions = prev; }
});

test("under budget reads as good news on a regular line but not on a reserve line", () => {
  const prev = state.transactions;
  state.transactions = [];
  try {
    // Regular monthly line, nothing spent: genuinely under this month's bill, so green.
    const regular = budgetComparisonRowHtml({ id: "r1", what: "Internet", amount: 99, freq: "Monthly",
      irregular: false, classification: "Needs", category: "", history: [] });
    assert.match(regular, /var\(--good-ink\)/);
    // Reserve line, nothing spent: being under a whole year's allowance is the normal state of
    // affairs, not an achievement, so no green.
    const reserve = budgetComparisonRowHtml({ id: "i1", what: "Trips", amount: 20000, freq: "Yearly",
      irregular: true, classification: "Wants", category: "", history: [] });
    assert.ok(!reserve.includes("var(--good-ink)"), "a reserve line under budget is not good news");
  } finally { state.transactions = prev; }
});

// ---------------- A deleted account's name survives on the rows that used it ----------------
// deleteAccount() leaves `row.account` alone rather than blanking it: an account is a statement of
// fact about where money moved, and because the link is by name, re-adding one spelled the same
// way re-attaches everything by itself. The catch is that a row can then name an account that is
// not in state.accounts, and a <select> whose value matches none of its options does not render
// empty — the browser falls back to the *first* option, so the row would silently read
// "— No account —" and the next edit would save that over a real fact.
test("the account select keeps an option for a name that no longer exists", () => {
  const prev = state.accounts;
  state.accounts = [{ id: "a1", name: "Commbank", type: "debit" }];
  try {
    const html = transactionAccountOptionsHtml("Credit Card");
    assert.match(html, /value="Credit Card" selected/, "the missing name must still be selectable");
    assert.match(html, /Credit Card \(deleted\)/, "and must say why it is not in the list");
    // The empty option must not be the selected one, or the row reads as unattributed.
    assert.ok(!/<option value="" selected/.test(html), html);
  } finally { state.accounts = prev; }
});

test("a known account selects normally, with no deleted marker", () => {
  const prev = state.accounts;
  state.accounts = [{ id: "a1", name: "Commbank", type: "debit" }, { id: "a2", name: "Amex", type: "credit" }];
  try {
    const html = transactionAccountOptionsHtml("Amex");
    assert.match(html, /value="Amex" selected/);
    assert.ok(!html.includes("(deleted)"), html);
    assert.match(html, /Amex \(card\)/, "a credit card still says so");
  } finally { state.accounts = prev; }
});

test("no account selected leaves the empty option selected", () => {
  const prev = state.accounts;
  state.accounts = [{ id: "a1", name: "Commbank", type: "debit" }];
  try {
    const html = transactionAccountOptionsHtml("");
    assert.match(html, /<option value="" selected/);
    assert.ok(!html.includes("(deleted)"), html);
  } finally { state.accounts = prev; }
});

// ---------------- Picking a budget line out of a long list ----------------
// A year-old budget is forty-odd lines, and both selects that ask "which line is this?" used to
// list every one of them flat and in creation order. These assert the shape that replaced it:
// the Budget tab's own grouping, alphabetical inside each group, with the lines logged against
// most recently repeated at the top. The duplicate-option assertion is the one that matters —
// two options carrying `selected` is a different bug in every browser engine.
function withBudget(lines, transactions, fn){
  const prev = { shared: state.shared, home: state.home, properties: state.properties,
    transactions: state.transactions, categories: state.categories, budgetGroupBy: state.budgetGroupBy };
  state.shared = lines;
  state.home = {};
  state.properties = [];
  state.transactions = transactions || [];
  state.categories = ["Subscriptions", "Groceries", "Car"];
  state.budgetGroupBy = "category";
  try { return fn(); } finally { Object.assign(state, prev); }
}
function line(id, what, category){
  return { id, what, category, classification: "Needs", amount: 10, freq: "Monthly" };
}

test("budget-line options are grouped by the Budget tab's own axis", () => {
  const html = withBudget([line("e1", "Spotify", "Subscriptions"), line("e2", "Apples", "Groceries")],
    [], () => budgetLineOptgroupsHtml(""));
  assert.match(html, /<optgroup label="Subscriptions">/);
  assert.match(html, /<optgroup label="Groceries">/);
  assert.match(html, /value="e1"[^>]*>Spotify/);
});

test("lines sort alphabetically inside their group", () => {
  const html = withBudget([line("e1", "Zoo pass", "Subscriptions"), line("e2", "Apple TV", "Subscriptions")],
    [], () => budgetLineOptgroupsHtml(""));
  assert.ok(html.indexOf("Apple TV") < html.indexOf("Zoo pass"), html);
});

test("exactly one option is marked selected, even when it is listed twice", () => {
  // Nine lines so the list clears the cap that turns the "Recently used" group on, and two of
  // them logged against so that group has something to hold.
  const lines = [];
  for(let i = 0; i < 9; i++) lines.push(line("e" + i, "Line " + i, "Subscriptions"));
  const txns = [
    { id: "t1", date: "2026-09-01", amount: 5, linkedExpenseId: "e3" },
    { id: "t2", date: "2026-09-02", amount: 5, linkedExpenseId: "e4" }
  ];
  const html = withBudget(lines, txns, () => budgetLineOptgroupsHtml("e3"));
  assert.match(html, /<optgroup label="Recently used">/);
  assert.equal(html.split("Recently used").length - 1, 1, "one recents group, not one per category");
  assert.equal((html.match(/ selected>/g) || []).length, 1, "a select may carry exactly one selected option");
  // The line really is listed twice — that is the point of the recents group, not an accident.
  assert.equal((html.match(/value="e3"/g) || []).length, 2, html);
});

test("a short budget gets no Recently used group", () => {
  const html = withBudget([line("e1", "Spotify", "Subscriptions")],
    [{ id: "t1", date: "2026-09-01", amount: 5, linkedExpenseId: "e1" }],
    () => budgetLineOptgroupsHtml(""));
  assert.ok(!html.includes("Recently used"), html);
});

// ---------------- The quick-log sheet's search ----------------
test("the chip filter matches on name, category and type, folding accents", () => {
  const item = { id: "e1", what: "Café mornings", category: "Eating out", classification: "Wants" };
  assert.ok(lineMatchesFilter(item, "cafe"), "accent-folded");
  assert.ok(lineMatchesFilter(item, "MORN"), "case-folded");
  assert.ok(lineMatchesFilter(item, "eating"), "by category");
  assert.ok(lineMatchesFilter(item, "wants"), "by type");
  assert.ok(lineMatchesFilter(item, "   "), "a blank search hides nothing");
  assert.ok(!lineMatchesFilter(item, "petrol"));
});

test("categories are offered alphabetically, whatever order they were created in", () => {
  const prev = state.categories;
  state.categories = ["Utilities", "Car", "eating out"];
  try {
    assert.deepEqual(sortedCategories(), ["Car", "eating out", "Utilities"]);
    assert.deepEqual(state.categories, ["Utilities", "Car", "eating out"], "the stored order is left alone");
  } finally { state.categories = prev; }
});

test("the filter also matches what has been logged against a line before", () => {
  // The line is called "Rideshare & Taxi"; the word in the user's head is "uber". Once an Uber
  // has been logged against it, the line's own history answers for the name it doesn't have.
  const item = { id: "e9", what: "Rideshare & Taxi", category: "Transport", classification: "Wants" };
  const logged = { e9: ["uber trip home", "13cabs"] };
  assert.ok(!lineMatchesFilter(item, "uber"), "nothing in the name or category says uber");
  assert.ok(lineMatchesFilter(item, "uber", logged), "but its history does");
  assert.ok(!lineMatchesFilter(item, "lyft", logged));
});

// ---------------- Pasting an amount ----------------
// <input type="number"> reads back "" for anything that isn't a bare number literal, with no
// badInput flag to check — so a pasted "-$24.99" or a Unicode-minus "−24.99" looks right on
// screen and saves as 0. This parser runs on the clipboard text before it reaches the field.
test("a pasted amount survives currency symbols, spaces, commas and a Unicode minus", () => {
  assert.equal(parseAmountInput("-24.99"), -24.99);
  assert.equal(parseAmountInput("−24.99"), -24.99, "U+2212, what most keyboards and bank apps emit");
  assert.equal(parseAmountInput("-$24.99"), -24.99);
  assert.equal(parseAmountInput("  -24.99 "), -24.99);
  assert.equal(parseAmountInput("$1,299.00"), 1299);
  assert.equal(parseAmountInput("(24.99)"), -24.99, "accounting notation for a credit");
  assert.equal(parseAmountInput("+15"), 15);
  assert.equal(parseAmountInput(".5"), 0.5);
});

test("a pasted amount that is not a number at all returns null, not zero", () => {
  // null and 0 have to stay distinguishable: one means "leave the field alone", the other is a
  // legitimate amount someone typed.
  assert.equal(parseAmountInput("Running shoes"), null);
  assert.equal(parseAmountInput(""), null);
  assert.equal(parseAmountInput("   "), null);
  assert.equal(parseAmountInput("12.3.4"), null);
  assert.equal(parseAmountInput("0"), 0);
});

// ---------------- Logging a refund ----------------
// A refund is an ordinary transaction with a negative amount — every sum downstream reads
// `s + (Number(t.amount) || 0)` rather than clamping. What was missing was a way to *say* so from
// a phone: `inputmode="decimal"` gets the decimal keypad, which on Android and iOS alike has no
// minus key, so the sign has to come from a control rather than the keyboard.
//
// The sheet is normally driven through the DOM, so these stub just enough of document for
// renderQuickLogSheet() to no-op. What they assert is the rule the sheet is built on: the field
// carries the magnitude, the toggle carries the sign, and the two can never disagree.
if(typeof globalThis.document === "undefined"){
  globalThis.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
}

test("the Refund toggle signs the amount, whatever the field holds", () => {
  const prev = state.transactions;
  state.transactions = [];
  try {
    openQuickLog();
    setQuickLogSign(-1);
    const t = submitQuickLog(129.99, "Running shoes", "2026-09-21", "");
    assert.equal(t.amount, -129.99, "a refund is stored negative");
    closeQuickLog();
  } finally { state.transactions = prev; }
});

test("Spend is the default and stays positive", () => {
  const prev = state.transactions;
  state.transactions = [];
  try {
    openQuickLog();
    const t = submitQuickLog(42.5, "", "2026-09-21", "");
    assert.equal(t.amount, 42.5);
    closeQuickLog();
  } finally { state.transactions = prev; }
});

test("a negative typed into the field cannot disagree with the toggle", () => {
  // Belt and braces for the desktop path: app.js rewrites a typed "-45.50" to "45.50" and flips
  // the toggle, but even if a negative reached submitQuickLog directly, the magnitude is what is
  // read — so "Spend" never records a refund and "Refund" never records it twice over.
  const prev = state.transactions;
  state.transactions = [];
  try {
    openQuickLog();
    assert.equal(submitQuickLog(-45.5, "", "2026-09-21", "").amount, 45.5, "Spend means spend");
    setQuickLogSign(-1);
    assert.equal(submitQuickLog(-45.5, "", "2026-09-21", "").amount, -45.5, "and Refund means refund, once");
    closeQuickLog();
  } finally { state.transactions = prev; }
});

// ---------------- Refunding a specific past purchase ----------------
// A refund being a signed transaction against a budget *line* is enough for every total in the
// app to net out correctly, but it doesn't say which purchase came back — useful for its own sake
// when a line has more than one similarly-priced thing on it. quickLogRefundChipsHtml offers the
// line's recent purchases as tap-to-fill chips; picking one is purely a display/traceability link
// (`refundOf`), never required.

test("quickLogRefundChipsHtml lists a line's past purchases, newest first, only in Refund mode", () => {
  const prevShared = state.shared, prevTxns = state.transactions;
  state.shared = [{ id: "e1", what: "Clothes & Shoes", classification: "Wants", amount: 100, freq: "Monthly" }];
  state.transactions = [
    { id: "t1", date: "2026-08-01", amount: 89, linkedExpenseId: "e1" },
    { id: "t2", date: "2026-09-03", amount: 129.99, linkedExpenseId: "e1" }
  ];
  try {
    openQuickLog();
    setQuickLogLink("e1");
    const item = state.shared[0];
    assert.equal(quickLogRefundChipsHtml(item), "", "Spend mode offers nothing to refund");
    setQuickLogSign(-1);
    const html = quickLogRefundChipsHtml(item);
    assert.match(html, /Refunding which purchase/);
    assert.match(html, /data-qlog-refund-of="t2"/);
    assert.match(html, /data-qlog-refund-of="t1"/);
    assert.ok(html.indexOf("t2") < html.indexOf("t1"), "the more recent purchase is listed first");
    closeQuickLog();
  } finally { state.shared = prevShared; state.transactions = prevTxns; }
});

test("quickLogRefundChipsHtml stays empty for a one-off, or a line never logged against", () => {
  const prevShared = state.shared, prevTxns = state.transactions;
  state.shared = [{ id: "e1", what: "Clothes & Shoes", classification: "Wants", amount: 100, freq: "Monthly" }];
  state.transactions = [];
  try {
    openQuickLog();
    setQuickLogSign(-1);
    assert.equal(quickLogRefundChipsHtml(null), "", "no line — no bounded history to guess from");
    setQuickLogLink("e1");
    assert.equal(quickLogRefundChipsHtml(state.shared[0]), "", "line picked, but nothing on it yet");
    closeQuickLog();
  } finally { state.shared = prevShared; state.transactions = prevTxns; }
});

test("submitQuickLog tags a refund with the purchase it was told it undoes", () => {
  const prevShared = state.shared, prevTxns = state.transactions;
  state.shared = [{ id: "e1", what: "Clothes & Shoes", classification: "Wants", amount: 100, freq: "Monthly" }];
  state.transactions = [{ id: "t1", date: "2026-09-03", amount: 129.99, linkedExpenseId: "e1" }];
  try {
    openQuickLog();
    setQuickLogLink("e1");
    setQuickLogSign(-1);
    setQuickLogRefundOf("t1");
    const refund = submitQuickLog(129.99, "", "2026-09-21", "");
    assert.equal(refund.refundOf, "t1");
    assert.match(transactionSummaryText(refund), /refund of 2026-09-03's \$129\.99/);
    closeQuickLog();
  } finally { state.shared = prevShared; state.transactions = prevTxns; }
});

test("submitQuickLog never tags a plain spend, whatever refundOf was last left holding", () => {
  const prevShared = state.shared, prevTxns = state.transactions;
  state.shared = [{ id: "e1", what: "Clothes & Shoes", classification: "Wants", amount: 100, freq: "Monthly" }];
  state.transactions = [{ id: "t1", date: "2026-09-03", amount: 129.99, linkedExpenseId: "e1" }];
  try {
    openQuickLog();
    setQuickLogLink("e1");
    // setQuickLogSign(1) (Spend, the default) already clears refundOf on its own — this checks the
    // rule is also enforced at the point it actually matters, rather than trusted to have run.
    const spend = submitQuickLog(50, "", "2026-09-21", "");
    assert.equal(spend.refundOf, undefined);
    closeQuickLog();
  } finally { state.shared = prevShared; state.transactions = prevTxns; }
});

test("setQuickLogRefundOf toggles off on a second tap of the same chip", () => {
  openQuickLog();
  setQuickLogSign(-1);
  setQuickLogRefundOf("t1");
  assert.equal(quickLog.refundOf, "t1");
  setQuickLogRefundOf("t1");
  assert.equal(quickLog.refundOf, null, "a second tap of the same chip undoes the link");
  closeQuickLog();
});

test("transactionSummaryText says nothing extra when refundOf points at nothing (deleted, or never set)", () => {
  assert.doesNotMatch(transactionSummaryText({ date: "2026-09-21", amount: -50 }), /refund of/);
  const prevTxns = state.transactions;
  state.transactions = [];
  try {
    assert.doesNotMatch(
      transactionSummaryText({ date: "2026-09-21", amount: -50, refundOf: "gone" }),
      /refund of/,
      "a dangling refundOf (its target deleted) fails quietly rather than showing a broken label"
    );
  } finally { state.transactions = prevTxns; }
});

// v3.16.1 / v3.17.0 — the claim-date fields and the loan's borrowing-costs note.
import { borrowingNoteText } from "../src/components/properties.js";

test("a deductible row renders its claim-from/until fields", function(){
  var html = modernPlainRowHtml({ id: "r1", what: "Rent", amount: 720, freq: "Weekly", deductible: true, deductiblePct: 6.4, deductibleUntil: "2025-09-30" }, 0, "shared", {}, {});
  assert.match(html, /class="f-deductfrom"/);
  assert.match(html, /class="f-deductuntil" value="2025-09-30"/);
});

test("the borrowing-costs note says what's deductible, or what's missing", function(){
  assert.match(borrowingNoteText({ borrowingCosts: 0 }), /five years/);
  assert.match(borrowingNoteText({ borrowingCosts: 9800, settlementDate: "" }), /settlement date/);
  assert.match(borrowingNoteText({ borrowingCosts: 9800, settlementDate: "2024-11-15" }), /of \$9,800\.00 — spread to FY29\/30\./);
  assert.match(borrowingNoteText({ borrowingCosts: 80, settlementDate: "2024-11-15" }), /all in the year paid/);
});

// v3.21.0 — purchase lots.
import { lotsSectionHtml, lotsNoteText } from "../src/components/assets.js";

test("the purchase lots section renders its rows and a used lot can't be deleted", function(){
  var item = { quantity: 100, lots: [{ id: "a", date: "2023-02-10", units: 100, price: 1.5, brokerage: 3, soldUnits: 40 }] };
  var html = lotsSectionHtml(item, 0);
  assert.match(html, /class="lot-date"[^>]*value="2023-02-10"/);
  assert.match(html, /data-lot-del="0:0"[^>]*disabled/);
  assert.match(html, /40 of 100 sold/);
  assert.match(lotsNoteText(item), /60 unsold units across 1 lot — the holding shows 100/);
  assert.match(lotsSectionHtml({ lots: [] }, 0), /\+ Add lot/);
});

// v3.22.0 — annual tax statements.
import { statementsSectionHtml } from "../src/components/assets.js";

test("the annual tax statements section renders each statement's labelled fields", function(){
  var html = statementsSectionHtml({ taxStatements: [{ fy: 2025, m20: 205.30, o20: 30.80, units: 210 }] }, 3);
  assert.match(html, /20M Other net foreign income/);
  assert.match(html, /data-stmt-key="m20" value="205.3"/);
  assert.match(html, /data-stmt-del="3:0"/);
  assert.match(statementsSectionHtml({ taxStatements: [] }, 0), /\+ Add statement/);
});

// v3.26.0 — the tax return worksheet.
import { taxYearHtml, worksheetText, evidenceItems, setTaxYearSelected } from "../src/components/taxyear.js";
import { personYear } from "../src/calc/taxyear.js";

test("the worksheet renders a card per person with its refund and document rows", function(){
  var keep = { income: state.income, taxYears: state.taxYears, properties: state.properties, assets: state.assets };
  try {
    state.income = [{ what: "Pay", person: "Sam", incomeType: "Gross", amount: 100000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" }];
    state.properties = []; state.assets = []; state.taxYears = {};
    setTaxYearSelected(2025);
    personYear(2025, "Sam", true).incomeStatements = [{ payer: "Acme", gross: 100000, allowances: 0, withheld: 24000 }];
    var html = taxYearHtml();
    assert.match(html, /data-ty-card="Sam"/);
    assert.match(html, /Estimated (refund|to pay)/);
    assert.match(html, /data-ty-kind="is"[^>]*data-ty-key="payer"[^>]*value="Acme"/);
    assert.match(worksheetText("Sam"), /Acme — tax withheld: \$24,000\.00/);
    assert.ok(evidenceItems(2025).some(function(i){ return /income statement — Acme/.test(i.text); }));
  } finally { Object.assign(state, keep); }
});

// v3.28.0 — moving a loan cost out of Acquisition costs.
import { looksLikeLoanCost, moveAcquisitionCostToLoan } from "../src/components/properties.js";

test("loan-cost names are picked out, purchase costs aren't", function(){
  ["LMI", "Lenders mortgage insurance", "Mortgage registration", "Loan establishment fee", "Valuation fee", "Mortgage broker"].forEach(function(n){
    assert.equal(looksLikeLoanCost(n), true, n);
  });
  ["Stamp duty", "Conveyancing", "Transfer registration", "Buyer's agent", "Building inspection"].forEach(function(n){
    assert.equal(looksLikeLoanCost(n), false, n);
  });
});

test("moving a cost puts it on the loan, dates the loan, and undoes cleanly", function(){
  var p = { kind: "IP", purchaseDate: "2024-11-15", acquisitionCosts: [{ what: "Stamp duty", amount: 18400 }, { what: "LMI", amount: 9450 }],
    loans: [{ what: "Home loan", borrowingCosts: 350, settlementDate: "" }] };
  var m = moveAcquisitionCostToLoan(p, 1);
  assert.deepEqual(p.acquisitionCosts.map(function(c){ return c.what; }), ["Stamp duty"]);
  assert.equal(p.loans[0].borrowingCosts, 9800);
  assert.equal(p.loans[0].settlementDate, "2024-11-15");
  m.undo();
  assert.equal(p.acquisitionCosts.length, 2);
  assert.equal(p.loans[0].borrowingCosts, 350);
  assert.equal(p.loans[0].settlementDate, "");
});

// v3.31.0 — the worksheet's print copy.
import { taxYearPrintHtml } from "../src/components/taxyear.js";

test("the print copy is plain tables, a page per person, with the checklist", function(){
  var keep = { income: state.income, taxYears: state.taxYears, properties: state.properties, assets: state.assets };
  try {
    state.income = [{ what: "Pay", person: "Sam", incomeType: "Gross", amount: 100000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" }];
    state.properties = []; state.assets = []; state.taxYears = {};
    setTaxYearSelected(2025);
    personYear(2025, "Sam", true).incomeStatements = [{ payer: "Acme", gross: 100000, allowances: 0, withheld: 24000 }];
    var html = taxYearPrintHtml();
    assert.match(html, /<section class="pr-page"><h2>Sam — FY25\/26 tax return worksheet<\/h2>/);
    assert.match(html, /Acme — tax withheld<\/td><td class="pr-num">\$24,000\.00/);
    assert.match(html, /☐ Sam: income statement — Acme/);
    assert.doesNotMatch(html, /<input/);
  } finally { Object.assign(state, keep); }
});

test("projection milestones: round amounts, loans gone, and who overtakes whom", async function(){
  const { projectionMilestonesHtml } = await import("../src/components/projections.js");
  const pts = (ys, debt) => ys.map((y, x) => ({ x, y, debt: debt[x] }));
  const html = projectionMilestonesHtml([
    { label: "Renting", colorClass: "series-color-0", points: pts([300000, 600000, 900000, 1200000], [0, 0, 0, 0]) },
    { label: "Buy", colorClass: "series-color-1", points: pts([250000, 550000, 1000000, 1600000], [500000, 300000, 0, 0]) }
  ], true);
  assert.match(html, /Milestones/);
  assert.match(html, /\$500k<\/span><span>\$1M<\/span><span>\$1\.5M/);
  assert.match(html, /Buy<\/span><span>yr 1<\/span><span>yr 2<\/span><span>yr 3<\/span><span>yr 2<\/span>/);
  assert.match(html, /<i>none<\/i>/);
  assert.match(html, /<b>Buy<\/b> overtakes Renting in year 2/);
  assert.equal(projectionMilestonesHtml([], true), "");
});

test("benchmarks: how you compare, with and without an age", async function(){
  const { householdCompareHtml } = await import("../src/components/benchmarks.js");
  const html = householdCompareHtml({
    people: [{ name: "Alex", age: 37, super: 140000, hasSuper: true }, { name: "Sam", age: null, super: 50000, hasSuper: true }],
    oldestAge: 37, netWorth: 600000, totalSuper: 190000, couple: true, savingsRate: 0.2,
    housing: { share: 0.25, ref: 0.199, tenure: "renters" }, scenario: "Renting"
  });
  assert.match(html, /Alex's super <small>age 37/);
  assert.match(html, /2\.1× the median for ages 35–39/);
  assert.match(html, /Add Sam's date of birth/);
  assert.match(html, /\$730,000 ASFA says a couple/);
  assert.match(html, /the average household led by someone 35–39/);
  assert.match(html, /Australian households saved 6\.5%/);
  assert.match(html, /Australian renters spent 19\.9%/);
  assert.match(householdCompareHtml({ people: [], oldestAge: null, netWorth: 0, totalSuper: 0, couple: false, savingsRate: null, housing: null }), /Add income, super/);
});

test("benchmarks: investments against an index, prices missing then present", async function(){
  const { investmentsHtml } = await import("../src/components/benchmarks.js");
  const base = { symbol: "IOZ", today: "2026-10-18", flows: [{ date: "2024-01-02", amount: -10000 }], value: 12000, invested: 10000, withdrawn: 0,
    included: ["VAS"], excluded: ["Old"], firstDate: "2024-01-02", myRate: 0.068, fixedRate: 0.07, fixedValue: 12100, dates: ["2024-01-02"], prices: {} };
  const missing = investmentsHtml(Object.assign({}, base, { index: { missing: ["2024-01-02", "today"] }, indexRate: null }));
  assert.match(missing, /IOZ prices — 2 of 2 still needed/);
  assert.match(missing, /data-bm-price="2024-01-02"/);
  assert.match(missing, /Not included \(no purchase lots\): Old/);
  const done = investmentsHtml(Object.assign({}, base, { index: { value: 12600, units: 300 }, indexRate: 0.09, prices: { "2024-01-02": 33.3, now: 42 } }));
  assert.match(done, /Same money in IOZ/);
  assert.match(done, /\$600 behind IOZ<\/b>/);
  assert.match(investmentsHtml(Object.assign({}, base, { flows: [] })), /Add purchase lots/);
});

test("benchmarks: targets with progress, statuses and the add form", async function(){
  const { targetsHtml } = await import("../src/components/benchmarks.js");
  const html = targetsHtml({ scenario: "Renting", categories: ["Dining", "Groceries"], goals: [
    { goal: { kind: "savingsRate", target: 0.25 }, progress: { current: 0.2, target: 0.25, pct: 0.8, status: "behind" } },
    { goal: { kind: "netWorth", target: 1000000, by: "2030-06-30" }, progress: { current: 500000, target: 1000000, pct: 0.5, status: "on-track", projected: 1100000 } },
    { goal: { kind: "categorySpend", category: "Dining", target: 800 }, progress: { current: 900, target: 800, pct: 1.125, status: "over", pace: 400 } }
  ]});
  assert.match(html, /Savings rate<\/span><span class="goal-status ">Not yet/);
  assert.match(html, /value="25" aria-label="Target %"/);
  assert.match(html, /Renting projects \$1,100,000 by then/);
  assert.match(html, /Dining <small>per month<\/small>/);
  assert.match(html, /goal-status bad">Over/);
  assert.match(html, /<option value="Groceries">Groceries<\/option>/);
  assert.match(targetsHtml({ scenario: "R", categories: [], goals: [] }), /Set targets of your own/);
});

test("benchmarks: property against its suburb", async function(){
  const { propertyMarketHtml } = await import("../src/components/benchmarks.js");
  const html = propertyMarketHtml({ properties: [{ id: "p1", name: "1 Example St", kind: "IP", value: 630000, purchaseDate: "2025-03-01", hasPurchase: true,
    mine: { growthPa: 0.08, yield: 0.041, rentWeekly: 500 }, market: { suburb: "Springfield QLD", growthPa: 6.5, rentWeekly: 550 },
    cmp: { growth: { mine: 0.08, market: 0.065, diff: 0.015 }, rent: { mine: 500, market: 550, ratio: 500 / 550 } } }] });
  assert.match(html, /1 Example St/);
  assert.match(html, /value="Springfield QLD"/);
  assert.match(html, /ahead of the suburb by 1\.5% a year/);
  assert.match(html, /9\.1% below the median rent/);
  assert.match(html, /data-pm-field="yield" value=""/);
  assert.match(propertyMarketHtml({ properties: [] }), /Add a property/);
});

test("distributions received: rows, note and add button", async function(){
  const { payoutsSectionHtml, payoutsNoteText } = await import("../src/components/assets.js");
  const item = { what: "VAS", payouts: [{ date: "2026-01-15", cash: 120.5, credit: 51.64 }] };
  const html = payoutsSectionHtml(item, 3);
  assert.match(html, /Distributions received \(1\)/);
  assert.match(html, /class="po-cash" data-payout-index="0" value="120.5"/);
  assert.match(html, /data-payout-del="3:0"/);
  assert.match(payoutsNoteText(item), /1 payment: \$120\.50 cash \+ \$51\.64 franking credits/);
  assert.match(payoutsSectionHtml({ payouts: [] }, 0), /Log each dividend/);
});

test("if you sold: inputs, the sums and each owner's share", async function(){
  const { saleWhatIfHtml } = await import("../src/components/properties.js");
  const html = saleWhatIfHtml({ id: "p1" }, { growthPct: 5, inputs: { date: "2027-06-30", price: "", agentPct: 2.5, otherCosts: 2500 },
    result: { salePrice: 700000, sellingCosts: 20000, loanPayout: 400000, cashBeforeTax: 280000, paid: 457000, capitalWorksReduction: 12000,
      gain: 235000, discount: true, fy: 2026, cashAfterTax: 240000,
      owners: [{ name: "Alex", share: 0.7, gain: 164500, assessable: 82250, tax: 30000, loss: 0, cash: 166000 }, { name: "Sam", share: 0.3, gain: 70500, assessable: 35250, tax: 10000, loss: 0, cash: 74000 }] } });
  assert.match(html, /data-sale-field="price" value="" placeholder="700000"/);
  assert.match(html, /today's value grown at 5% a year/);
  assert.match(html, /Less capital works claimed<\/span><b>−\$12,000/);
  assert.match(html, /Alex <small>70%/);
  assert.match(html, /Taxable, after the 50% discount<\/span><b>\$82,250/);
  assert.match(html, /Total cash after tax<\/span><b>\$240,000/);
  assert.match(html, /Taxed in FY26\/27/);
});

test("Returns offers Print; Documents offers Import a year and the checklist", async function(){
  const { taxYearHtml, taxDocumentsHtml, setTaxYearSelected } = await import("../src/components/taxyear.js");
  var keep = { income: state.income, taxYears: state.taxYears, properties: state.properties, assets: state.assets };
  try {
    state.income = [{ what: "Pay", person: "Sam", incomeType: "Gross", amount: 100000, freq: "Yearly", superMode: "On top", sacrificeMode: "none" }];
    state.properties = []; state.assets = []; state.taxYears = {};
    setTaxYearSelected(2025);
    var ret = taxYearHtml(), docs = taxDocumentsHtml();
    assert.match(ret, /data-ty-print[^>]*>Print \/ save as PDF/);
    assert.doesNotMatch(ret, /data-ty-import/);
    assert.match(docs, /data-ty-import[^>]*>Import a year<\/button>/);
    assert.match(docs, /class="ty-yearnote" id="taxDocsYearSelect"><b>FY25\/26<\/b>/);
    assert.match(docs, /To keep for FY25\/26 <span class="ty-docs-count">0 of 0<\/span>/);
  } finally { Object.assign(state, keep); (await import("../src/calc/ledger.js")).setPeriod(null, ""); }
});

test("loan strategy: four cards with results, and the IP note", async function(){
  const { loanStrategyHtml } = await import("../src/components/properties.js");
  const html = loanStrategyHtml({ id: "p1", kind: "IP", loans: [{ what: "Home loan", balance: 400000, rate: 6.2, termYears: 25, repaymentType: "PI", offsetBalance: 0,
    strategy: { extra: 300, offsetAdd: 20000, newRate: 6.7, refiRate: 5.8, refiCosts: 1500, cashback: 0 } }] });
  assert.match(html, /a month · paid off in 25y 0m/);
  assert.match(html, /sooner<\/b>, <b>\$[\d,]+<\/b> less interest/);
  assert.match(html, /<b>\$1,240<\/b> a year less interest/);
  assert.match(html, /Repayments up <b>\$1\d\d<\/b> a month/);
  assert.match(html, /Pays back the \$1,500 net switching cost in <b>\d+ months?<\/b>/);
  assert.match(html, /Offset keeps the options/);
  assert.match(loanStrategyHtml({ id: "p", kind: "IP", loans: [] }), /Add a loan with a balance/);
});

test("super top-up: the room as a placeholder, and the sums", async function(){
  const { topUpHtml } = await import("../src/components/income.js");
  const keep = state.tax;
  try {
    state.tax = Object.assign({}, keep || {}, { settings: { Sam: { topUpAmount: 0 } } });
    const html = topUpHtml("Sam", { capAvailable: 30000, totalConcessional: 18000, taxable: 150000, div293Income: 168000, fy: 2026 });
    assert.match(html, /placeholder="12000"/);
    assert.match(html, /back at tax time · \$10,200 into super · costs you/, "12,000 less 15% contributions tax");
    assert.match(html, /class="tax-topup-how help"/, "how it works sits behind the ⓘ");
    assert.match(topUpHtml("Sam", { capAvailable: 30000, totalConcessional: 30000, taxable: 1, fy: 2026 }), /class="tax-topup" hidden/);
  } finally { state.tax = keep; }
});

test("People tab: a card per person with their details and where they're used", async function(){
  const { peopleHtml } = await import("../src/components/people.js");
  var keep = { income: state.income, tax: state.tax, properties: state.properties, assets: state.assets };
  try {
    state.income = [{ what: "Pay", person: "Sam", incomeType: "Gross", amount: 80000, freq: "Yearly" }];
    state.tax = Object.assign({}, state.tax, { settings: { Sam: { dateOfBirth: "1990-06-02", helpBalance: 1200, concessionalCap: 30000, carryForward: 0, wfhHours: { 2025: 410 } } } });
    state.properties = [{ id: "x", what: "2 Sample Rd", ownership: { Sam: 100 } }]; state.assets = [];
    var html = peopleHtml("2026-10-18");
    assert.match(html, /data-pp-card="Sam"/);
    assert.match(html, /class="pp-age">36</);
    assert.match(html, /1 income row · 100% of 2 Sample Rd/);
    assert.match(html, /class="pp-in pp-help"[^>]*value="1200"/);
    assert.match(html, /data-fy="2025"[^>]*value="410"/);
    assert.match(html, /data-pp-remove="Sam"/);
    state.income = [];
    assert.match(peopleHtml("2026-10-18"), /Nobody yet/);
  } finally { Object.assign(state, keep); }
});

test("rows: a property cost picks its return line; a budget line can be claimed against a property", async function(){
  const lt = await import("../src/lib/ledger-table.js");
  const { RENT_EXPENSE_LINES, rentLineFor } = await import("../src/calc/taxyear.js");
  const { claimedHereHtml } = await import("../src/components/properties.js");
  lt.setRentLinesProvider(function(){ return { lines: RENT_EXPENSE_LINES, lineFor: rentLineFor }; });
  lt.setDeductionPeopleProvider(function(){ return ["Alex", "Sam"]; });
  lt.setDeductionPropertiesProvider(function(){ return [{ id: "r1", what: "9 Sample Ave" }]; });
  try {
    var prop = lt.modernPlainRowHtml({ what: "Pest inspection", amount: 240, freq: "Yearly" }, 0, "propexp:r1", {}, { showClass: true });
    assert.match(prop, /<label>Return line<\/label><select class="f-rentline"[^>]*>[\s\S]*<option value="pestControl" selected>Pest control/);
    assert.doesNotMatch(prop, /f-deductible/, "no second, personal claim on a property's own cost");
    var line = lt.modernPlainRowHtml({ what: "Landlord insurance", amount: 900, freq: "Yearly", deductible: true, claimProperty: "r1" }, 0, "shared", {}, { showClass: true });
    assert.match(line, /<optgroup label="Investment property"><option value="property:r1" selected>9 Sample Ave<\/option>/);
    assert.match(line, /class="m-edit-field f-deduct-extra f-claim-prop"><label>Rental schedule line/);
    assert.match(line, /class="m-edit-field f-deduct-extra f-claim-person" hidden><label>Return label/);
    var gone = lt.modernPlainRowHtml({ what: "Old", amount: 1, freq: "Yearly", deductible: true, claimProperty: "zz" }, 0, "shared", {}, {});
    assert.match(gone, /value="property:zz" selected>\(deleted property\)/);
    var note = claimedHereHtml({ id: "r1" }, [{ what: "Landlord insurance", amount: 900, freq: "Yearly", deductible: true, claimProperty: "r1" }]);
    assert.match(note, /Also claimed here from your budget: <b>Landlord insurance<\/b> \$900\/yr/);
    assert.equal(claimedHereHtml({ id: "r2" }, []), "");
  } finally {
    lt.setRentLinesProvider(null); lt.setDeductionPeopleProvider(null); lt.setDeductionPropertiesProvider(null);
  }
});

test("Received: a row per target with its bar and status; the sheet offers every target", async function(){
  const { receivedPanelHtml, openReceivedSheet, receivedSheetHtml, toggleReceivedRow, closeReceivedSheet } = await import("../src/components/received.js");
  var keep = { income: state.income, properties: state.properties, assets: state.assets, incomeLog: state.incomeLog };
  try {
    state.income = [{ id: "i1", what: "Tutoring", incomeType: "Net", amount: 400, freq: "Monthly" }];
    state.properties = []; state.assets = [];
    state.incomeLog = [{ id: "in1", date: "2026-10-03", amount: 300, what: "Week 1-3", target: "income:i1" }];
    var html = receivedPanelHtml("2026-10");
    assert.match(html, /data-rcv-key="income:i1"/);
    assert.match(html, /<b>\$300<\/b> of \$400/);
    assert.match(html, /style="width:75\.0%"/);
    assert.match(html, /−\$100 short/);
    toggleReceivedRow("income:i1");
    assert.match(receivedPanelHtml("2026-10"), /2026-10-03 · Week 1-3<\/span><b>\$300\.00<\/b>/);
    toggleReceivedRow("income:i1");
    openReceivedSheet("income:i1");
    var sheet = receivedSheetHtml();
    assert.match(sheet, /data-rcv-chip="income:i1" aria-pressed="true">Tutoring/);
    assert.match(sheet, /placeholder="400\.00"/);
    closeReceivedSheet();
    state.income = [];
    assert.match(receivedPanelHtml("2026-10"), /Add an income row/);
  } finally { Object.assign(state, keep); }
});

test("worksheet: statements link to an income row and are checked; deductions listed line by line", async function(){
  const { taxYearHtml, setTaxYearSelected } = await import("../src/components/taxyear.js");
  const { setDeductibleItemsProvider } = await import("../src/calc/tax.js");
  var keep = { income: state.income, taxYears: state.taxYears, properties: state.properties, assets: state.assets };
  try {
    state.income = [{ id: "p1", what: "Pay", person: "Sam", incomeType: "Gross", amount: 80000, freq: "Yearly", superMode: "On top" }];
    state.properties = []; state.assets = [];
    state.taxYears = { 2025: { people: { Sam: { incomeStatements: [{ payer: "Employer A", incomeId: "p1", gross: 78000, withheld: 15000 }], interest: [], deductions: [] } } } };
    setDeductibleItemsProvider(function(){ return [{ id: "d1", what: "Union fees", amount: 520, freq: "Yearly", deductible: true, deductiblePerson: "Sam" }]; });
    setTaxYearSelected(2025);
    var html = taxYearHtml();
    assert.match(html, /data-ty-key="incomeId"[^>]*>[\s\S]*?<option value="p1" selected>Pay<\/option>/);
    assert.match(html, /Employer A: the plan expected <b>\$80,000<\/b> from Pay — statement is \$2,000 lower/);
    assert.match(html, /data-ty-uselines="Sam" checked/);
    assert.match(html, /data-ty-line="d1" data-ty-person="Sam" checked>.*Union fees <small>D5<\/small><\/span><b>\$520\.00<\/b>/);
    state.taxYears = {};
    assert.match(taxYearHtml(), /data-ty-fill="Sam"/);
  } finally { setDeductibleItemsProvider(null); Object.assign(state, keep); }
});

test("Close the year and Checks render", async function(){
  const { closeYearHtml } = await import("../src/components/taxyear.js");
  const { healthHtml, healthSummaryText } = await import("../src/components/health.js");
  var keep = { properties: state.properties, taxYears: state.taxYears, transactions: state.transactions };
  try {
    state.properties = [{ id: "r1", what: "9 Sample Ave", kind: "IP", income: [{ what: "Rent", amount: 500, freq: "Weekly" }], expenses: [], loans: [] }];
    state.taxYears = { 2024: { people: {}, evidence: {}, lodged: {}, properties: { r1: { lines: { rent: 27300 } } } } };
    state.transactions = [];
    var html = closeYearHtml(2024, "2026-10-18");
    assert.match(html, /Close FY24\/25 — the plan against what happened/);
    assert.match(html, /data-cy-rent="r1" data-cy-key="rent" checked>.*Rental income<\/span><span class="cy-num">\$26,000<\/span><span class="cy-num">\$27,300<\/span><span class="cy-diff up">\+\$1,300/);
    assert.match(html, /data-cy-apply="2024"/);
    assert.equal(closeYearHtml(2026, "2026-10-18"), "", "not for a year that isn't over");
    var checks = [{ id: "x", severity: "bad", title: "One line claimed by nobody", detail: "“Laptop”", where: { page: "expenses", sub: "budget" } }, { id: "y", severity: "info", title: "Tip", detail: "d", where: {} }];
    var h = healthHtml(checks);
    assert.match(h, /class="hc-item hc-bad" data-hc-id="x"/);
    assert.match(h, /data-hc-page="expenses" data-hc-sub="budget">Open the budget/);
    assert.equal(healthSummaryText(checks), "1 to fix · 1 to look at");
    assert.match(healthHtml([]), /every check passes/);
  } finally { Object.assign(state, keep); }
});

test("tax card: the payslip check asks, then answers", async function(){
  const { withholdingCheckHtml, withholdingCheckText } = await import("../src/components/income.js");
  const { currentTaxFy } = await import("../src/calc/tax.js");
  var keep = { income: state.income, tax: state.tax, properties: state.properties, assets: state.assets, taxYears: state.taxYears };
  try {
    state.income = [{ id: "a", what: "Pay", person: "Sam", incomeType: "Gross", amount: 90000, freq: "Yearly", superMode: "On top" }];
    state.properties = []; state.assets = []; state.taxYears = {};
    state.tax = Object.assign({}, state.tax, { settings: { Sam: {} } });
    assert.match(withholdingCheckHtml("Sam"), /class="tax-ytd-asof"/);
    assert.match(withholdingCheckText("Sam"), /Type the year-to-date figures/);
    var fy = currentTaxFy();
    state.tax.settings.Sam.ytd = { asOf: fy + "-12-31", gross: 45000, withheld: 12000 };
    assert.match(withholdingCheckText("Sam"), /withheld against <b>\$[\d,]+<\/b> of tax — heading for a <b class="up">\$[\d,]+ refund<\/b>/);
    state.tax.settings.Sam.ytd = { asOf: (fy - 1) + "-12-31", gross: 45000, withheld: 12000 };
    assert.match(withholdingCheckText("Sam"), /from outside FY/);
  } finally { Object.assign(state, keep); }
});

test("Before 30 June lists each person's moves, or says there are none", async function(){
  const { juneMovesHtml } = await import("../src/components/junemoves.js");
  var keep = { income: state.income, assets: state.assets, properties: state.properties, taxYears: state.taxYears, tax: state.tax };
  try {
    state.income = [{ id: "p", what: "Pay", person: "Sam", incomeType: "Gross", amount: 120000, freq: "Yearly", superMode: "On top" }];
    state.assets = []; state.properties = []; state.taxYears = {};
    state.tax = Object.assign({}, state.tax, { sgRate: 12, settings: { Sam: { concessionalCap: 30000, carryForward: 0 } } });
    var html = juneMovesHtml("2027-05-20");
    assert.match(html, /<b>41 days<\/b> until FY26\/27 ends/);
    assert.match(html, /class="jm-move jm-super"><div class="jm-head"><b>Super: \$15,600 of cap room left<\/b><span class="jm-saves">about \$[\d,]+ less tax/);
    state.tax.settings.Sam.concessionalCap = 14400;
    assert.match(juneMovesHtml("2027-05-20"), /Nothing worth doing this year/);
  } finally { Object.assign(state, keep); }
});

test("Projections: Plan / Actuals control explains itself either way", async function(){
  const { projSourceHtml } = await import("../src/components/projections.js");
  var off = projSourceHtml({ available: false, months: 2 }, "actuals");
  assert.match(off, /data-proj-source="plan" aria-pressed="true"/);
  assert.match(off, /data-proj-source="actuals" aria-pressed="false" disabled/);
  assert.match(off, /Actuals need 3 months of income received and spending logged — 2 so far/);
  var on = projSourceHtml({ available: true, months: 4, incomeRatio: 0.96, spendRatio: 0.95, incomeLines: 1, spendLines: 1,
    incomeReceivedMonthly: 4800, spendLoggedMonthly: 950, incomePlannedMonthly: 5000, spendPlannedMonthly: 1000 }, "actuals");
  assert.match(on, /data-proj-source="actuals" aria-pressed="true"/);
  assert.match(on, /income 96% of plan, spending 95% — \$150\/mo worse\. Lines with nothing logged stay as planned/);
});

test("Home → Review: a first-time intro, then one step at a time with progress", async function(){
  const { monthReviewHtml, setReviewStep, dismissReviewIntro } = await import("../src/components/monthreview.js");
  var keep = { income: state.income, incomeLog: state.incomeLog, transactions: state.transactions, accounts: state.accounts, monthReviews: state.monthReviews, properties: state.properties, assets: state.assets, debts: state.debts };
  try {
    state.income = [{ id: "t", what: "Tutoring", incomeType: "Net", amount: 300, freq: "Monthly" }];
    state.incomeLog = []; state.transactions = []; state.properties = []; state.debts = []; state.monthReviews = {};
    state.assets = [{ id: "c1", what: "Pot", category: "Cash", amount: 50, history: [{ date: "2026-09-10", value: 50 }] }];
    state.accounts = [{ name: "Card One", type: "credit", statementStartDay: 1 }, { name: "Bank One", type: "savings", link: "asset:c1" }];
    var intro = monthReviewHtml("2026-09", "2026-10-03");
    assert.match(intro, /<h2>September 2026<\/h2>/);
    assert.match(intro, /data-mr-intro-ok>Start the review/);
    dismissReviewIntro();
    var html = monthReviewHtml("2026-09", "2026-10-03");
    assert.match(html, /Step 1 of 5<\/div><h3>Did the money you expected arrive\?<\/h3>/);
    assert.match(html, /data-mr-log="income:t"/);
    assert.match(html, /data-mr-to="1">Skip for now/);
    setReviewStep(1);
    assert.match(monthReviewHtml("2026-09", "2026-10-03"), /data-mr-statement="Card One"/);
    setReviewStep(2);
    var bal = monthReviewHtml("2026-09", "2026-10-03");
    assert.match(bal, /1 balance was last updated before the month ended/);
    assert.match(bal, /data-mr-go="accounts"/);
    setReviewStep(4);
    var sum = monthReviewHtml("2026-09", "2026-10-03");
    assert.match(sum, /<h3>How did the month go\?<\/h3>/);
    assert.match(sum, /data-mr-done="2026-09">Mark September 2026 reviewed/);
    assert.match(sum, /class="mr-step-dot is-current is-todo" data-mr-to="4"/);
  } finally { Object.assign(state, keep); }
});

test("Home summary: net worth, the month, bills and to-dos", async function(){
  const { homeSummaryHtml, upcomingBills } = await import("../src/components/home.js");
  var keep = { netWorthLog: state.netWorthLog, transactions: state.transactions, lastBackupDate: state.lastBackupDate, monthReviews: state.monthReviews, income: state.income, incomeLog: state.incomeLog };
  try {
    state.netWorthLog = [{ date: "2026-08-01", value: 100000 }, { date: "2026-10-01", value: 104000 }];
    state.transactions = [{ id: "x", date: "2026-09-20", amount: 80, linkedExpenseId: "e1" }];
    state.income = []; state.incomeLog = []; state.monthReviews = {}; state.lastBackupDate = "";
    var items = [{ id: "e1", what: "Phone", amount: 80, freq: "Monthly" }];
    var bills = upcomingBills(items, state.transactions, "2026-10-14", 14);
    assert.deepEqual(bills.map(function(b){ return b.what + "@" + b.due; }), ["Phone@2026-10-20"]);
    var html = homeSummaryHtml("2026-10-14", { netWorth: 105000, items: items, todos: [{ text: "Review September 2026", go: "dashboard", sub: "review", tone: "warn" }] });
    assert.match(html, /<b class="home-big">\$105,000<\/b>/);
    assert.match(html, /\+\$5,000 since 1 Aug/);
    assert.match(html, /Phone<\/span><em class="">20 Oct<\/em><b>\$80<\/b>/);
    assert.match(html, /data-home-go="dashboard" data-home-sub="review">Review September 2026/);
  } finally { Object.assign(state, keep); }
});

test("the period button and menu render the selected year and its months", async function(){
  const { periodMenuHtml, periodButtonHtml } = await import("../src/components/period.js");
  const { setPeriod } = await import("../src/calc/ledger.js");
  var keep = state.yearBasis;
  try {
    state.yearBasis = "financial";
    setPeriod(2023, "2023-09", "2025-03-10");
    var btn = periodButtonHtml("2025-03-10");
    assert.match(btn, /FY23\/24 · Sep/);
    assert.match(btn, /not today/);
    var menu = periodMenuHtml("2025-03-10", "2022-08-01");
    assert.match(menu, /data-period-year="2024"[^>]*>FY24\/25 <small>now<\/small>/);
    assert.match(menu, /class="period-chip active" aria-pressed="true" data-period-year="2023"/);
    assert.match(menu, /data-period-year="2022"/);
    assert.doesNotMatch(menu, /data-period-year="2021"/);
    assert.match(periodMenuHtml("2025-03-10", null), /data-period-year="2022"/);
    assert.match(menu, /class="period-chip active" data-period-month="2023-09"/);
    assert.match(menu, /data-period-month="2024-06"/);
    assert.match(menu, /data-period-today>Back to today/);
    setPeriod(null, "", "2025-03-10");
    assert.doesNotMatch(periodButtonHtml("2025-03-10"), /not today/);
    assert.match(periodMenuHtml("2025-03-10", null), /data-period-month="2025-04" disabled/);
  } finally { state.yearBasis = keep; setPeriod(null, ""); }
});

test("Accounts page: grouped cards with balances, a card's available limit, and loose balances", async function(){
  const { accountsPageHtml, openAccounts } = await import("../src/components/accounts.js");
  var keep = { accounts: state.accounts, assets: state.assets, debts: state.debts, properties: state.properties };
  try {
    state.assets = [{ id: "as1", what: "Savings pot", category: "Cash", amount: 4200, history: [{ date: "2026-09-01", value: 4000 }, { date: "2026-10-01", value: 4200 }] }];
    state.debts = [{ id: "d1", what: "Card", balance: 700, history: [] }, { id: "d2", what: "Car loan", balance: 9000 }];
    state.properties = [];
    state.accounts = [{ id: "a1", name: "Bank One", type: "savings", link: "asset:as1" }, { id: "a2", name: "Fern Card", type: "credit", statementStartDay: 3, limit: 5000, link: "debt:d1" }, { id: "a3", name: "Spare", type: "everyday", link: "" }];
    openAccounts.a2 = true;
    var html = accountsPageHtml("2026-10-18");
    assert.match(html, /Bank accounts/);
    assert.match(html, /Credit cards/);
    assert.match(html, /\$4,200/);
    assert.match(html, /−\$700/);
    assert.match(html, /\$4,300 of \$5,000 available/);
    assert.match(html, /no balance/);
    assert.match(html, /class="acct-mgmt-limit"[^>]*value="5000"/);
    assert.match(html, /data-acct-adopt="debt:d2" data-acct-adopt-type="loan"/);
    assert.match(html, /<span>Owed on cards and loans<\/span><b class="owed">−\$9,700/);
  } finally { Object.assign(state, keep); }
});

test("property Tax tab: the year's rental result line by line, and each owner's share", async function(){
  const { propertyTaxTabHtml, propertyTabsFor } = await import("../src/components/properties.js");
  var p = { id: "p9", what: "1 Example St", kind: "IP", ownership: {}, income: [{ what: "Rent", amount: 2000, freq: "Monthly" }], expenses: [{ what: "Rates", amount: 2400, freq: "Yearly" }], loans: [] };
  var html = propertyTaxTabHtml(p);
  assert.match(html, /Rent<\/span><b>\$24,000/);
  assert.match(html, /Expenses<\/span><b>−\$2,400/);
  assert.match(html, /Net rental income<\/span><b>\$21,600/);
  assert.deepEqual(propertyTabsFor(p).map(function(t){ return t.key; }), ["overview", "loans", "income", "tax", "sale"]);
  assert.deepEqual(propertyTabsFor({ kind: "PPOR" }).map(function(t){ return t.key; }), ["overview", "loans", "income"]);
});

test("Keeping your data safe: backups, the folder option and the passcode", async function(){
  const { safekeepingHtml } = await import("../src/components/safekeeping.js");
  var keep = state.lastBackupDate;
  try {
    state.lastBackupDate = "2026-08-01";
    var html = safekeepingHtml(null, "2026-10-18");
    assert.match(html, /78 days ago, worth making a new one/);
    assert.match(html, /data-sk="export"/);
    assert.match(html, /Needs Chrome or Edge/, "no folder API under Node");
    assert.match(html, /data-sk="pass-set">Set a passcode/);
    assert.match(html, /doesn.t encrypt/);
    assert.match(html, /data-sk="file-open">Open a backup file/);
  } finally { state.lastBackupDate = keep; }
});

test("year-end pack: the year's status steps and the hand-off buttons", async function(){
  const { yearEndHtml, yearEndStatus } = await import("../src/components/yearend.js");
  const { setPeriod } = await import("../src/calc/ledger.js");
  var keep = { monthReviews: state.monthReviews, transactions: state.transactions, taxYears: state.taxYears, yearBasis: state.yearBasis };
  try {
    state.yearBasis = "financial";
    state.monthReviews = { "2025-07": { done: "2025-08-02" }, "2025-08": { done: "2025-09-01" } };
    state.transactions = [{ date: "2025-09-10", amount: 20 }, { date: "2026-08-01", amount: 5 }];
    state.taxYears = {};
    setPeriod(2025, "");
    var st = yearEndStatus(2025, "2026-10-18");
    assert.equal(st.over, true);
    assert.equal(st.months, 12);
    assert.equal(st.reviewed, 2);
    assert.equal(st.transactions, 1);
    var html = yearEndHtml("2026-10-18");
    assert.match(html, /FY25\/26 is over/);
    assert.match(html, /2 of 12 months marked reviewed/);
    assert.match(html, /data-ye-print>Print the pack/);
    assert.match(html, /Transactions \(CSV\) · 1/);
  } finally { Object.assign(state, keep); setPeriod(null, ""); }
});

test("Checks list: Looks right on each, and the hidden ones with Show again", async function(){
  const { healthHtml } = await import("../src/components/health.js");
  var html = healthHtml([{ id: "x1", severity: "warn", title: "Two lines look entered twice", detail: "“Gym”", where: { page: "expenses", sub: "budget" } }], [{ id: "x2", severity: "warn", title: "A card limit" }]);
  assert.match(html, /data-hc-dismiss="x1">Looks right/);
  assert.match(html, /1 marked “looks right”/);
  assert.match(html, /data-hc-undismiss="x2">Show again/);
  assert.match(healthHtml([], []), /Nothing to fix/);
});

test("Plan → Retirement: asks for an age, then answers with levers and links", async function(){
  const { retirementHtml } = await import("../src/components/retirement.js");
  var keep = state.fire;
  try {
    state.fire = { currentAge: null, retireAge: null, preservationAge: 60 };
    assert.match(retirementHtml("2026-10-18"), /Type your age/);
    state.fire = { currentAge: 40, retireAge: null, preservationAge: 60 };
    var html = retirementHtml("2026-10-18");
    assert.match(html, /What changes it/);
    assert.match(html, /data-rt="retireAge"/);
    assert.match(html, /Super cap room this year/);
    // v3.139.0: the headline says which kind of age it is.
    assert.match(html, /9 runs (of|in) 10|same return every year|not before 75/);
  } finally { state.fire = keep; }
});

test("First-run setup: every step renders and the last offers the import", async function(){
  const { startFirstRun, firstRun, firstRunHtml } = await import("../src/components/firstrun.js");
  startFirstRun();
  firstRun.answers.people[0].name = "Alex";
  var html = "";
  for(var i = 0; i < 5; i++){ firstRun.step = i; html = firstRunHtml(); assert.match(html, /role="dialog"/); }
  assert.match(html, /data-fr-finish="import"/);
});

test("Investments → Shares: the price sheet card and its template", async function(){
  const { priceSheetCardHtml } = await import("../src/components/pricesheet.js");
  const { priceSheetGrid } = await import("../src/lib/backup.js");
  var keepA = state.assets, keepP = state.priceSheet;
  try {
    state.assets = [{ category: "Shares", what: "Fern Fund", symbol: "FRN", market: "ASX", quantity: 10, lots: [] }, { category: "Shares", what: "Coin", symbol: "BTC", market: "Crypto", quantity: 0.1 }];
    state.priceSheet = { url: "https://docs.google.com/spreadsheets/d/abc/edit", lastRead: "", lastResult: { ok: true, at: "2026-02-01T00:00:00Z", updated: 2, backfilled: 10, backfilledHoldings: 2, notFound: [], unreadable: [] }, backfillFrom: "" };
    var html = priceSheetCardHtml();
    assert.match(html, /data-ps-copy/);
    assert.match(html, /2 prices updated/);
    var grid = priceSheetGrid("2024-02-01");
    assert.deepEqual(grid[0].slice(0, 2), ["Symbol", "Price"]);
    assert.equal(grid[0][3], "FRN");
    assert.match(grid[1][3], /GOOGLEFINANCE\("ASX:FRN","close",DATE\(2024,2,1\),TODAY\(\),"WEEKLY"\)/);
    assert.match(grid[1][5], /CURRENCY:BTCUSD","price"/);
    assert.equal(grid[2][1], '=GOOGLEFINANCE("BTCUSD")', "a crypto price takes no attribute");
    assert.equal(grid[1][1], '=GOOGLEFINANCE("ASX:FRN","price")');
  } finally { state.assets = keepA; state.priceSheet = keepP; }
});

test("Cash flow → Spending → Trips: the card lists trips and offers the move", async function(){
  const { tripsCardHtml } = await import("../src/components/trips.js");
  var keep = { trips: state.trips, shared: state.shared, transactions: state.transactions };
  try {
    state.shared = [{ id: "trips", what: "Trips", freq: "Yearly", irregular: true, amount: 1000 }, { id: "cafe", what: "Coffee", freq: "Weekly", irregular: true, amount: 20 }];
    state.trips = [{ id: "t1", name: "Coast", from: "2026-03-10", to: "2026-03-13", lineId: "trips" }];
    state.transactions = [{ id: "a", date: "2026-03-11", amount: 6, linkedExpenseId: "cafe" }];
    var html = tripsCardHtml();
    assert.match(html, /Coast/);
    assert.match(html, /data-trip-move="t1"[^>]*>Move 1 here/);
    assert.match(html, /data-trip-add/);
  } finally { Object.assign(state, keep); }
});

test("Property → rent panel: the statement form and the year's statements", async function(){
  const { rentPanelHtml } = await import("../src/components/properties.js");
  var p = { id: "p1", what: "1 Example St", kind: "IP", income: [{ what: "Rent", amount: 500, freq: "Weekly" }], expenses: [{ id: "wr", what: "Water rates" }],
    agentStatements: [{ id: "x", date: "2026-08-01", rent: 2000, water: 0, fees: 120, waterRates: 0, others: [], net: 1880, txIds: [] }] };
  var html = rentPanelHtml(p, "2026-09-01");
  assert.match(html, /Log a property manager statement/);
  assert.match(html, /data-as="waterRates"/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test("Reports → Month in detail renders a month and an empty one", async function(){
  const { monthDetailHtml, monthDetailUi } = await import("../src/components/monthdetail.js");
  var keep = { transactions: state.transactions, incomeLog: state.incomeLog };
  try {
    state.transactions = [{ id: "a", date: "2026-03-04", amount: 42, what: "Fern Cafe", linkedExpenseId: null, category: "Eating out" }];
    state.incomeLog = [{ id: "i", date: "2026-03-25", amount: 3000, target: "net:Alex" }];
    monthDetailUi.ym = "2026-03";
    var html = monthDetailHtml();
    assert.match(html, /March 2026/);
    assert.match(html, /What was different/);
    assert.match(html, /data-md-cat="Eating out"/);
    assert.doesNotMatch(html, /NaN|undefined/);
    monthDetailUi.ym = "2020-01";
    assert.match(monthDetailHtml(), /Nothing logged for January 2020/);
  } finally { Object.assign(state, keep); }
});

test("Reports → Net worth check builds a row per month", async function(){
  const { buildReport } = await import("../src/calc/reports.js");
  var rep = buildReport("nwcheck", { today: "2026-03-15" });
  assert.equal(rep.rows.length, 12);
  assert.equal(rep.rows[11].ym, "2026-03");
  assert.match(rep.rows[11].cells.month, /so far/);
});

// v3.107.0: a property's Overview reads as a summary first.
import { propertySummaryHtml } from "../src/components/properties.js";
test("propertySummaryHtml summarises a property, and skips what isn't known", () => {
  const ip = { id: "p1", what: "1 Example St", kind: "IP", value: 600000, purchasePrice: 500000, purchaseDate: "2022-03-01", landValue: 250000, state: "QLD",
    history: [{ date: "2026-01-31", value: 590000 }, { date: "2026-04-30", value: 600000 }], acquisitionCosts: [{ amount: 18000 }],
    loans: [{ what: "Loan A", balance: 400000, rate: 6, termYears: 30, repaymentType: "IO", offsetBalance: 20000 }],
    income: [{ amount: 520, freq: "Weekly" }], expenses: [{ amount: 2000, freq: "Yearly" }], pmFee: { percent: 0, flat: 0 }, ownership: {} };
  const html = propertySummaryHtml(ip);
  assert.match(html, /<dt>Value<\/dt><dd>\$600,000/);
  assert.match(html, /up \$10,000 since/);
  assert.match(html, /\$400,000 owed/);
  assert.match(html, /\$520\/wk/);
  assert.doesNotMatch(html, /NaN|undefined/);
  const bare = propertySummaryHtml({ id: "p2", what: "Home", kind: "PPOR", value: 0, history: [], loans: [], income: [], expenses: [] });
  assert.match(bare, /not recorded yet/);
  assert.doesNotMatch(bare, /<dt>Loans<\/dt>|<dt>Rent<\/dt>|NaN|undefined/);
});

// v3.108.0: a closed row carries its form in a <template>; an open row has it inline.
import { modernPlainRowHtml as plainRow } from "../src/lib/ledger-table.js";
test("a closed row's edit form is a template until the row opens", () => {
  const item = { id: "l1", what: "Groceries", amount: 120, freq: "Weekly", classification: "Needs" };
  const closed = plainRow(item, 0, "shared", {}, { showClass: true });
  assert.match(closed, /<template class="m-row-edit-tpl"><div class="m-row-edit">/);
  assert.match(closed, /class="f-amount"/, "the form is still there, inert, for when it opens");
  const open = plainRow(item, 0, "shared", { "shared:0": true }, { showClass: true });
  assert.doesNotMatch(open, /<template/);
  assert.match(open, /<div class="m-row open"[^>]*>.*<div class="m-row-edit">/s);
});

// v3.109.0: long lists put what's over plan first and stop at a handful.
import { capList } from "../src/components/expenses.js";
import { rulesShown } from "../src/components/rules.js";
test("capList: over-plan first, most over first, then by size; capped unless shown in full", () => {
  const e = [{ k: "a", size: 50, over: 0 }, { k: "b", size: 10, over: 30 }, { k: "c", size: 90, over: -5 }, { k: "d", size: 20, over: 80 }];
  for (let i = 0; i < 10; i++) e.push({ k: "x" + i, size: i, over: 0 });
  const r = capList(e, 3, false);
  assert.deepEqual(r.shown.map(x => x.k), ["d", "b", "c"]);
  assert.equal(r.hidden, e.length - 3);
  assert.equal(capList(e, 3, true).hidden, 0);
  assert.equal(capList(e.slice(0, 5), 3, false).hidden, 0, "two over the cap isn't worth a button");
});
test("rulesShown finds by words or line, and sorts by use, newest or A–Z", () => {
  const rules = [{ match: "fern cafe", hits: 2, linkedExpenseId: "l1" }, { match: "bright energy", hits: 9 }, { match: "acme", hits: 0, account: "Credit Card" }];
  const label = r => r.linkedExpenseId === "l1" ? "Eating out" : "";
  assert.deepEqual(rulesShown(rules, label, { q: "", sort: "used" }).map(x => x.i), [1, 0, 2]);
  assert.deepEqual(rulesShown(rules, label, { q: "", sort: "new" }).map(x => x.i), [2, 1, 0]);
  assert.deepEqual(rulesShown(rules, label, { q: "", sort: "az" }).map(x => x.r.match), ["acme", "bright energy", "fern cafe"]);
  assert.deepEqual(rulesShown(rules, label, { q: "eating", sort: "used" }).map(x => x.i), [0]);
  assert.deepEqual(rulesShown(rules, label, { q: "credit", sort: "used" }).map(x => x.i), [2]);
});

// v3.117.0: the transaction table.
import { txGridHtml } from "../src/components/cashflow.js";
test("txGridHtml puts editable spending rows, read-only money in and an entry row in one table", () => {
  const tx = [{ date: "2026-10-01", what: "", amount: 42.5, linkedExpenseId: "g", account: "Card" }];
  const html = txGridHtml([
    { kind: "out", ref: 0, date: "2026-10-01", label: "Groceries", amount: 42.5 },
    { kind: "in", date: "2026-10-02", label: "Pay", amount: 1000, account: "Everyday" }
  ], { transactions: tx, lineOptions: id => '<option value="g"' + (id === "g" ? " selected" : "") + '>Groceries</option>', accountOptions: a => '<option>' + a + '</option>', today: "2026-10-05", picking: true });
  assert.match(html, /<tr class="txg-new">/);
  assert.match(html, /class="tx-amount" data-tx-index="0" value="42.5"/);
  assert.match(html, /placeholder="Groceries"/);
  assert.match(html, /txg-ro txg-in.*\+\$1,000\.00/s);
  assert.match(html, /data-cf-pick="0"/);
  assert.doesNotMatch(html, /undefined|NaN/);
});

import { lifeEventsHtml } from "../src/components/lifeevents.js";
test("life events: the empty list and a filled one", () => {
  const keep = state.lifeEvents;
  try {
    state.lifeEvents = [];
    assert.match(lifeEventsHtml("2026-10-27"), /Nothing dated yet/);
    state.lifeEvents = [{ id: "e1", kind: "child", what: "Baby", year: 2028, years: 18, amount: 15000 }, { id: "e2", kind: "lump", what: "Sale", year: 2030, amount: 50000 }];
    const h = lifeEventsHtml("2026-10-27");
    assert.match(h, /data-le-id="e1"/); assert.match(h, /value="Baby"/);
    assert.equal((h.match(/data-le-field="years"/g) || []).length, 1); // a one-off has no length
  } finally { state.lifeEvents = keep; }
});

import { netWorthPageHtml } from "../src/components/networth.js";
test("net worth page: groups with their totals, each row to its detail page", () => {
  const keep = { a: state.assets, p: state.properties, d: state.debts };
  try {
    state.assets = [{ id: "a1", what: "Savings", category: "Cash", amount: 20000 }]; state.properties = []; state.debts = [{ id: "d1", what: "Card", balance: 500 }];
    const h = netWorthPageHtml();
    assert.match(h, /nw-group/); assert.match(h, /data-detail="asset" data-detail-id="a1"/); assert.match(h, /data-detail="debt"/);
    state.assets = []; state.debts = [];
    assert.match(netWorthPageHtml(), /Nothing here yet/);
  } finally { state.assets = keep.a; state.properties = keep.p; state.debts = keep.d; }
});

import { autoPricesCardHtml, autoPricesResultText } from "../src/components/autoprices.js";
test("the automatic prices card, before and after a read", () => {
  const keep = state.autoPrices;
  try {
    state.autoPrices = { on: true, crypto: true, fx: true, lastRead: "", lastResult: null };
    assert.match(autoPricesCardHtml(), /data-ap="crypto"/); assert.match(autoPricesCardHtml(), /Not read yet/);
    state.autoPrices.lastResult = { ok: true, at: "2026-10-27T00:00:00Z", updated: 3, fx: true, missing: ["ZZZ"], problems: [], fileDate: "2026-10-24" };
    assert.match(autoPricesResultText(state.autoPrices.lastResult), /3 prices updated \(closes of 2026-10-24\) · USD → AUD refreshed · not in the price file: ZZZ/);
    state.autoPrices.on = false;
    assert.doesNotMatch(autoPricesCardHtml(), /data-ap="crypto"/);
  } finally { state.autoPrices = keep; }
});

test("the transfer form opens filled in for a card repayment", async function(){
  const { transferFormHtml, transferForm } = await import("../src/components/cashflow.js");
  var keep = state.accounts;
  try {
    state.accounts = [{ name: "Everyday", type: "everyday" }, { name: "Card A", type: "credit" }];
    transferForm.preset = { from: "Everyday", to: "Card A", amount: 321.5, what: "Card A repayment" };
    var html = transferFormHtml("2026-10-28");
    assert.match(html, /data-tf="from">[^]*?<option value="Everyday" selected>/);
    assert.match(html, /data-tf="to">[^]*?<option value="Card A" selected>/);
    assert.match(html, /data-tf="amount"[^>]*value="321.5"/);
    transferForm.preset = null;
    assert.doesNotMatch(transferFormHtml("2026-10-28"), / selected>/);
  } finally { state.accounts = keep; transferForm.preset = null; }
});

test("statements waiting in the Statements folder are listed, or where to put them", async function(){
  const { inboxNoteHtml } = await import("../src/components/bank-import.js");
  assert.equal(inboxNoteHtml([], []), "");
  assert.match(inboxNoteHtml([], ["your Dropbox app folder"]), /Statements<\/b> folder in your Dropbox app folder/);
  var files = [1, 2, 3, 4].map(function(i){ return { name: "Bank One " + i + ".csv", label: "Dropbox" }; });
  var html = inboxNoteHtml(files, ["your Dropbox app folder"]);
  assert.match(html, /4 statements are waiting in Dropbox → Statements/);
  assert.match(html, /and 1 more/);
  assert.match(html, /data-inbox-next/);
  assert.match(inboxNoteHtml(files.slice(0, 1), []), /Review it/);
});

test("the statement under review is named, not offered again", async function(){
  const { inboxNoteHtml } = await import("../src/components/bank-import.js");
  var files = [{ name: "a.csv", label: "Dropbox" }, { name: "b.csv", label: "Dropbox" }];
  var html = inboxNoteHtml(files, [], files[0]);
  assert.match(html, /Reviewing <b>a.csv<\/b>/);
  assert.match(html, /One more is waiting/);
  assert.doesNotMatch(html, /data-inbox-next/);
});

test("the merge question lists each thing changed on both devices, this device's ticked", async function(){
  const { mergeDialogHtml } = await import("../src/components/syncmerge.js");
  const html = mergeDialogHtml([
    { id: "accounts/id:a1/balance", top: "accounts", row: { name: "Everyday" }, field: "balance", ours: 150, theirs: 175 },
    { id: "transactions/id:t2", top: "transactions", row: { what: "Fern Café", amount: 7 }, field: null, ours: { what: "Fern Café", amount: 7 }, theirs: undefined }
  ], "Dropbox");
  assert.match(html, /2 things/);
  assert.match(html, /Accounts · Everyday · balance/);
  assert.match(html, /value="ours" data-merge-id="accounts\/id:a1\/balance" checked/);
  assert.match(html, /Deleted/);
  assert.match(html, /data-merge-ok/);
});

test("transfer accounts come grouped by kind, and a card paid from a loan gets a word", async function(){
  const { transferAccountOptionsHtml, transferHint } = await import("../src/components/cashflow.js");
  const accounts = [{ name: "Home loan", type: "loan" }, { name: "Home loan offset", type: "offset" }, { name: "Card A", type: "credit", autoPayFrom: "Home loan offset" }, { name: "Everyday", type: "everyday" }];
  const html = transferAccountOptionsHtml(accounts, "Home loan offset");
  assert.match(html, /<optgroup label="Everyday & savings"><option value="Everyday">/);
  assert.match(html, /<optgroup label="Offsets"><option value="Home loan offset" selected>/);
  assert.match(html, /<optgroup label="Loans"><option value="Home loan">/);
  assert.match(transferHint("Home loan", "Card A", accounts, []), /That's a loan[^]*usually paid from Home loan offset/);
  assert.match(transferHint("Everyday", "Card A", accounts, []), /direct debit from Home loan offset/);
  assert.equal(transferHint("Home loan offset", "Card A", accounts, []), "");
  assert.equal(transferHint("Everyday", "Home loan offset", accounts, []), "");
});

test("a Check's fix can ask for an amount first", async function(){
  const { healthHtml } = await import("../src/components/health.js");
  const html = healthHtml([{ id: "card-unlogged:Card A:2026-10-21", severity: "info", title: "Card A repayment on 21 Oct 2026 isn't logged", detail: "…",
    where: { page: "expenses", sub: "bills", label: "Open Bills" }, fix: { label: "Save repayment", kind: "card-log", arg: "Card A|2026-10-21", amount: 432.1, amountLabel: "Statement balance $" } }], []);
  assert.match(html, /Statement balance \$<\/span><input type="number"[^>]*data-hc-fix-amount value="432.1">/);
  assert.match(html, /data-hc-fix="card-log" data-hc-fix-arg="Card A\|2026-10-21">Save repayment/);
  assert.match(html, />Open Bills</);
});

test("under a person's own Income card a row doesn't repeat their name", async function(){
  const { incomeRowLabel } = await import("../src/components/income.js");
  assert.equal(incomeRowLabel({ syntheticNetFor: "Alex", what: "Alex — Net income (after tax & super)" }), "Net income (after tax & super)");
  assert.equal(incomeRowLabel({ syntheticRefundFor: "Alex", person: "Alex", what: "Alex — Tax refund (rental loss)" }), "Tax refund (rental loss)");
  assert.equal(incomeRowLabel({ person: "Alex", what: "Salary" }), "Salary");
  assert.equal(incomeRowLabel({ what: "Sam — gift" }), "Sam — gift", "household rows keep theirs");
});

test("the budget plan's money in shows pay that ends with its end date", async function(){
  const { budgetPlanHtml } = await import("../src/components/cashflow.js");
  const html = budgetPlanHtml({ income: [{ label: "Net income", monthly: 5000 }, { label: "Site allowance (after tax) — until 31 Dec 2026", monthly: 210 }], groups: [{ label: "Needs", monthly: 3000 }], net: 2210 });
  assert.match(html, /Site allowance \(after tax\) — until 31 Dec 2026/);
});

test("the budget plan shows tax to pay at lodgement as money out of the year", async function(){
  const { budgetPlanHtml } = await import("../src/components/cashflow.js");
  const html = budgetPlanHtml({ income: [{ label: "Net income", monthly: 5000 }, { label: "Alex — tax to pay at lodgement", monthly: -100, oneOff: true }], groups: [{ label: "Needs", monthly: 3000 }] });
  assert.match(html, /tax to pay at lodgement<\/span><b>−\$100/);
});

test("take-home a little over by an after-tax payment says so", async function(){
  const { afterTaxInPay } = await import("../src/components/received.js");
  var keep = state.income;
  try {
    state.income = [{ id: "p1", what: "Phone reimbursement", person: "Alex", incomeType: "Net", amount: 30, freq: "Monthly" }];
    assert.equal(afterTaxInPay("Alex", 28.4).what, "Phone reimbursement");
    assert.equal(afterTaxInPay("Alex", 120), null);
    assert.equal(afterTaxInPay("Sam", 28.4), null);
  } finally { state.income = keep; }
});

test("pay that stops says what take-home drops by, on its own row", async function(){
  const { endingNoteHtml } = await import("../src/components/income.js");
  var keep = state.income;
  try {
    state.income = [{ id: "a1", what: "Site allowance", person: "Alex", incomeType: "Gross", amount: 400, freq: "Monthly", endDate: "2026-12-31" },
      { syntheticEndingFor: "a1", computed: true, incomeType: "Net", person: "Alex", amount: -210.4, freq: "Monthly", startDate: "2027-01-01" }];
    assert.match(endingNoteHtml(state.income[0]), /Take-home −\$210\/mo after tax from then/);
    assert.equal(endingNoteHtml({ id: "x", endDate: "2026-12-31" }), "");
  } finally { state.income = keep; }
});

test("the take-home row shows the payslip's net pay, with after-tax payments into the same account", async function(){
  const { payslipNetLine } = await import("../src/components/income.js");
  var keep = state.income;
  try {
    state.income = [{ id: "s1", what: "Salary", person: "Alex", incomeType: "Gross", amount: 7000, freq: "Monthly", account: "Bank One" },
      { id: "p1", what: "Phone reimbursement", person: "Alex", incomeType: "Net", amount: 30, freq: "Monthly", account: "Bank One" },
      { id: "o1", what: "Side work", person: "Alex", incomeType: "Net", amount: 200, freq: "Monthly", account: "Other bank" },
      { syntheticNetFor: "Alex", computed: true, incomeType: "Net", amount: 5300.4, freq: "Monthly" }];
    assert.equal(payslipNetLine(state.income[3]), "Net pay on the payslip: $5,330/mo, with Phone reimbursement");
    // v3.152.1: in the period Income is shown in.
    const { setIncomeShowAs } = await import("../src/components/income.js");
    setIncomeShowAs("week");
    try { assert.equal(payslipNetLine(state.income[3]), "Net pay on the payslip: $1,230/wk, with Phone reimbursement"); } finally { setIncomeShowAs("month"); }
    assert.equal(payslipNetLine(state.income[0]), "");
  } finally { state.income = keep; }
});

test("a Gross row shows what it comes to after tax under its gross figure; the take-home sits under the rows", async function(){
  const { afterTaxHtml, takeHomeLineHtml, resetAfterTaxCache } = await import("../src/components/income.js");
  const { recalcComputedItems } = await import("../src/calc/engine.js");
  var keep = { income: state.income, properties: state.properties };
  try {
    state.properties = [];
    state.income = [{ id: "s1", what: "Salary", person: "Alex", incomeType: "Gross", amount: 7000, freq: "Monthly", superMode: "On top", sacrificeMode: "none", sacrificeValue: 0, account: "Bank One" },
      { id: "b1", what: "Bonus", person: "Alex", incomeType: "Gross", amount: 6000, freq: "Yearly", irregular: true, dueMonth: 9, superMode: "On top", sacrificeMode: "none", sacrificeValue: 0 }];
    recalcComputedItems(); resetAfterTaxCache();
    assert.match(afterTaxHtml(state.income[0]), /class="m-row-after">\$[\d,]+\/mo after tax</);
    assert.match(afterTaxHtml(state.income[1]), /after tax<br>\(\$[\d,]+ in Sep\)/);
    assert.match(takeHomeLineHtml("Alex"), /Take-home pay[^]*\$[\d,]+\.\d\d\/mo/);
  } finally { Object.assign(state, keep); recalcComputedItems(); }
});

test("take-home logged as the same round figure most months is pointed out", async function(){
  const { roundTakeHome } = await import("../src/components/received.js");
  var keep = state.incomeLog;
  try {
    state.incomeLog = [["2026-07-14", 6000], ["2026-08-13", 6000], ["2026-09-17", 6300], ["2026-10-15", 6000]].map(function(x, i){ return { id: "r" + i, target: "net:Sam", date: x[0], amount: x[1] }; });
    assert.equal(roundTakeHome("Sam"), 6000);
    state.incomeLog[3].amount = 6012.40;
    assert.equal(roundTakeHome("Sam"), null, "an exact figure is a payslip's");
  } finally { state.incomeLog = keep; }
});

test("What this household has: three choices per part, and Net worth's way back in (item 191)", async function(){
  const { partsSettingsHtml, hiddenPartsLineHtml } = await import("../src/components/parts.js");
  var renter = { properties: [], assets: [], parts: {} };
  var html = partsSettingsHtml(renter);
  assert.equal((html.match(/data-part-set="property"/g) || []).length, 3);
  assert.match(html, /Right now: no — none added yet/);
  assert.match(partsSettingsHtml({ properties: [], assets: [], parts: { shares: "on" } }), /data-part-set="shares" data-part-value="on" aria-pressed="true"/);
  var line = hiddenPartsLineHtml(renter);
  assert.match(line, /data-part-show="property"/);
  assert.match(line, /data-part-show="shares"/);
  assert.equal(hiddenPartsLineHtml({ properties: [{ id: "p" }], assets: [{ category: "Shares" }], parts: {} }), "", "nothing hidden, nothing to say");
});

test("Your first month: the month's three figures and one next step (item 192)", async function(){
  const { firstMonthHtml } = await import("../src/components/dashboard.js");
  const { setupProgress } = await import("../src/lib/setup.js");
  var st = { income: [], shared: [], assets: [], properties: [], transactions: [], scenarios: ["Renting"], activeScenario: "Renting", home: { Renting: [] } };
  var html = firstMonthHtml(st, setupProgress(st), true);
  assert.match(html, /Your first month/);
  assert.match(html, /step 1 of 4/);
  assert.match(html, /data-setup-go="expenses" data-setup-sub="income"/);
  assert.equal((html.match(/data-setup-go=/g) || []).length, 1, "one next step, not a list");
  assert.match(html, /Look around with sample data/);
});

test("the review queue: one card, keep and change, then the rule question (item 193)", async function(){
  const { txReviewHtml, txReview, reviewBannerHtml } = await import("../src/components/reviewqueue.js");
  var keep = state.transactions;
  try {
    state.transactions = [{ id: "t1", date: "2026-09-04", what: "FERN CAFE EXAMPLE TOWN", amount: 18.5, category: "Eating out", reviewed: false }];
    txReview.open = true; txReview.mode = "card"; txReview.choice = null;
    var html = txReviewHtml();
    assert.match(html, /1 to go/);
    assert.match(html, /data-txr-keep/);
    assert.match(html, /data-txr-change/);
    assert.match(html, /Counts against<\/span> Eating out/);
    txReview.mode = "change";
    assert.match(txReviewHtml(), /data-txr-line/);
    txReview.mode = "rule"; txReview.choice = { linkedExpenseId: null, category: "Eating out" };
    assert.match(txReviewHtml(), /Always file <b>/);
    assert.match(reviewBannerHtml(), /1<\/b> new transaction to review/);
    state.transactions = [];
    txReview.mode = "card";
    assert.match(txReviewHtml(), /All reviewed/);
    assert.equal(reviewBannerHtml(), "");
  } finally { state.transactions = keep; txReview.open = false; txReview.mode = "card"; txReview.choice = null; }
});

test("Budget grouped Flexible: three totals, what's left, a Roll over per category (item 194)", async function(){
  const { flexSummaryHtml } = await import("../src/components/expenses.js");
  var keep = { shared: state.shared, transactions: state.transactions, rollover: state.rollover };
  try {
    state.shared = [{ id: "g", what: "Groceries", category: "Groceries", classification: "Needs", freq: "Weekly", amount: 150 },
      { id: "r", what: "Electricity", category: "Utilities", classification: "Needs", freq: "Monthly", amount: 160 }];
    state.transactions = []; state.rollover = {};
    var html = flexSummaryHtml();
    assert.match(html, /Fixed bills/);
    assert.match(html, /Non-monthly/);
    assert.match(html, /data-rollover="Groceries"/);
    assert.match(html, / left<\/b>/);
  } finally { state.shared = keep.shared; state.transactions = keep.transactions; state.rollover = keep.rollover; }
});
