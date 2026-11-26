// ---------------- Money → Budget, the top: one answer first (November 2026) — calc/budgetsplit.js, calc/tidyinbox.js ----
//
// What's left for Lifestyle this month, a day, and whether it's on pace — the one figure to watch, since Essentials are
// mostly bills. Then Essentials and Lifestyle spent of their plan, the review list, bills due in the next seven days,
// the pots, and money in (Money → Income has the rest). Set-aside spending comes out of its pot, and purchases with
// no line are shown separately from the month's figures.
import { state } from "../state.js";
import { monthSplit, pots, budgetHints, lifestylePace, classWord, ESSENTIAL_MEANS } from "../calc/budgetsplit.js";
import { inboxCards } from "../calc/tidyinbox.js";
import { propertySuggestions, lineSuggestions, isPropertyMoney, propertyCache } from "../calc/propertymoney.js";
import { trimReport, spendingDrift } from "../calc/trim.js";
import { unbudgetedRecurring } from "../calc/recurring.js";
import { upcomingBills, billsForMonth } from "../calc/bills.js";
import { incomeActuals } from "../calc/received.js";
import { periodsOf, resolveSharedAmount, selectedMonth, monthPhrase } from "../calc/ledger.js";
import { currentScenario } from "../calc/engine.js";
import { loggableBudgetLineItems, budgetLineItems } from "./expenses.js";
import { currentStrays } from "./tidy.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { emptyStateHtml } from "../lib/empty.js";
import { viewItems, attentionIconHtml, canDismiss } from "../lib/attention.js";

