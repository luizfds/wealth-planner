// ---------------- Home, wired (v3.206.1, item 237) ----------------
//
// Home: the scenario cards' and figures' links, Review, Benchmarks, arranging Home and the summary's to-dos.
// Moved out of app.js as it was, listener for listener; app.js calls each wire…() where its listeners used to be
// added, so they're added in the same order.
import { renderNotifBadge, followNotification } from "./notifpanel.js";
import { markReviewed, setStatementAmount, monthLabel, monthBounds } from "../calc/monthreview.js";
import { dismissWeekRecap } from "../calc/weekrecap.js";
import { copyBenchmarkTemplateToClipboard } from "../lib/backup.js";
import { localDateStr } from "../lib/format.js";
import { loadHomeLayout, saveHomeLayout, moveCard, applyHomeLayout, homeArrangeHtml } from "../lib/homelayout.js";
import { showToast, showUndoToast } from "../lib/toast.js";
import { state, persist } from "../state.js";
import { renderBenchmarks, setBenchmarkField, applyBenchmarkPaste, addGoal, setGoalField, removeGoal, setPropertyMarketField } from "./benchmarks.js";
import { openReceivedSheetFor } from "./cashflowwiring.js";
import { renderHealth } from "./health.js";
import { renderDashboardStats, savingsWhyOpen, setSavingsWhyOpen } from "./dashboard.js";
import { renderHomeSummary, weekView } from "./home.js";
import { renderMonthReview, stepReviewMonth, reviewMonthShown, setReviewMonth, setReviewStep, dismissReviewIntro } from "./monthreview.js";
import { showPage, showDashboardSubpage, showExpensesSubpage, showAccountsSubpage, showTaxSubpage, showPlanSubpage } from "./nav.js";
import { renderGoalsTab } from "./accountswiring.js";
import { chooseScenario, withUndo } from "./redraw.js";
import { renameScenario, cloneScenario, deleteScenario, renderHomeBody, homeBlockCollapsed } from "./scenarios.js";
import { openTxReview } from "./spendingwiring.js";
import { renderPeopleTab } from "./taxwiring.js";
import { renderTaxYear, setTaxYearSelected } from "./taxyear.js";
import { pushActiveOverlay, requestCloseActiveOverlay } from "../lib/overlaystack.js";
import { scenarioActions } from "./scenariowiring.js";
import { readInput } from "../lib/validate.js";

var monthReviewBody, benchmarksBody, homeArrangeRoot, homeArrangeOpen;

