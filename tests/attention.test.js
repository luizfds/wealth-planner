import "./_env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { state } from "../src/state.js";
import { getLocalNotifications } from "../src/lib/notifications.js";
import { todoItems, knowItems, homeTodoItems, ATTENTION_LABEL, belongsToView, attentionLineHtml, canDismiss, isDismissed } from "../src/lib/attention.js";
import { adviceHomeHtml } from "../src/components/advice.js";

// #305 (docs/design/attention.md): the bell and Home's To do are one list. Each fact makes one item.
function withState(patch, fn){
  var keep = {};
  Object.keys(patch).forEach(function(k){ keep[k] = state[k]; state[k] = patch[k]; });
  try { return fn(); } finally { Object.assign(state, keep); }
}
var HOUSE = { income: [{ id: "i1", what: "Salary", amount: 90000, freq: "Yearly", person: "Alex" }], lastBackupDate: "", monthReviews: {} };

test("a household with data has one review item and one backup item, in one wording", function(){
  withState(HOUSE, function(){
    var all = getLocalNotifications();
    var review = all.filter(function(n){ return /^review:\d{4}-\d{2}$/.test(n.id); });
    assert.equal(review.length, 1);
    assert.match(review[0].title, /^Review [A-Z][a-z]+ \d{4}$/);
    assert.deepEqual([review[0].page, review[0].sub], ["dashboard", "review"]);
    var backup = all.filter(function(n){ return n.type === "backup"; });
    assert.equal(backup.length, 1);
    assert.equal(backup[0].action, "backup");
  });
});

test("an empty household is asked for nothing: no review, no backup", function(){
  withState({ income: [], shared: [], assets: [], properties: [], transactions: [], debts: [], accounts: [], lastBackupDate: "", monthReviews: {} }, function(){
    var ids = getLocalNotifications().map(function(n){ return n.type; });
    assert.ok(ids.indexOf("review") === -1 && ids.indexOf("backup") === -1, ids.join(","));
    assert.deepEqual(homeTodoItems(), []);
  });
});

test("the to-dos only Home had are items like the rest: transactions to review, a stale balance, a rent review, a fixed rate ending", function(){
  var soon = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), old = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  withState(Object.assign({}, HOUSE, {
    transactions: [{ id: "t1", date: old, amount: 12, description: "Fern Café", review: true }],
    accounts: [{ id: "a1", name: "Everyday", type: "everyday", balance: 500, balanceDate: old, balances: [{ date: old, balance: 500 }] }],
    properties: [{ id: "p1", what: "1 Example St", kind: "IP", nextRentReview: soon, loans: [{ id: "l1", what: "Loan one", balance: 100000, fixedUntil: soon }] }]
  }), function(){
    var types = getLocalNotifications().map(function(n){ return n.id.split(":")[0]; });
    ["rentreview", "fixedend"].forEach(function(t){ assert.equal(types.filter(function(x){ return x === t; }).length, 1, t); });
    var rent = getLocalNotifications().find(function(n){ return /^rentreview:/.test(n.id); });
    assert.match(rent.title, /^1 Example St: rent review in \d+ days$/);
    assert.equal(rent.page, "properties");
  });
});

test("every item has a group and a label from the one vocabulary; Home's To do skips bills and the week, most pressing first", function(){
  withState(HOUSE, function(){
    var todo = todoItems();
    assert.ok(todo.length > 0);
    todo.forEach(function(n){ assert.equal(n.group, "todo"); assert.equal(n.label, n.severity === "bad" ? ATTENTION_LABEL.urgent : n.severity === "warn" ? ATTENTION_LABEL.todo : ATTENTION_LABEL.reminder); });
    var home = homeTodoItems();
    assert.ok(home.every(function(n){ return ["duebill", "bill", "week"].indexOf(n.type) === -1; }));
    var rank = { bad: 0, warn: 1, info: 2 };
    for(var i = 1; i < home.length; i++) assert.ok(rank[home[i - 1].severity] <= rank[home[i].severity]);
    knowItems("2026-10-27").forEach(function(a){ assert.equal(a.group, "know"); assert.notEqual(a.kind, "good"); assert.ok(a.label); });
  });
});

// Step 2: a page shows one line, and only for what is about that view.
test("an item belongs to the page and tab it goes to; one with no tab, to the page's first tab", function(){
  var pay = { group: "know", id: "payg:Alex", go: { page: "tax", sub: "people" } };
  assert.ok(belongsToView(pay, { page: "tax", sub: "people" }));
  ["year", "returns", "documents"].forEach(function(sub){ assert.ok(!belongsToView(pay, { page: "tax", sub: sub }), sub); });
  var cap = { group: "todo", id: "cap:2026:Alex", page: "tax" };
  assert.ok(belongsToView(cap, { page: "tax", sub: "year" }));
  assert.ok(!belongsToView(cap, { page: "tax", sub: "returns" }));
  var rent = { group: "todo", id: "rentreview:p1", page: "properties" };
  assert.ok(belongsToView(rent, { page: "properties", sub: null }));
  assert.ok(!belongsToView(rent, { page: "accounts", sub: null }));
});

