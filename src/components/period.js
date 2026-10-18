import { state } from "../state.js";
import { periodSelection, setPeriod, selectedYearWindow, selectedMonth, periodLabel, periodYearOptions, isPeriodToday, householdYearBasis, yearStartOf } from "../calc/ledger.js";
import { localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- The period selector in the header (v3.55.0) ----------------
// calc/ledger.js owns what the period *is* (and every figure reads it from there); this is the
// button beside the page title, the menu it opens, and keeping the choice across a reload.
var STORE_KEY = "wealthPlanner.period";
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var rerender = function(){};
export function setPeriodRerender(fn){ rerender = fn || function(){}; }

export function loadPeriod(){
  try {
    var raw = typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORE_KEY);
    if(raw){ var p = JSON.parse(raw); setPeriod(p.year, p.month); }
  } catch(e){ /* private window / blocked storage: start on today */ }
}
function savePeriod(){
  try { if(typeof sessionStorage !== "undefined") sessionStorage.setItem(STORE_KEY, JSON.stringify(periodSelection())); } catch(e){}
}
// Sets the period, keeps it for the session, and re-renders everything that reads it.
export function applyPeriod(year, month){
  setPeriod(year, month);
  savePeriod();
  renderPeriodButton();
  rerender();
}
// Tax → Returns works in financial years whatever the household's basis: the financial year `fy`
// is the year starting in `fy`, which on the calendar basis sits inside calendar year fy + 1's
// tax-year figure (currentTaxFy() reads the FY of the window's first day).
export function applyTaxYear(fy){
  applyPeriod(householdYearBasis() === "calendar" ? Number(fy) + 1 : Number(fy), "");
}

// The earliest dated thing the household has, so the year list starts where the data does.
export function earliestDataDate(){
  var dates = [];
  (state.transactions || []).forEach(function(t){ if(t.date) dates.push(t.date); });
  (state.incomeLog || []).forEach(function(r){ if(r.date) dates.push(r.date); });
  Object.keys(state.taxYears || {}).forEach(function(fy){ if(/^\d{4}$/.test(fy)) dates.push(fy + "-07-01"); });
  return dates.length ? dates.sort()[0] : null;
}

export function periodButtonHtml(today){
  return '<span class="period-btn-label">' + escapeAttr(periodLabel(today)) + '</span>' +
    (isPeriodToday() ? '' : '<span class="period-btn-flag">not today</span>') +
    '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function renderPeriodButton(){
  var btn = typeof document !== "undefined" && document.getElementById("periodBtn");
  if(!btn) return;
  btn.innerHTML = periodButtonHtml();
  btn.classList.toggle("is-past", !isPeriodToday());
  btn.setAttribute("aria-label", "Period: " + periodLabel() + (isPeriodToday() ? " (today)" : "") + ". Change");
}

export function periodMenuHtml(today, earliest){
  today = today || localDateStr();
  var basis = householdYearBasis();
  var sel = periodSelection();
  var win = selectedYearWindow(today);
  var shownYear = yearStartOf(basis, win.start);
  var years = periodYearOptions(earliest === undefined ? earliestDataDate() : earliest, today);
  var months = [];
  var y = Number(win.start.slice(0, 4)), m0 = Number(win.start.slice(5, 7)) - 1;
  for(var i = 0; i < 12; i++){
    var mm = (m0 + i) % 12, yy = y + Math.floor((m0 + i) / 12);
    var ym = yy + "-" + String(mm + 1).padStart(2, "0");
    var future = ym > today.slice(0, 7);
    var on = sel.month === ym;
    months.push('<button type="button" class="period-chip' + (on ? " active" : "") + '" data-period-month="' + ym + '"' + (future ? " disabled" : "") +
      ' aria-pressed="' + on + '" title="' + MONTHS[mm] + " " + yy + '">' + MONTHS[mm] + '</button>');
  }
  return '<div class="period-menu-head"><b>Period</b><span>Every “this year” and “this month” figure follows this — budget, actuals, money received, tax, Returns and transactions.</span></div>' +
    '<div class="period-sec"><div class="period-sec-title">Year runs</div>' +
      '<div class="seg-control" role="group" aria-label="How the year runs">' +
        '<button type="button" class="seg-option' + (basis === "financial" ? " active" : "") + '" aria-pressed="' + (basis === "financial") + '" data-period-basis="financial">July – June</button>' +
        '<button type="button" class="seg-option' + (basis === "calendar" ? " active" : "") + '" aria-pressed="' + (basis === "calendar") + '" data-period-basis="calendar">January – December</button>' +
      '</div></div>' +
    '<div class="period-sec"><div class="period-sec-title">Year</div><div class="period-chips">' +
      years.map(function(o){
        var on = o.year === shownYear;
        return '<button type="button" class="period-chip' + (on ? " active" : "") + '" aria-pressed="' + on + '" data-period-year="' + o.year + '">' +
          escapeAttr(o.label) + (o.current ? ' <small>now</small>' : '') + '</button>';
      }).join("") + '</div></div>' +
    '<div class="period-sec"><div class="period-sec-title">Month <small>— optional; without one, “this month” means ' +
      escapeAttr(MONTHS[Number(selectedMonth(today).slice(5, 7)) - 1]) + '</small></div><div class="period-chips period-months">' +
      '<button type="button" class="period-chip' + (sel.month ? "" : " active") + '" aria-pressed="' + !sel.month + '" data-period-month="">Whole year</button>' +
      months.join("") + '</div></div>' +
    '<div class="period-foot"><button type="button" class="btn btn-sm ' + (isPeriodToday() ? "btn-ghost" : "btn-primary") + '" data-period-today' + (isPeriodToday() ? " disabled" : "") + '>Back to today</button></div>';
}
export function renderPeriodMenu(){
  var el = typeof document !== "undefined" && document.getElementById("periodMenu");
  if(el) el.innerHTML = periodMenuHtml();
}