function onScenarioControlClick(e){
  // More specific controls first — data-rename/data-delete/data-edit-scenario2 all live
  // *inside* the now-clickable .home-block-head (data-collapse-toggle), so that catch-all has
  // to be checked last or it would swallow clicks meant for the buttons nested inside it.
  var renameBtn = e.target.closest("[data-rename]");
  if(renameBtn){ renameScenario(renameBtn.getAttribute("data-rename")); return true; }
  var cloneBtn = e.target.closest("[data-clone]");
  if(cloneBtn){ cloneScenario(cloneBtn.getAttribute("data-clone")); return true; }
  var delBtn = e.target.closest("[data-delete]");
  if(delBtn){ var scName = delBtn.getAttribute("data-delete"); withUndo('Deleted "' + scName + '"', function(){ deleteScenario(scName); return state.scenarios.indexOf(scName) === -1; }); return true; }
  // v3.174.0 (item 209): adding a scenario starts from a question.
  if(e.target.closest("#addScenarioBtn") || e.target.closest("#addScenarioBtn2")){ scenarioActions.openStartSheet(); return true; }
  var editBtn = e.target.closest("[data-edit-scenario]");
  // v3.181.0 (item 212): Edit opens the scenario on its own page, as a draft.
  if(editBtn){
    scenarioActions.openScenarioEditor(editBtn.getAttribute("data-edit-scenario"));
    // Item 257: the card's "Costs $X/mo more than today" opens the page at its breakdown.
    // The page changes inside a view transition (nav.js), so wait until it's showing, then a frame more.
    if(editBtn.hasAttribute("data-sc-open-diff")) (function toDiff(n){
      var d = document.getElementById("scDiff");
      if(d && document.body.getAttribute("data-current-page") === "scenario") requestAnimationFrame(function(){ requestAnimationFrame(function(){ d.scrollIntoView({ block: "start" }); }); });
      else if(n < 30) setTimeout(function(){ toDiff(n + 1); }, 60);
    })(0);
    return true;
  }
  var setActiveBtn = e.target.closest("[data-edit-scenario2]");
  if(setActiveBtn){ chooseScenario(setActiveBtn.getAttribute("data-edit-scenario2")); return true; }
  var collapseBtn = e.target.closest("[data-collapse-toggle]");
  if(collapseBtn){
    var cs = collapseBtn.getAttribute("data-collapse-toggle");
    homeBlockCollapsed[cs] = !homeBlockCollapsed[cs];
    renderHomeBody();
    return true;
  }
  return false;
}
// "Other ASX code…": show the code field without changing the stored symbol until one is typed.
function renderBenchmarksOther(){
  var sel = benchmarksBody.querySelector("[data-bm-symbol]");
  if(!sel || benchmarksBody.querySelector("[data-bm-other]")) return;
  sel.closest("label").insertAdjacentHTML("afterend", '<label>ASX code <input type="text" data-bm-other maxlength="8" style="width:80px;text-transform:uppercase" placeholder="A200"></label>');
  benchmarksBody.querySelector("[data-bm-other]").focus();
}
function renderHomeArrange(focusSel){
  homeArrangeRoot.innerHTML = homeArrangeOpen ? homeArrangeHtml() : "";
  var f = homeArrangeOpen && homeArrangeRoot.querySelector(focusSel || "[data-ha-close]:not(.icon-btn)");
  if(f) f.focus({ preventScroll: !focusSel });
}
function openHomeArrange(){ homeArrangeOpen = true; renderHomeArrange(); pushActiveOverlay(function(){ homeArrangeOpen = false; renderHomeArrange(); }); }
function changeHomeLayout(fn, focusSel){ var l = loadHomeLayout(); fn(l); saveHomeLayout(l); applyHomeLayout(); renderHomeArrange(focusSel); }

export function wireCards(){
  document.getElementById("cards").addEventListener("click", function(e){
    if(onScenarioControlClick(e)) return;
    // The ⋯ menu's own toggle is handled by the page-wide overflow handler; opening it isn't a vote
    // for this scenario.
    if(e.target.closest(".card-overflow")) return;
    var cardSel = e.target.closest(".card-select");
    if(cardSel) chooseScenario(cardSel.getAttribute("data-scenario"));
  });
  document.getElementById("homeBody").addEventListener("click", onScenarioControlClick);
  // Dashboard's own stats already tease the "Projected net worth" figure this links through to —
  // Projections itself had no reachable link from Dashboard at all, and lives behind the mobile
  // "More" tab (an occasional what-if page, not day-to-day data entry), so this is the one
  // one-tap bridge from the page everyone actually lands on first.
  document.getElementById("dashboardProjectionsLink").addEventListener("click", function(){ showPage("projections"); });  // v3.33.0: tiles that open the panel behind them (FI → Insights, tax year → the worksheet).
  document.getElementById("dashboardStats").addEventListener("click", function(e){
    // #266: the scenario comparison's outcomes link to their assumptions — a scenario's own page, or Projections.
    var edit = e.target.closest("[data-edit-scenario]");
    if(edit){ scenarioActions.openScenarioEditor(edit.getAttribute("data-edit-scenario")); return; }
    var jump = e.target.closest("[data-dashboard-jump]");
    if(!jump) return;
    var where = jump.getAttribute("data-dashboard-jump");
    if(where === "projections"){ showPage("projections"); return; }
    if(where === "insights"){
      var tab = document.querySelector('[data-dashboard-sub="insights"]');
      if(tab){ tab.click(); tab.scrollIntoView({ behavior: "smooth", block: "start" }); }
    } else if(where === "taxyear"){
      if(jump.getAttribute("data-tax-fy")) setTaxYearSelected(jump.getAttribute("data-tax-fy"));
      showPage("tax");
      showTaxSubpage("returns", { replace: true });
      renderTaxYear();
    }
  });
  // Item 247: Net savings → "How it's worked out", and the breakdown's own ✕. Delegated off the Overview, which
  // holds both the tile and the panel under it.
  document.getElementById("dashboardSub-overview").addEventListener("click", function(e){
    var why = e.target.closest("[data-savings-why]");
    if(!why) return;
    var opening = !savingsWhyOpen;
    setSavingsWhyOpen(opening);
    renderDashboardStats();
    var panel = document.getElementById("savingsBreakdown");
    if(opening && panel && !panel.hidden) panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    else if(!opening){ var b = document.querySelector("#dashboardStats [data-savings-why]"); if(b) b.focus(); }
  });
  document.getElementById("homeBody").addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    var collapseBtn = e.target.closest("[data-collapse-toggle]");
    if(!collapseBtn) return;
    e.preventDefault();
    collapseBtn.click();
  });
}