test("what a page shows in full, Home's own items, and Checks stay off page lines", function(){
  assert.ok(!belongsToView({ group: "know", id: "super-room:Alex", go: { page: "tax" } }, { page: "tax", sub: "year" }));
  assert.ok(!belongsToView({ group: "todo", id: "review:2026-09", page: "dashboard", sub: "review" }, { page: "dashboard", sub: null }));
  assert.ok(!belongsToView({ group: "todo", id: "health:x", page: "accounts", sub: "checks" }, { page: "accounts", sub: null }));
  assert.ok(belongsToView({ group: "todo", id: "acctstale:a1", page: "accounts" }, { page: "accounts", sub: null }));
});

test("the line is one button: the count, the first item, and louder when something is urgent or a risk", function(){
  assert.equal(attentionLineHtml({ todo: [], know: [] }), "");
  var html = attentionLineHtml({ todo: [{ tone: "todo", title: "Update <Everyday> balance" }], know: [{ tone: "info", title: "Wants were 18% of spending" }] });
  assert.match(html, /^<button type="button" class="attn-line" data-attn-line aria-haspopup="dialog">/);
  assert.match(html, /<span class="attn-count">2 to look at<\/span><span class="attn-top">Update &lt;Everyday> balance<\/span>/);
  assert.match(attentionLineHtml({ todo: [], know: [{ tone: "risk", title: "Short of cash" }] }), /class="attn-line loud"/);
});

// Step 3: an Opportunity or a Worth knowing can be put away; a Watch can't; it comes back when its title changes.
test("only an Opportunity or a Worth knowing can be dismissed, and only while its title is the one dismissed", function(){
  assert.ok(canDismiss({ kind: "opportunity" }) && canDismiss({ kind: "info" }));
  assert.ok(!canDismiss({ kind: "risk" }) && !canDismiss({ kind: "good" }) && !canDismiss(null));
  var wants = { id: "wants", kind: "info", title: "Wants were 18% of spending" };
  assert.ok(isDismissed(wants, { noticesDismissed: { wants: "Wants were 18% of spending" } }));
  assert.ok(!isDismissed(Object.assign({}, wants, { title: "Wants were 24% of spending" }), { noticesDismissed: { wants: "Wants were 18% of spending" } }), "the figure moved, so it is back");
  assert.ok(!isDismissed({ id: "ef-low", kind: "risk", title: "Cash covers 1.2 months of essentials" }, { noticesDismissed: { "ef-low": "Cash covers 1.2 months of essentials" } }), "a Watch is never hidden");
  assert.ok(!isDismissed(wants, {}));
});

test("Insights: a dismissed observation moves to the Put away fold with Bring back; a Watch has no Dismiss", function(){
  var items = [
    { id: "r", kind: "risk", area: "plan", title: "Short of cash", detail: "d", go: { page: "plan" } },
    { id: "o", kind: "opportunity", area: "tax", title: "Unused super room", detail: "d", go: { page: "tax" } },
    { id: "w", kind: "info", area: "cashflow", title: "Wants were 18% of spending", detail: "d", go: { page: "expenses" } }
  ];
  withState({ noticesDismissed: {} }, function(){
    var html = adviceHomeHtml(items);
    assert.equal((html.match(/data-notice-dismiss=/g) || []).length, 2);
    assert.ok(!/data-notice-dismiss="r"/.test(html));
    assert.ok(!/data-adv-away/.test(html), "no fold with nothing put away");
  });
  withState({ noticesDismissed: { w: "Wants were 18% of spending" } }, function(){
    var html = adviceHomeHtml(items), fold = html.slice(html.indexOf("data-adv-away"));
    assert.match(fold, /1 dismissed/);
    assert.match(fold, /<div class="adv-row"><details class="adv-item adv-info" data-adv-id="w">[\s\S]*<\/details><button[^>]*data-notice-restore="w" aria-label="Bring back: Wants were 18% of spending">Bring back/);
    assert.ok(html.indexOf('data-adv-id="w"') > html.indexOf("data-adv-away"), "out of the main list");
    // The control is beside the card, not inside it, and named for its notice.
    assert.match(html, /<\/details><button type="button" class="icon-btn adv-dismiss" data-notice-dismiss="o" aria-label="Dismiss: Unused super room"/);
    assert.ok(!/<details[^>]*data-adv-id="r"[\s\S]*?<\/details><button/.test(html.slice(0, html.indexOf('data-adv-id="o"'))), "a Watch has nothing beside it");
  });
});
