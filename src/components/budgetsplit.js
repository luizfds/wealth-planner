// ---------------- Money → Budget, the top: one answer first (November 2026) — calc/budgetsplit.js, calc/tidyinbox.js ----
//
// What's left for Lifestyle this month, a day, and whether it's on pace — the one figure to watch, since Essentials are
// mostly bills. Then Essentials and Lifestyle spent of their plan, everything that needs tidying as one inbox opened in
// place (a card at a time), the bills due in the next seven days, the pots, and money in as one line (Money → Income has
// the rest). Set-aside spending is never in the month's figures — it comes out of its pot — and a purchase on no line
// isn't either: it's said underneath.
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
import { loggableBudgetLineItems } from "./expenses.js";
import { currentStrays } from "./tidy.js";
import { fmtCurrency0, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { emptyStateHtml } from "../lib/empty.js";
import { viewItems } from "../lib/attention.js";

// This device's session: the inbox open or not, the cards put off for later, every pot shown.
export var budgetSplitUi = { inboxOpen: false, later: {}, allPots: false, pick: {} };
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
  var split = monthSplit(lines, spending, ym, { monthlyOf: monthlyOf });
  var drift = [];
  try { drift = spendingDrift(trimReport({ today: today })); } catch(e){ drift = []; }
  var cards = inboxCards({ strays: currentStrays(today), hints: budgetHints(lines, state.transactions, { today: today, ok: state.tidyOk || {} }),
    drift: drift, recurring: unbudgetedRecurring(spending, today), stopped: stoppedBills(lines, today),
    property: propertySuggestions(state, today, state.tidyOk || {}), propLines: lineSuggestions(state, state.tidyOk || {}), lines: lines, ok: state.tidyOk || {} })
    .filter(function(c){ return !budgetSplitUi.later[c.id]; });
  var income = incomeActuals(ym).filter(function(t){ return !t.irregular; });
  // The app assessment (November 2026): Budget has one place for what to sort out. The notices about it (the page's
  // "N to look at" line everywhere else — components/attentionline.js leaves it off Budget) are said under the Tidy list.
  var notices = [];
  try { var here = viewItems({ page: "expenses", sub: "budget" }, today); notices = here.todo.concat(here.know); } catch(e){ notices = []; }
  return { ym: ym, today: today, lines: lines.length, split: split, notices: notices,
    pace: lifestylePace(lines, spending, ym, today, { split: split }),
    pots: pots(lines, state.transactions, today, { monthlyOf: monthlyOf }),
    inbox: cards,
    upcoming: upcomingBills(lines, state.transactions, today, 7, { accounts: state.accounts, transfers: state.transfers }).filter(function(b){ return b.days >= 0; }),
    moneyIn: { planned: income.reduce(function(s, t){ return s + (Number(t.planned) || 0); }, 0), received: income.reduce(function(s, t){ return s + (Number(t.received) || 0); }, 0) } };
}