export function wireMonthReview(){  // Dashboard → Review (v3.54.0): every control in the four parts.
  monthReviewBody = document.getElementById("monthReviewBody");
  monthReviewBody.addEventListener("click", function(e){
    var step = e.target.closest("[data-mr-step]");
    if(step && !step.disabled){ stepReviewMonth(Number(step.getAttribute("data-mr-step"))); renderMonthReview(); return; }
    if(e.target.closest("[data-mr-intro-ok]")){ dismissReviewIntro(); renderMonthReview(); return; }
    var to = e.target.closest("[data-mr-to]");
    if(to){
      setReviewStep(to.getAttribute("data-mr-to"));
      renderMonthReview();
      var card = monthReviewBody.querySelector(".mr-stepcard h3");
      if(card){ card.setAttribute("tabindex", "-1"); card.focus({ preventScroll: true }); monthReviewBody.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
      return;
    }
    var log = e.target.closest("[data-mr-log]");
    // Logged into the month under review: its last day, or today if that's still to come.
    if(log){ var mEnd = monthBounds(reviewMonthShown()).end; openReceivedSheetFor(log.getAttribute("data-mr-log"), mEnd < localDateStr() ? mEnd : localDateStr()); return; }
    var go = e.target.closest("[data-mr-go]");
    if(go){
      var where = go.getAttribute("data-mr-go");
      if(where === "checks"){ showAccountsSubpage("checks"); renderHealth(); }
      else if(where === "accounts"){ showPage("accounts"); }
      else { showPage("expenses"); showExpensesSubpage("spending", { replace: true }); var importCard = document.getElementById("bankImportCard"); if(importCard){ importCard.open = true; setTimeout(function(){ importCard.scrollIntoView({ behavior: "smooth", block: "start" }); }, 80); } }
      return;
    }
    var done = e.target.closest("[data-mr-done]");
    if(done){
      var ym = done.getAttribute("data-mr-done");
      var was = !!(state.monthReviews[ym] && state.monthReviews[ym].done);
      setReviewMonth(ym);
      markReviewed(ym, !was, localDateStr());
      persist();
      renderMonthReview();
      renderNotifBadge();
      if(!was) showToast(monthLabel(ym) + " reviewed");
    }
  });
  monthReviewBody.addEventListener("change", function(e){
    var acct = e.target.getAttribute("data-mr-statement");
    if(acct == null) return;
    setStatementAmount(reviewMonthShown(), acct, e.target.value);
    persist();
    renderMonthReview();
  });
}

export function wireBenchmarks(){  // v3.35.0: Dashboard → Benchmarks controls. One delegated pair of listeners for every section;
  // each change persists and re-renders the tab.
  benchmarksBody = document.getElementById("benchmarksBody");
  benchmarksBody.addEventListener("change", function(e){
    var t = e.target;
    if(t.matches("[data-bm-symbol]")){
      if(t.value === "__other"){ renderBenchmarksOther(); return; }
      setBenchmarkField("symbol", null, t.value);
    } else if(t.matches("[data-bm-other]")) setBenchmarkField("symbol", null, t.value);
    else if(t.matches("[data-bm-rate]")){
      // #263: a blank or out-of-range rate was ignored without a word — the field showed it, the comparison didn't use it.
      if(!readInput(t, { empty: "Enter a rate — 0 for none.", min: 0, max: 30, range: "Enter a rate from 0 to 30%." })) return;
      setBenchmarkField("rate", null, t.value);
    }
    else if(t.matches("[data-bm-price]")) setBenchmarkField("price", t.getAttribute("data-bm-price"), t.value);
    // v3.36.0: targets.
    else if(t.matches("[data-goal-kind]")){
      var catSel = benchmarksBody.querySelector("[data-goal-category]");
      if(catSel) catSel.hidden = t.value !== "categorySpend";
      return;
    }
    else if(t.matches("[data-goal-category]")) return;
    else if(t.matches("[data-goal-target]")){
      // Blank is no target; a negative one erased the target that was there.
      var pct = /%/.test(t.getAttribute("aria-label") || "");
      if(!readInput(t, pct ? { min: 0, max: 100, range: "Enter a share from 0 to 100%, or leave it blank." } : { min: 0, range: "A target can't be negative — leave it blank for none." })) return;
      setGoalField(Number(t.getAttribute("data-goal-target")), "target", t.value);
    }
    else if(t.matches("[data-goal-by]")) setGoalField(Number(t.getAttribute("data-goal-by")), "by", t.value);
    // v3.37.0: suburb figures.
    else if(t.matches("[data-pm-field]")){
      // A suburb's yield and rent can't be negative (its growth can); blank clears the figure, as before.
      var pmField = t.getAttribute("data-pm-field");
      if((pmField === "yield" || pmField === "rentWeekly") && !readInput(t, { min: 0, range: (pmField === "yield" ? "A yield" : "Rent") + " can't be negative — leave it blank if you don't have it." })) return;
      if(pmField === "growthPa" && !readInput(t, {})) return;
      setPropertyMarketField(t.getAttribute("data-pm-id"), pmField, t.value);
    }
    else return;
    renderBenchmarks();
  });
  benchmarksBody.addEventListener("click", function(e){
    if(e.target.closest("[data-bm-copy]")){ copyBenchmarkTemplateToClipboard(); return; }
    if(e.target.closest("[data-goal-add]")){
      var kind = benchmarksBody.querySelector("[data-goal-kind]").value;
      var cat = benchmarksBody.querySelector("[data-goal-category]").value;
      if(addGoal(kind, cat) === false){ showToast("Add a category first (Settings → Categories)"); return; }
      renderBenchmarks();
      var inputs = benchmarksBody.querySelectorAll("[data-goal-target]");
      if(inputs.length){ inputs[inputs.length - 1].focus(); inputs[inputs.length - 1].select(); }
      return;
    }
    var goalDel = e.target.closest("[data-goal-del]");
    if(goalDel){
      var idx = Number(goalDel.getAttribute("data-goal-del"));
      var removed = removeGoal(idx);
      renderBenchmarks();
      if(removed) showUndoToast("Target removed", function(){ state.goals.splice(idx, 0, removed); persist(); renderBenchmarks(); });
      return;
    }
    if(e.target.closest("[data-bm-paste-apply]")){
      var area = benchmarksBody.querySelector("[data-bm-paste]");
      var n = applyBenchmarkPaste(area ? area.value : "");
      showToast(n ? n + " benchmark price" + (n === 1 ? "" : "s") + " saved" : "No benchmark rows found — each line needs a symbol like IOZ@2024-03-01 and a price");
      if(n) renderBenchmarks();
    }
  });
}

export function wireHomeArrange(){
  // ---------------- Arrange Home (v3.165.0, item 195) — lib/homelayout.js decides ----------------
  homeArrangeRoot = document.getElementById("homeArrangeRoot");
  homeArrangeOpen = false;
  document.addEventListener("click", function(e){ if(e.target.closest("[data-ha-open]")) openHomeArrange(); });
  homeArrangeRoot.addEventListener("click", function(e){
    if(e.target.closest("[data-ha-close]") || e.target === e.target.closest("[data-ha-backdrop]")){ requestCloseActiveOverlay(); return; }
    var mv = e.target.closest("[data-ha-move]");
    if(mv){
      var key = mv.getAttribute("data-ha-move"), dir = Number(mv.getAttribute("data-ha-dir"));
      // Focus stays on the arrow that was pressed (or its twin, once the card reaches an end).
      changeHomeLayout(function(l){ var m = moveCard(l, key, dir); l.order = m.order; },
        '[data-ha-move="' + key + '"][data-ha-dir="' + dir + '"]:not([disabled]), [data-ha-move="' + key + '"]:not([disabled])');
      return;
    }
    if(e.target.closest("[data-ha-reset]")){ changeHomeLayout(function(l){ l.order = []; l.hidden = {}; l.pinned = []; }); showToast("Home is back to the default"); }
  });
  homeArrangeRoot.addEventListener("change", function(e){
    var show = e.target.closest("[data-ha-show]"), pin = e.target.closest("[data-ha-pin]");
    if(show){ var k = show.getAttribute("data-ha-show"), on = show.checked; changeHomeLayout(function(l){ if(on) delete l.hidden[k]; else l.hidden[k] = true; }, '[data-ha-show="' + k + '"]'); }
    if(pin){
      var id = pin.getAttribute("data-ha-pin"), want = pin.checked;
      changeHomeLayout(function(l){ l.pinned = l.pinned.filter(function(x){ return x !== id; }); if(want) l.pinned.push(id); }, '[data-ha-pin="' + id + '"]');
    }
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && homeArrangeOpen) requestCloseActiveOverlay(); });
}

