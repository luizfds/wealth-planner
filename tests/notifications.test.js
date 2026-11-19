import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state, setState } from "../src/state.js";
// v3.298: notifications and advice are kept until the household changes (state.js stateVersion: every save and
// replacement). These tests change it in place, so each read first says so, as a save would.
const changed = () => setState(state);
import { staleAssetNamesList, getLocalNotifications } from "../src/lib/notifications.js";

function findStaleAssetNotification(notifications){
  return notifications.find(function(n){ return n.type === "stale-asset"; });
}
// The "needs a fresh entry" nudge — not "Review <month>" (review:YYYY-MM), which also has type
// "review" and shows until that month is reviewed, so a test run found it instead.
function findReviewNotification(notifications){
  return notifications.find(function(n){ return n.type === "review" && !/^review:\d{4}-\d{2}$/.test(n.id); });
}

test("staleAssetNamesList formats never-logged and days-ago entries and joins them", function(){
  var text = staleAssetNamesList([
    { what: "Cash Savings", days: null },
    { what: "Super", days: 45 }
  ]);
  assert.equal(text, "Cash Savings (never logged), Super (45d ago)");
});

test("getLocalNotifications emits one stale-asset notification per asset when there's just one", function(){
  var prevAssets = state.assets;
  state.assets = [{ what: "Cash Savings", category: "Cash", amount: 1000, history: [] }];
  var stale = findStaleAssetNotification((changed(), getLocalNotifications()));
  assert.ok(stale);
  assert.equal(stale.title, "Cash Savings hasn't been logged recently");
  assert.equal(stale.detail, "Never logged a value");
  state.assets = prevAssets;
});

test("getLocalNotifications groups multiple stale assets into one notification, not one each", function(){
  var prevAssets = state.assets;
  state.assets = [
    { what: "Cash Savings", category: "Cash", amount: 1000, history: [] },
    { what: "Super", category: "Super", amount: 200000, history: [] },
    { what: "Toyota Corolla", category: "Vehicle", amount: 20000, history: [] }
  ];
  var notifications = (changed(), getLocalNotifications());
  var staleOnes = notifications.filter(function(n){ return n.type === "stale-asset"; });
  assert.equal(staleOnes.length, 1);
  assert.equal(staleOnes[0].title, "3 assets haven't been logged recently");
  assert.ok(staleOnes[0].detail.indexOf("Cash Savings") !== -1);
  assert.ok(staleOnes[0].detail.indexOf("Toyota Corolla") !== -1);
  state.assets = prevAssets;
});

test("getLocalNotifications caps the grouped stale-asset detail at 3 names, plus a count of the rest", function(){
  var prevAssets = state.assets;
  state.assets = ["A", "B", "C", "D", "E"].map(function(name){
    return { what: name, category: "Other", amount: 100, history: [] };
  });
  var stale = findStaleAssetNotification((changed(), getLocalNotifications()));
  assert.equal(stale.title, "5 assets haven't been logged recently");
  assert.ok(stale.detail.indexOf("and 2 more") !== -1);
  assert.equal(stale.detail.split(",").length, 3); // exactly A, B, C named before "and 2 more"
  state.assets = prevAssets;
});

test("getLocalNotifications skips the 'needs a fresh entry' review nudge for an item marked irregular", function(){
  var prevShared = state.shared, prevTx = state.transactions;
  state.shared = [{ id: "exp1", what: "Extras / Misc", amount: 100, freq: "Monthly", irregular: true }];
  state.transactions = [];
  assert.equal(findReviewNotification((changed(), getLocalNotifications())), undefined);
  state.shared = prevShared;
  state.transactions = prevTx;
});

test("getLocalNotifications still nudges a non-irregular item with the same never-logged shape", function(){
  var prevShared = state.shared, prevTx = state.transactions;
  state.shared = [{ id: "exp1", what: "Groceries", amount: 100, freq: "Monthly", irregular: false }];
  state.transactions = [];
  var review = findReviewNotification((changed(), getLocalNotifications()));
  assert.ok(review);
  assert.equal(review.title, "Groceries needs a fresh entry");
  state.shared = prevShared;
  state.transactions = prevTx;
});

// ---------------- One line, one notification ----------------
// A recurring line that is both behind on logging and due within DUE_SOON_DAYS used to produce
// two notifications: its own "Due <date> · $X" and a seat in the grouped "N budget lines need a
// fresh entry". On a test household's data that was 2 of 7 notifications being repeats of lines
// already listed. They were never independent facts — not having logged the last one is *why* the
// next occurrence has come around — so the due-bill notification now carries both and the review
// group stays quiet about that line.
function daysAgo(n){
  var d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}