export function renderBudgetSplit(){
  var el = typeof document !== "undefined" && document.getElementById("budgetSplitBody");
  if(!el) return;
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

// The inbox, opened in place: the first card, its two answers and Later, and what's next.
export function inboxHtml(cards){
  if(!cards.length) return emptyStateHtml("All tidy — nothing to look at. New things show here as statements come in.", { done: true, className: "bh-inbox-done" });
  var c = cards[0];
  return '<section class="bh-inbox-card" aria-label="' + escapeAttr("Thing to tidy, 1 of " + cards.length) + '">' +
    '<div class="bh-inbox-top"><span class="bh-kicker">' + escapeAttr(c.label) + '</span><span class="bh-count">1 of ' + cards.length + '</span></div>' +
    '<h3 class="bh-inbox-title">' + escapeAttr(c.title) + '</h3><p class="bh-inbox-body">' + escapeAttr(c.body) + '</p>' +
    '<dl class="bh-inbox-facts">' + c.facts.map(function(f){ return '<div><dt>' + escapeAttr(f[0]) + '</dt><dd>' + escapeAttr(f[1]) + '</dd></div>'; }).join("") + '</dl>' +
    // November 2026: a purchase's card picks which of its costs (the guess first, changeable).
    (c.picks ? '<div class="bh-inbox-picks"><span class="field-label" id="pick-' + escapeAttr(c.id) + '">Which cost</span><div class="bl-chips" role="group" aria-labelledby="pick-' + escapeAttr(c.id) + '">' + c.picks.map(function(p){
      var on = (budgetSplitUi.pick[c.id] || c.pick) === p.value;
      return '<button type="button" class="bl-chip' + (on ? " is-on" : "") + '" aria-pressed="' + on + '" data-inbox-pick="' + escapeAttr(p.value) + '" data-inbox-pick-for="' + escapeAttr(c.id) + '">' + escapeAttr(p.label) + '</button>';
    }).join("") + '</div></div>' : '') +
    '<div class="bh-inbox-act"><button type="button" class="btn btn-primary" data-inbox-yes="' + escapeAttr(c.id) + '">' + escapeAttr(c.yes.label) + '</button>' +
      '<button type="button" class="btn" data-inbox-no="' + escapeAttr(c.id) + '">' + escapeAttr(c.no.label) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-inbox-later="' + escapeAttr(c.id) + '">Later</button></div>' +
    (c.why ? '<p class="bh-inbox-why">Why it\'s asking: ' + escapeAttr(c.why) + '</p>' : '') +
    '<button type="button" class="link-btn bh-inbox-all" data-all-suggest>All suggestions →</button>' +
    (cards.length > 1 ? '<div class="bh-next"><span class="bh-kicker">Next</span>' + cards.slice(1, 4).map(function(n){ return '<span class="bh-next-item">' + escapeAttr(n.title) + '</span>'; }).join("") +
      (cards.length > 4 ? '<span class="bh-next-item">and ' + (cards.length - 4) + ' more</span>' : '') + '</div>' : '') +
  '</section>';
}

export function budgetSplitHtml(m){
  if(!m.lines) return emptyStateHtml("No budget lines yet — add what you spend, and this shows what's left each month.", { scroll: "#sharedGroups", label: "Go to the budget ↓" });
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
  var n = m.inbox.length, notices = m.notices || [];
  var inbox = '<div class="bh-inbox">' +
    (n ? '<button type="button" class="bh-tidy" data-inbox-toggle aria-expanded="' + !!budgetSplitUi.inboxOpen + '" aria-controls="bhInboxBody">' +
        '<span class="bh-tidy-n" aria-hidden="true">' + n + '</span><span class="bh-tidy-text"><b>' + (n === 1 ? "1 thing to tidy" : n + " things to tidy") + '</b><small>' + escapeAttr(m.inbox[0].label + (n > 1 ? " and " + (n - 1) + " more" : "")) + '</small></span>' +
        '<span class="bh-tidy-go">' + (budgetSplitUi.inboxOpen ? "Close" : "Review") + '</span></button>' +
        '<div id="bhInboxBody"' + (budgetSplitUi.inboxOpen ? '' : ' hidden') + '>' + (budgetSplitUi.inboxOpen ? inboxHtml(m.inbox) : '') + '</div>'
      : (notices.length ? '' : emptyStateHtml("All tidy — nothing to look at.", { done: true, className: "bh-inbox-done" }))) +
    // The notices about the budget, one line under the Tidy list: it opens the bell showing only them (notifpanel.js).
    (notices.length ? '<button type="button" class="bh-notices" data-attn-line aria-haspopup="dialog"><span class="bh-notices-n">' +
        (notices.length === 1 ? "1 notice" : notices.length + " notices") + '</span><span class="bh-notices-top">' + escapeAttr(notices[0].title) + '</span><span aria-hidden="true">›</span></button>' : '') +
  '</div>';
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