export function wireHomeSummary(){
  // ---------------- Home (v3.58.0): the summary's links and to-dos ----------------
  document.getElementById("homeSummary").addEventListener("click", function(e){
    if(e.target.closest("[data-goal-go]")){ showPage("accounts"); return; }
    // v3.166.0: Your week — step back through the last four, or put this week's away (synced).
    var step = e.target.closest("[data-wk-step]");
    if(step){
      weekView.back = Math.max(0, weekView.back + Number(step.getAttribute("data-wk-step")));
      renderHomeSummary();
      var again = document.querySelector('#homeSummary [data-wk-step="' + step.getAttribute("data-wk-step") + '"]:not([disabled]), #homeSummary [data-wk-step]:not([disabled])');
      if(again) again.focus();
      return;
    }
    if(e.target.closest("[data-wk-dismiss]")){
      dismissWeekRecap(state, localDateStr()); weekView.back = 0; persist();
      renderHomeSummary(); renderNotifBadge();
      showToast("Put away until next Monday");
      return;
    }
    // #305: a To do row is the bell's item, followed the same way.
    var todo = e.target.closest(".home-todo [data-notif-id]");
    if(todo){ followNotification(todo); return; }
    var b = e.target.closest("[data-home-go]");
    if(!b) return;
    var go = b.getAttribute("data-home-go"), sub = b.getAttribute("data-home-sub"), fy = b.getAttribute("data-home-fy");
    if(go === "backup"){ var exp = document.getElementById("exportBtn"); if(exp) exp.click(); return; }
    if(go === "txreview"){ openTxReview(); return; }
    if(go === "dashboard"){
      showDashboardSubpage(sub || "overview");
      if(sub === "review") renderMonthReview();
      // v3.147.0: the tabs head the page now, so the top of it is where that tab starts.
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Savings goals live on Plan → Goals, drawn when its tab opens (as planwiring's own links do).
    if(go === "plan" && sub === "goals"){ showPage("plan"); showPlanSubpage("goals", { replace: true }); renderGoalsTab(); return; }
    if(go === "settings"){ showAccountsSubpage(sub || "categories"); if(sub === "checks") renderHealth(); if(sub === "people") renderPeopleTab(); return; }
    if(go === "tax"){ if(fy) setTaxYearSelected(fy); showPage("tax"); showTaxSubpage(sub || "returns", { replace: true }); renderTaxYear(); return; }
    showPage(go);
    if(go === "expenses" && sub) showExpensesSubpage(sub, { replace: true });
  });
}