function withShared(shared, transactions, fn){
  var prevShared = state.shared, prevTx = state.transactions, prevAssets = state.assets;
  state.shared = shared;
  state.transactions = transactions;
  state.assets = [];
  try { fn(); } finally {
    state.shared = prevShared; state.transactions = prevTx; state.assets = prevAssets;
  }
}

test("a line that is both due soon and behind gets one notification, not two", function(){
  withShared(
    [{ id: "exp1", what: "Transport", amount: 50, freq: "Weekly", irregular: false }],
    [{ id: "t1", date: daysAgo(13), amount: 50, linkedExpenseId: "exp1" }],
    function(){
      var all = (changed(), getLocalNotifications());
      var bills = all.filter(function(n){ return n.type === "duebill"; });
      assert.equal(bills.length, 1);
      assert.equal(findReviewNotification(all), undefined, "must not also sit in the review group");
      // The fact the review group used to carry has to survive on the one that remains.
      assert.equal(bills[0].severity, "bad");
      assert.match(bills[0].detail, /still isn't logged/);
    });
});

test("a line due soon but logged on time says nothing about being behind", function(){
  withShared(
    [{ id: "exp1", what: "Transport", amount: 50, freq: "Weekly", irregular: false }],
    [{ id: "t1", date: daysAgo(3), amount: 50, linkedExpenseId: "exp1" }],
    function(){
      var bills = (changed(), getLocalNotifications()).filter(function(n){ return n.type === "duebill"; });
      assert.equal(bills.length, 1);
      assert.equal(bills[0].severity, "warn");
      assert.ok(!/still isn't logged/.test(bills[0].detail), bills[0].detail);
    });
});

test("a line behind but not yet due soon stays in the review group", function(){
  withShared(
    // Monthly, last logged 40 days ago: one occurrence already missed (so behind), but the next
    // lands ~20 days out, well past DUE_SOON_DAYS — so nothing speaks for it except the group.
    [{ id: "exp1", what: "Council Rates", amount: 300, freq: "Monthly", irregular: false }],
    [{ id: "t1", date: daysAgo(40), amount: 300, linkedExpenseId: "exp1" }],
    function(){
      var all = (changed(), getLocalNotifications());
      assert.equal(all.filter(function(n){ return n.type === "duebill"; }).length, 0);
      var review = findReviewNotification(all);
      assert.ok(review, "the group is the only thing that can report this line");
      assert.match(review.title, /Council Rates/);
    });
});

// v3.131.0: the review nudge agrees with the list it sends you to.
test("a bill paid from a card isn't nagged for an entry — Review expenses doesn't list it either", function(){
  var prevAcc = state.accounts;
  state.accounts = [{ id: "c1", name: "Card One", type: "credit" }];
  try {
    withShared(
      [{ id: "exp1", what: "Streaming", amount: 20, freq: "Monthly", irregular: false, account: "Card One" }],
      [{ id: "t1", date: daysAgo(45), amount: 20, linkedExpenseId: "exp1", account: "Card One" }],
      function(){
        assert.equal(findReviewNotification((changed(), getLocalNotifications())), undefined);
      });
  } finally { state.accounts = prevAcc; }
});

// #415: Cash flow's header no longer carries "N bills to confirm" — the bell, Home's To do and the page's line do,
// and tapping it opens the confirm sheet (action "catchup"). A line never logged still asks for its first entry.
test("a bill that fell due with nothing logged is a To do that opens the confirm sheet; a never-logged line is not", function(){
  var prev = { shared: state.shared, transactions: state.transactions, accounts: state.accounts, transfers: state.transfers };
  var d = new Date(); d.setDate(d.getDate() - 40);
  var lastPaid = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  state.accounts = [{ id: "acc-everyday", name: "Everyday", type: "everyday" }];
  state.transfers = [];
  state.shared = [
    { id: "power", what: "Power", amount: 150, freq: "Monthly", account: "Everyday" },
    { id: "groceries", what: "Groceries", amount: 100, freq: "Monthly", account: "Everyday" }
  ];
  state.transactions = [{ id: "t1", linkedExpenseId: "power", what: "Power", date: lastPaid, amount: 150, account: "Everyday" }];
  try {
    var all = (changed(), getLocalNotifications());
    var power = all.filter(function(n){ return /Power|bills? to confirm/.test(n.title); });
    assert.ok(power.length, "Power is asked about");
    assert.ok(power.every(function(n){ return n.action === "catchup"; }), "every notice about Power opens the confirm sheet: " + JSON.stringify(power));
    var fresh = all.find(function(n){ return n.title === "Groceries needs a fresh entry"; });
    assert.ok(fresh, "a never-logged line still asks for its first entry");
    assert.equal(fresh.action, undefined, "the confirm sheet doesn't list a line never logged");
  } finally {
    Object.assign(state, prev);
  }
});

test("budget lines spending suggests are a To do once the first month is behind the household, never both", async () => {
  const keep = { income: state.income, assets: state.assets, transactions: state.transactions, shared: state.shared, setupDismissed: state.setupDismissed };
  try {
    // Three months of a payee that has no budget line: a suggestion.
    state.income = [{ id: "i1", what: "Pay", amount: 5000, freq: "Monthly", person: "Alex", incomeType: "Net" }];
    state.assets = [{ id: "a1", what: "Savings", category: "Cash", amount: 1000 }];
    state.shared = [];
    state.setupDismissed = false;
    const today = new Date(), iso = d => d.toISOString().slice(0, 10), ago = n => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };
    state.transactions = [];
    for(let m = 0; m < 6; m++) for(let k = 0; k < 4; k++) state.transactions.push({ id: "t" + m + k, date: ago(m * 30 + k * 7 + 2), what: "Fern Café", amount: 12 });
    const todo = () => (changed(), getLocalNotifications()).filter(n => n.type === "budgetsuggest");
    const shown = todo();
    assert.equal(shown.length, 1, "a household months in gets the To do");
    assert.match(shown[0].title, /budget line.*suggested from your spending/);
    assert.equal(shown[0].page, "expenses"); assert.equal(shown[0].sub, "budget");
    // A household in its first month: the checklist asks instead.
    state.transactions = state.transactions.filter(t => t.date >= ago(40)).map(t => t);
    const first = state.transactions.reduce((a, t) => t.date < a ? t.date : a, "9999");
    if(first >= ago(59)) assert.equal(todo().length, 0, "while the first month shows, it asks — not a To do as well");
  } finally { Object.assign(state, keep); changed(); }
});

// The owner: council rates come once a quarter and the app said nothing about them — an investment property's own cost
// lines weren't read at all, and a week's notice is short for a big bill that comes a few times a year.
function withProperty(expenses, transactions, fn){
  var keep = { shared: state.shared, tx: state.transactions, props: state.properties, assets: state.assets, accounts: state.accounts };
  state.shared = []; state.assets = []; state.transactions = transactions; state.accounts = [{ name: "Everyday Account", type: "everyday" }];
  state.properties = [{ id: "p1", what: "1 Example St", kind: "IP", value: 600000, loans: [], expenses: expenses }];
  try { fn(); } finally { Object.assign(state, { shared: keep.shared, transactions: keep.tx, properties: keep.props, assets: keep.assets, accounts: keep.accounts }); }
}
test("a property's quarterly council rates are said two weeks ahead, named with the property", function(){
  withProperty([{ id: "cr", what: "Council rates", amount: 480, freq: "Quarterly" }],
    [{ id: "t1", date: daysAgo(79), amount: 480, linkedExpenseId: "cr", account: "Everyday Account" }],
    function(){
      var bills = (changed(), getLocalNotifications()).filter(function(n){ return n.type === "duebill"; });
      assert.equal(bills.length, 1, "due in about 12 days: inside a quarterly bill's two weeks");
      assert.equal(bills[0].title, "Council rates — 1 Example St");
      assert.match(bills[0].detail, /\$480 · quarterly/);
      assert.ok(!bills[0].action, "not due yet: it opens the Bills calendar, not the Paid sheet");
    });
});
test("a monthly bill twelve days out isn't said yet — a week's notice is enough for it", function(){
  withProperty([{ id: "st", what: "Strata", amount: 300, freq: "Monthly" }],
    [{ id: "t1", date: daysAgo(18), amount: 300, linkedExpenseId: "st", account: "Everyday Account" }],
    function(){
      assert.equal((changed(), getLocalNotifications()).filter(function(n){ return n.type === "duebill"; }).length, 0);
    });
});
test("a property bill due within three days opens its Paid sheet; one the property manager pays isn't said", function(){
  withProperty([{ id: "cr", what: "Council rates", amount: 480, freq: "Quarterly" }],
    [{ id: "t1", date: daysAgo(91), amount: 480, linkedExpenseId: "cr", account: "Everyday Account" }],
    function(){
      var n = (changed(), getLocalNotifications()).find(function(x){ return x.type === "duebill"; });
      assert.ok(n, "due about now");
      assert.equal(n.action, "billpaid"); assert.equal(n.line, "cr"); assert.ok(n.due);
    });
  withProperty([{ id: "cr", what: "Council rates", amount: 480, freq: "Quarterly" }],
    [{ id: "t1", date: daysAgo(85), amount: 480, linkedExpenseId: "cr", account: "Agent Co" }],
    function(){
      state.accounts.push({ name: "Agent Co", type: "agent" });
      assert.equal((changed(), getLocalNotifications()).filter(function(x){ return x.type === "duebill"; }).length, 0);
    });
});