// This device's session: open review rows and groups, items put off for later, and whether to show every pot.
export var budgetSplitUi = { inboxOpen: false, later: {}, allPots: false, pick: {}, reviewRows: new Set(), reviewGroups: new Set() };
var POTS_SHOWN = 4;
var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Math.round(Number(n) || 0))); }
function pct(a, b){ return b > 0 ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : (a > 0 ? 100 : 0); }
var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dayLabel(iso){ var d = new Date(iso + "T00:00:00"); return WEEKDAYS[d.getDay()] + " " + d.getDate(); }
function ordinal(n){ var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

// Bills not paid for a while with no end date (calc/bills.js), as of today's month — about now, not the header's.
function stoppedBills(lines, today){
  try { return billsForMonth(lines, state.transactions, today.slice(0, 7), today, { accounts: state.accounts, transfers: state.transfers }).stopped || []; } catch(e){ return []; }
}
// Everything the top of Budget shows, worked out once.
export function budgetSplitModel(today){
  today = today || localDateStr();
  var scen = currentScenario();
  var monthlyOf = function(l){ return periodsOf(resolveSharedAmount(l, scen), l.freq).monthly; };
  var lines = loggableBudgetLineItems();
  var ym = selectedMonth();
  // A property's money (a purchase's deposit and costs) isn't the month's spending — not even "spent on no budget line".
  var pcache = propertyCache(state);
  var spending = (state.transactions || []).filter(function(t){ return !isPropertyMoney(t, state, pcache); });
  // The follow-up review: the plan is every line, a worked-out one included (Lines' legend counts it), so the card and the
  // legend say the same Lifestyle; the lines you can log against stay the ones the inbox looks at.
  var planLines = budgetLineItems(scen);
  var split = monthSplit(planLines, spending, ym, { monthlyOf: monthlyOf });
  var drift = [];
  try { drift = spendingDrift(trimReport({ today: today })); } catch(e){ drift = []; }
  var cards = inboxCards({ strays: currentStrays(today), hints: budgetHints(lines, state.transactions, { today: today, ok: state.tidyOk || {} }),
    drift: drift, recurring: unbudgetedRecurring(spending, today), stopped: stoppedBills(lines, today),
    property: propertySuggestions(state, today, state.tidyOk || {}), propLines: lineSuggestions(state, state.tidyOk || {}), lines: lines, ok: state.tidyOk || {} })
    .filter(function(c){ return !budgetSplitUi.later[c.id]; });
  var income = incomeActuals(ym).filter(function(t){ return !t.irregular; });
  // Budget's own notices share the review list with the cards. Other pages keep the strip (attentionline.js).
  var notices = [];
  try { var here = viewItems({ page: "expenses", sub: "budget" }, today); notices = here.todo.concat(here.know); } catch(e){ notices = []; }
  return { ym: ym, today: today, lines: lines.length, split: split, notices: notices,
    pace: lifestylePace(planLines, spending, ym, today, { split: split }),
    pots: pots(lines, state.transactions, today, { monthlyOf: monthlyOf }),
    inbox: cards,
    upcoming: upcomingBills(lines, state.transactions, today, 7, { accounts: state.accounts, transfers: state.transfers }).filter(function(b){ return b.days >= 0; }),
    moneyIn: { planned: income.reduce(function(s, t){ return s + (Number(t.planned) || 0); }, 0), received: income.reduce(function(s, t){ return s + (Number(t.received) || 0); }, 0) } };
}

export function renderBudgetSplit(){
  var el = typeof document !== "undefined" && document.getElementById("budgetSplitBody");
  if(!el) return;
  // Preserve expanded details when a cost is picked, a card is answered or the overall list is closed.
  el.querySelectorAll("details[data-review-row], details[data-review-more]").forEach(function(d){
    var key = d.dataset.reviewRow || d.dataset.reviewMore;
    var open = d.hasAttribute("data-review-row") ? budgetSplitUi.reviewRows : budgetSplitUi.reviewGroups;
    if(d.open) open.add(key); else open.delete(key);
  });
  el.innerHTML = budgetSplitHtml(budgetSplitModel());
}

// Lifestyle spent so far this month, day by day, against an even pace to the plan — and, while the month runs, where
// this pace ends. The figures are in the words beside it; this is the shape.
export function paceSvgHtml(p){
  if(!p.days || !(p.planned > 0)) return "";
  var W = 320, top = 14, bottom = 88;
  var maxV = Math.max(p.planned, p.projected || 0, p.spent || 0) * 1.05 || 1;
  var x = function(d){ return Math.round(d / p.days * W * 10) / 10; };
  var y = function(v){ return Math.round((bottom - (v / maxV) * (bottom - top)) * 10) / 10; };
  var pts = ["0," + bottom].concat(p.byDay.map(function(v, i){ return x(i + 1) + "," + y(v); }));
  var last = p.byDay.length ? [x(p.byDay.length), y(p.byDay[p.byDay.length - 1])] : [0, bottom];
  var label = "Lifestyle spending this month: " + money(p.spent) + " by day " + p.day + " of " + p.days + ", against a plan of " + money(p.planned) + ".";
  return '<svg class="bh-pace" viewBox="0 0 ' + W + ' 96" preserveAspectRatio="none" role="img" aria-label="' + escapeAttr(label) + '">' +
    '<line class="bh-pace-grid" x1="0" y1="' + y(p.planned) + '" x2="' + W + '" y2="' + y(p.planned) + '"></line>' +
    '<line class="bh-pace-even" x1="0" y1="' + bottom + '" x2="' + W + '" y2="' + y(p.planned) + '"></line>' +
    '<line class="bh-pace-grid" x1="0" y1="' + bottom + '" x2="' + W + '" y2="' + bottom + '"></line>' +
    '<polyline class="bh-pace-line' + (p.status === "over" ? ' over' : '') + '" points="' + pts.join(" ") + '"></polyline>' +
    (p.status !== "past" && p.status !== "early" && p.day > 0 ? '<polyline class="bh-pace-ahead' + (p.status === "over" ? ' over' : '') + '" points="' + last.join(",") + ' ' + W + ',' + y(p.projected) + '"></polyline>' : '') +
    (p.day > 0 ? '<circle class="bh-pace-dot' + (p.status === "over" ? ' over' : '') + '" cx="' + last[0] + '" cy="' + last[1] + '" r="4"></circle>' : '') +
  '</svg><div class="bh-pace-key" aria-hidden="true"><span>1st</span><span>plan ' + money(p.planned) + '</span><span>' + ordinal(p.days) + '</span></div>';
}

function paceWords(p){
  if(p.status === "past") return p.left >= 0 ? { cls: "good", text: "Finished " + money(p.left) + " under the plan" } : { cls: "bad", text: "Finished " + money(-p.left) + " over the plan" };
  if(p.status === "early") return { cls: "", text: "Too early to say — " + money(p.spent) + " so far" };
  if(p.status === "on") return { cls: "good", text: "Right on pace" };
  if(p.status === "under") return { cls: "good", text: "On pace — about " + money(p.diff) + " under by the " + ordinal(p.days) };
  return { cls: "bad", text: "At this pace, about " + money(-p.diff) + " over by the " + ordinal(p.days) };
}

function miniBar(label, swatch, spent, planned){
  var over = spent > planned + 0.5;
  return '<div class="bh-mini"><span class="bh-mini-name">' + escapeAttr(label) + '</span><b class="bh-mini-fig' + (over ? ' over' : '') + '">' + money(spent) + ' <small>of ' + money(planned) + '</small></b>' +
    '<span class="bh-track"><span class="bh-fill ' + swatch + (over ? ' over' : '') + '" style="width:' + pct(spent, planned) + '%"></span></span></div>';
}

function reviewCardBody(c){
  var id = escapeAttr(c.id);
  return '<div class="bh-inbox-card"><p class="bh-inbox-body">' + escapeAttr(c.body) + '</p>' +
    '<dl class="bh-inbox-facts">' + c.facts.map(function(f){ return '<div><dt>' + escapeAttr(f[0]) + '</dt><dd>' + escapeAttr(f[1]) + '</dd></div>'; }).join("") + '</dl>' +
    (c.picks ? '<div class="bh-inbox-picks"><span class="field-label">Which cost</span><div class="bl-chips" role="group" aria-label="Which cost">' + c.picks.map(function(p){
      var on = (budgetSplitUi.pick[c.id] || c.pick) === p.value;
      return '<button type="button" class="bl-chip' + (on ? " is-on" : "") + '" aria-pressed="' + on + '" data-inbox-pick="' + escapeAttr(p.value) + '" data-inbox-pick-for="' + id + '">' + escapeAttr(p.label) + '</button>';
    }).join("") + '</div></div>' : '') +
    '<div class="bh-inbox-act"><button type="button" class="btn btn-primary" data-inbox-yes="' + id + '">' + escapeAttr(c.yes.label) + '</button>' +
      '<button type="button" class="btn" data-inbox-no="' + id + '">' + escapeAttr(c.no.label) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-inbox-later="' + id + '">Later</button></div>' +
    (c.why ? '<p class="bh-inbox-why">Why it’s asking: ' + escapeAttr(c.why) + '</p>' : '') + '</div>';
}

var TIDY_KINDS = new Set(["misfiled", "property", "propline"]);
var REVIEW_GROUPS = [
  { key: "tidy", title: "Tidy up", icon: "txreview", rowName: "tidy item" },
  { key: "suggestions", title: "Suggestions", icon: "budgetsuggest", rowName: "suggestion" },
  { key: "checks", title: "Checks", icon: "data", rowName: "check" }
];
var NOTICE_DESTINATIONS = new Map([
  ["budgetsuggest", ["historyBudgetCard", "Review suggested budget lines"]],
  ["plan-padding", ["trimCard", "Open Trim"]],
  ["budget", ["budgetSplitCard", "See this month’s budget"]]
]);
var REVIEW_ROWS_SHOWN = 2;

function suggestionNotice(n){ return n.type === "budgetsuggest" || n.id === "plan-padding"; }

function reviewNoticeBody(n){
  var target = NOTICE_DESTINATIONS.get(n.type) || NOTICE_DESTINATIONS.get(n.id) || ["budgetLines", "See budget lines"];
  var link = '<button type="button" class="link-btn" data-review-jump="' + target[0] + '"' +
    (n.group === "todo" ? ' data-review-read="' + escapeAttr(n.id) + '"' : '') + '>' + target[1] + ' →</button>';
  var dismiss = canDismiss(n) ? '<button type="button" class="btn btn-ghost" data-notice-dismiss="' + escapeAttr(n.id) +
    '" aria-label="' + escapeAttr("Dismiss: " + n.title) + '">Dismiss</button>' : '';
  return '<div class="bh-review-notice"><p>' + escapeAttr(n.detail || "") + '</p><div>' + link + dismiss + '</div></div>';
}

function reviewRowHtml(item, group){
  var card = !!item.yes;
  return '<details class="bh-review-item" data-review-row="' + escapeAttr(item.id) + '"' + (budgetSplitUi.reviewRows.has(item.id) ? ' open' : '') + '>' +
    '<summary>' + attentionIconHtml(card ? { type: group.icon } : item) + '<span class="bh-review-item-text"><small>' + escapeAttr(item.label) + '</small><b>' +
    escapeAttr(item.title) + '</b></span><span class="bh-review-chevron" aria-hidden="true"></span></summary>' +
    (card ? reviewCardBody(item) : reviewNoticeBody(item)) + '</details>';
}

function reviewGroupHtml(group, items){
  if(!items.length) return "";
  var row = function(item){ return reviewRowHtml(item, group); };
  var extra = items.length - REVIEW_ROWS_SHOWN;
  var more = extra > 0 ? '<details class="bh-review-more" data-review-more="' + group.key + '"' +
    (budgetSplitUi.reviewGroups.has(group.key) ? ' open' : '') + '><summary><span class="bh-review-show">Show ' + extra +
    ' more ' + group.rowName + (extra === 1 ? '' : 's') + '</span><span class="bh-review-hide">Show fewer ' + group.rowName + 's</span></summary>' +
    items.slice(REVIEW_ROWS_SHOWN).map(row).join("") + '</details>' : '';
  return '<section class="bh-review-group" data-review-section="' + group.key + '" aria-labelledby="budgetReview-' + group.key + '"><h3 id="budgetReview-' + group.key + '">' +
    group.title + ' <span>' + items.length + '</span></h3>' + items.slice(0, REVIEW_ROWS_SHOWN).map(row).join("") + more + '</section>';
}

function budgetReviewHtml(cards, notices){
  var count = cards.length + notices.length;
  if(!count) return emptyStateHtml("All clear — nothing to look at.", { done: true, className: "bh-inbox-done" });
  var groups = [
    cards.filter(function(c){ return TIDY_KINDS.has(c.kind); }),
    cards.filter(function(c){ return !TIDY_KINDS.has(c.kind); }).concat(notices.filter(suggestionNotice)),
    notices.filter(function(n){ return !suggestionNotice(n); })
  ];
  var names = REVIEW_GROUPS.filter(function(group, i){ return groups[i].length; }).map(function(group){ return group.title; }).join(" · ");
  var open = budgetSplitUi.inboxOpen;
  var sections = open ? REVIEW_GROUPS.map(function(group, i){ return reviewGroupHtml(group, groups[i]); }).join("") : "";
  return '<div class="bh-review"><button type="button" class="bh-review-toggle" data-inbox-toggle aria-expanded="' + open +
    '" aria-controls="bhInboxBody"><span class="bh-review-toggle-text"><b>' + count + ' to look at</b><small>' + names +
    '</small></span><span class="bh-review-action">' + (open ? "Close" : "Review") +
    '<span class="bh-review-chevron" aria-hidden="true"></span></span></button><div class="bh-review-body" id="bhInboxBody"' + (open ? "" : " hidden") + '>' +
    sections + (open ? '<div class="bh-review-footer"><button type="button" class="link-btn" data-review-jump="allSuggestions">Open budget tools →</button></div>' : "") + '</div></div>';
}

export function budgetSplitHtml(m){
  var notices = m.notices || [];
  if(!m.lines){
    var empty = emptyStateHtml("No budget lines yet — add what you spend, and this shows what's left each month.", { scroll: "#sharedGroups", label: "Go to the budget ↓" });
    return m.inbox.length || notices.length ? '<div class="bh-col">' + empty + budgetReviewHtml(m.inbox, notices) + '</div>' : empty;
  }
  var s = m.split, p = m.pace;
  var isNow = m.ym === m.today.slice(0, 7);
  var when = isNow ? "day " + p.day + " of " + p.days : MONTHS[Number(m.ym.slice(5, 7)) - 1] + " " + m.ym.slice(0, 4);
  var hasLifestyle = s.lifestyle.planned > 0;
  var words = paceWords(p);
  // 1. The answer.
  // November 2026: the answer sits on a band in Money's colour (the colour system); the split under it stays on white.
  var hero = '<section class="bh-hero" aria-label="This month"><div class="bh-band">' +
    // The section's heading (h2): the Lines, Coming up and Pots under it are h3, so the page reads in order.
    '<div class="bh-hero-top"><h2 class="bh-h">' + (hasLifestyle ? (p.left < 0 ? "Lifestyle over the plan" : "Left for Lifestyle") : "Spent on Lifestyle") + (isNow ? "" : " · " + escapeAttr(monthPhrase(m.ym))) + '</h2><span>' + escapeAttr(when) + '</span></div>' +
    '<div class="bh-left"><b class="' + (hasLifestyle && p.left < 0 ? "over" : "") + '">' + money(hasLifestyle ? Math.abs(p.left) : p.spent) + '</b>' +
      (hasLifestyle && isNow && p.left > 0 && p.daysLeft > 0 ? '<span>≈ ' + money(p.perDay) + ' a day for ' + p.daysLeft + ' day' + (p.daysLeft === 1 ? '' : 's') + '</span>' : '') + '</div>' +
    (hasLifestyle ? paceSvgHtml(p) + '<p class="bh-pace-words ' + words.cls + '">' + escapeAttr(words.text) + '</p>' : '<p class="ledger-note">No Lifestyle lines are spent every month yet — mark a line Lifestyle to see what\'s left.</p>') +
    '</div>' +
    '<div class="bh-minis">' + miniBar("Essentials", "needs", s.essential.spent, s.essential.planned) + miniBar("Lifestyle", "wants", s.lifestyle.spent, s.lifestyle.planned) + '</div>' +
    (s.other.spent > 0.5 ? '<p class="bh-note">Also spent ' + escapeAttr(isNow ? "this month" : monthPhrase(m.ym)) + ' on no budget line: <b>' + money(s.other.spent) + '</b> — a one-off isn\'t in these figures. It\'s on Spending.</p>' : '') +
    '<p class="bh-note">Essential: ' + escapeAttr(ESSENTIAL_MEANS) + '. Set-aside spending comes out of its pot, not these figures.</p>' +
  '</section>';
  // 2. What needs you.
  var inbox = budgetReviewHtml(m.inbox, notices);
  // 3. What's coming.
  var dueTotal = m.upcoming.reduce(function(t, b){ return t + (Number(b.amount) || 0); }, 0);
  var coming = '<section class="bh-sec"><h3>Coming up <small>' + (m.upcoming.length ? 'next 7 days · ' + money(dueTotal) : 'next 7 days') + '</small></h3>' +
    (m.upcoming.length ? '<ul class="bh-due">' + m.upcoming.slice(0, 5).map(function(b){
      return '<li><span class="bh-due-day">' + escapeAttr(b.days === 0 ? "Today" : b.days === 1 ? "Tomorrow" : dayLabel(b.due)) + '</span><span class="bh-due-what">' + escapeAttr(b.what) + (b.estimated ? ' <small>about</small>' : '') + '</span><b>' + money(b.amount) + '</b></li>';
    }).join("") + '</ul>' + (m.upcoming.length > 5 ? '<button type="button" class="link-btn" data-go="expenses/bills">All ' + m.upcoming.length + ' on Bills →</button>' : '')
      : emptyStateHtml("No bills due in the next 7 days.", { done: true })) + '</section>';
  // 4. The pots.
  var potList = budgetSplitUi.allPots ? m.pots : m.pots.slice(0, POTS_SHOWN);
  var potsHtml = '<section class="bh-sec"><h3>Pots <small>' + money(s.setAside.planned) + '/mo going in</small></h3>' +
    (m.pots.length ? '<div class="bh-pots">' + potList.map(function(x){
      var q = x.pot;
      return '<button type="button" class="bh-pot" data-detail="line" data-detail-id="' + escapeAttr(x.line.id) + '"><span class="bh-pot-name">' + escapeAttr(x.line.what || "Pot") + '</span>' +
        '<b class="' + (q.short ? "over" : "") + '">' + (q.short ? money(-q.balance) + ' short' : money(q.balance)) + '</b><small>' + escapeAttr(classWord(x.line.classification)) + ' · ' + money(q.monthly) + '/mo</small></button>';
    }).join("") + '</div>' + (m.pots.length > POTS_SHOWN ? '<button type="button" class="link-btn" data-bs-more="pots">' + (budgetSplitUi.allPots ? "Show fewer" : "Show all " + m.pots.length) + '</button>' : '')
      : emptyStateHtml("No pots yet — trips, clothes or car upkeep fit here: open a line and choose Set aside.", { scroll: "#sharedGroups", label: "Go to the lines ↓" })) + '</section>';
  // 5. Money in, as one line.
  var moneyIn = '<button type="button" class="bh-in" data-go="expenses/income"><span><small>Money in ' + escapeAttr(isNow ? "this month" : monthPhrase(m.ym)) + '</small><b>' + money(m.moneyIn.received) + ' <small>of ' + money(m.moneyIn.planned) + ' received</small></b></span><span class="bh-in-go">Income →</span></button>';
  return '<div class="bh-grid"><div class="bh-col">' + hero + '</div><div class="bh-col">' + inbox + coming + potsHtml + moneyIn + '</div></div>';
}
