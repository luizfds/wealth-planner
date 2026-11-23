// ---------------- Money → Budget → Essentials & Lifestyle (November 2026) — calc/budgetsplit.js ----------------
//
// The top of Money out. Four figures — Essentials and Lifestyle every month, what's set aside, and Lifestyle left this
// month (the one to watch: Essentials are mostly bills) — then this month's two bars, the set-aside pots, and the lines
// whose answers look wrong ("Worth a look"). Set-aside spending is never in the bars: it comes out of its pot.
import { state } from "../state.js";
import { monthSplit, pots, budgetHints, classWord, ESSENTIAL_MEANS } from "../calc/budgetsplit.js";
import { periodsOf, resolveSharedAmount, selectedMonth, monthPhrase } from "../calc/ledger.js";
import { currentScenario } from "../calc/engine.js";
import { loggableBudgetLineItems } from "./expenses.js";
import { detailLinkHtml } from "./detail.js";
import { fmtCurrency0, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { emptyStateHtml } from "../lib/empty.js";

export var budgetSplitUi = { allPots: false, allHints: false };
var POTS_SHOWN = 5, HINTS_SHOWN = 3;

function money(n){ return (n < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(Math.round(Number(n) || 0))); }
function pct(a, b){ return b > 0 ? Math.max(0, Math.min(100, Math.round(a / b * 100))) : (a > 0 ? 100 : 0); }

export function budgetSplitModel(today){
  today = today || localDateStr();
  var scen = currentScenario();
  var monthlyOf = function(l){ return periodsOf(resolveSharedAmount(l, scen), l.freq).monthly; };
  var lines = loggableBudgetLineItems();
  var ym = selectedMonth();
  return { ym: ym, today: today, lines: lines.length, split: monthSplit(lines, state.transactions, ym, { monthlyOf: monthlyOf }),
    pots: pots(lines, state.transactions, today, { monthlyOf: monthlyOf }),
    hints: budgetHints(lines, state.transactions, { today: today, ok: state.tidyOk || {} }) };
}

export function renderBudgetSplit(){
  var el = typeof document !== "undefined" && document.getElementById("budgetSplitBody");
  if(!el) return;
  el.innerHTML = budgetSplitHtml(budgetSplitModel());
}

function barHtml(label, swatch, spent, planned){
  var over = spent > planned + 0.5;
  return '<div class="bs-bar"><div class="bs-bar-top"><span class="bs-bar-name"><span class="bs-swatch ' + swatch + '" aria-hidden="true"></span>' + escapeAttr(label) + '</span>' +
      '<span class="bs-bar-fig' + (over ? ' over' : '') + '">' + money(spent) + ' <small>of ' + money(planned) + '</small></span></div>' +
    '<div class="bs-track"><div class="bs-fill ' + swatch + (over ? ' over' : '') + '" style="width:' + pct(spent, planned) + '%"></div></div></div>';
}

export function budgetSplitHtml(m){
  var s = m.split, plan = s.total;
  if(!m.lines) return emptyStateHtml("No budget lines yet — add what you spend, and this splits it into Essentials, Lifestyle and what's set aside.", { scroll: "#sharedGroups", label: "Go to the budget ↓" });
  var share = function(n){ return plan > 0 ? Math.round(n / plan * 100) + "% of the plan" : ""; };
  var isNow = m.ym === m.today.slice(0, 7);
  var daysIn = new Date(Number(m.ym.slice(0, 4)), Number(m.ym.slice(5, 7)), 0).getDate();
  var when = isNow ? "day " + Number(m.today.slice(8, 10)) + " of " + daysIn : monthPhrase(m.ym);
  var left = s.lifestyleLeft;
  var tiles = '<div class="bs-tiles">' +
    '<div class="bs-tile"><span><span class="bs-swatch needs" aria-hidden="true"></span>Essentials · every month</span><b>' + money(s.essential.planned) + '</b><small>' + share(s.essential.planned) + '</small></div>' +
    '<div class="bs-tile"><span><span class="bs-swatch wants" aria-hidden="true"></span>Lifestyle · every month</span><b>' + money(s.lifestyle.planned) + '</b><small>' + share(s.lifestyle.planned) + '</small></div>' +
    '<div class="bs-tile"><span><span class="bs-swatch setaside" aria-hidden="true"></span>Set aside</span><b>' + money(s.setAside.planned) + '</b><small>' + (m.pots.length ? 'into ' + m.pots.length + ' pot' + (m.pots.length === 1 ? '' : 's') : 'for lumpy costs') + '</small></div>' +
    '<div class="bs-tile bs-tile-key"><span>Lifestyle ' + (left < 0 ? 'over' : 'left') + ' ' + escapeAttr(isNow ? "this month" : monthPhrase(m.ym)) + '</span><b' + (left < 0 ? ' class="over"' : '') + '>' + money(Math.abs(left)) + '</b><small>of ' + money(s.lifestyle.planned) + ' · ' + escapeAttr(when) + '</small></div>' +
  '</div>';
  var month = '<section class="bs-sec"><h3>Every month <small>' + escapeAttr(when) + '</small></h3>' +
    barHtml("Essentials", "needs", s.essential.spent, s.essential.planned) +
    barHtml("Lifestyle", "wants", s.lifestyle.spent, s.lifestyle.planned) +
    (s.other.planned ? barHtml("Savings & other", "na", s.other.spent, s.other.planned)
      : s.other.spent ? '<p class="bs-other">Also spent, on no budget line: <b>' + money(s.other.spent) + '</b></p>' : '') +
    '<p class="ledger-note bs-note">Essential: ' + escapeAttr(ESSENTIAL_MEANS) + '. Set-aside spending isn\'t in these bars — it comes out of its pot.</p></section>';
  var potList = budgetSplitUi.allPots ? m.pots : m.pots.slice(0, POTS_SHOWN);
  var potsHtml = '<section class="bs-sec"><h3>Set aside <small>' + money(s.setAside.planned) + '/mo going in</small></h3>' +
    (m.pots.length ? '<ul class="bs-pots">' + potList.map(function(x){
      var p = x.pot;
      return '<li><span class="bs-pot-name">' + detailLinkHtml("line", x.line.id, x.line.what || "Line") + ' <small>· ' + escapeAttr(classWord(x.line.classification)) + '</small></span>' +
        '<b class="bs-pot-bal' + (p.short ? ' over' : '') + '">' + (p.short ? money(-p.balance) + ' short' : money(p.balance)) + '</b>' +
        '<small class="bs-pot-sub">' + money(p.monthly) + '/mo in · ' + money(p.spent) + ' spent since ' + escapeAttr(fmtDate(p.from, { year: true })) + '</small></li>';
    }).join("") + '</ul>' +
      (m.pots.length > POTS_SHOWN ? '<button type="button" class="link-btn bs-more" data-bs-more="pots">' + (budgetSplitUi.allPots ? 'Show fewer' : 'Show all ' + m.pots.length) + '</button>' : '')
      : emptyStateHtml("Nothing set aside yet — trips, clothes or car upkeep fit here: open a line and choose Set aside.", { scroll: "#sharedGroups", label: "Go to the budget lines ↓" })) +
    '</section>';
  var hints = '';
  if(m.hints.length){
    var shown = budgetSplitUi.allHints ? m.hints : m.hints.slice(0, HINTS_SHOWN);
    hints = '<section class="bs-hints"><div class="rc-sec">Worth a look</div>' + shown.map(function(h){
      return '<div class="rc-row"><div class="rc-main"><b>' + escapeAttr(h.what) + '</b><small>' + escapeAttr(h.text) + '</small></div><span></span>' +
        '<div class="rc-actions"><button type="button" class="btn btn-sm" data-bs-fix="' + escapeAttr(h.id) + '">' + escapeAttr(h.fix.label) + '</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-bs-ok="' + escapeAttr(h.id) + '">It\'s right</button></div></div>';
    }).join("") +
      (m.hints.length > HINTS_SHOWN ? '<button type="button" class="link-btn bs-more" data-bs-more="hints">' + (budgetSplitUi.allHints ? 'Show fewer' : 'Show all ' + m.hints.length) + '</button>' : '') +
    '</section>';
  }
  return tiles + '<div class="bs-cols">' + month + potsHtml + '</div>' + hints +
    '<p class="bs-total">The whole plan <b>' + money(plan) + '/mo</b></p>';
}
