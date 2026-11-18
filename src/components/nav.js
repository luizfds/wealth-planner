import { renderPeriodButton } from "./period.js";
import { pageTransitionDone } from "../lib/pagetransition.js";
import { overlayOpen } from "../lib/overlaystack.js";
import { renderCalcTools } from "./calculators.js";
import { renderHomeBody, renderScenarioEditor, renderCalcScenario } from "./scenarios.js";
import { drawStale } from "../lib/views.js";
import { renderProjectionsIfStale } from "./projections.js";
import { renderDashboardStats } from "./dashboard.js";
import { renderHomeSummary } from "./home.js";
import { renderBenchmarks } from "./benchmarks.js";
import { renderMonthReview } from "./monthreview.js";
import { renderHealth } from "./health.js";
import { renderReports, reportShown } from "./reports.js";
import { REPORTS } from "../calc/reports.js";
import { closeScenarioOverridePanel } from "./expenses.js";
import { escapeAttr } from "../lib/html.js";
import { lodgementStatus } from "../calc/taxyear.js";
import { renderTaxYear } from "./taxyear.js";
import { renderReceived } from "./received.js";
import { renderAdvice } from "./advice.js";
import { localDateStr } from "../lib/format.js";
import { detailTarget, renderDetailPage } from "./detail.js";
import { renderNetWorthPage } from "./networth.js";
import { renderShowMore } from "./showmore.js";
import { hideShownAgain } from "../lib/mode.js";
import { state } from "../state.js";
import { parentOf, ancestorsOf, sectionOf } from "../lib/parents.js";
import { recordView } from "../lib/pageuse.js";
import { renderPageUse } from "./pageuse.js";

// #262: a subtab says which one is showing to a screen reader too (aria-current), not only by its colour. The rails are
// choosers that navigate (each has its own address), not ARIA tabs: buttons in a named group.
function markCurrent(btn, on){
  btn.classList.toggle("active", on);
  if(on) btn.setAttribute("aria-current", "page"); else btn.removeAttribute("aria-current");
}

// ---------------- Page navigation ----------------
// Organised by job since v3.57.0 — what you're doing, not which kind of record it is. The ids are
// the old ones where a page carried on (so saved links, localStorage and every data-page attribute
// keep working); Income, Scenarios and Projections became subpages, reached through ALIASES.
var PAGES = [
  { id: "dashboard", label: "Today" },
  { id: "expenses", label: "Money" },   // #427: was "Cash flow"
  // v3.129.0: one Net worth entry; its overview and these three sit under one rail of tabs.
  { id: "networth", label: "Net worth" },
  { id: "accounts", label: "Accounts" },
  { id: "assets", label: "Investments" },
  { id: "properties", label: "Property" },
  { id: "tax", label: "Tax" },
  { id: "plan", label: "Plan" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" },
  // v3.128.0: one page for any single thing — /detail/<kind>/<id>. In no menu; lists link to it.
  { id: "detail", label: "Details" },
  // v3.181.0 (item 212): one scenario being edited. In no menu; a scenario card's Edit opens it.
  { id: "scenario", label: "Edit scenario" },
  // v3.189.0 (item 220): in the avatar menu. #412: under More.
  { id: "calc", label: "Calculators" },
  // #412: a phone's More tab — Tax, Reports, Calculators, Settings and Backup, used now and then.
  { id: "more", label: "More" }
];
// Old page ids → [page, subpage]. Anything that still says showPage("income") — a notification, the
// setup checklist, a search result, an old bookmark — lands on the subpage that replaced it.
var ALIASES = {
  income: ["expenses", "income"],
  scenarios: ["plan", "scenarios"],
  projections: ["plan", "projections"]
};
var currentPage = null;
export function currentPageId(){ return currentPage; }
// #305: the page and tab on screen, as an item's destination names them (lib/attention.js belongsToView).
export function currentView(){
  var sub = currentPage === "expenses" ? currentExpensesSub : currentPage === "plan" ? currentPlanSub : currentPage === "assets" ? currentAssetsSub
    : currentPage === "tax" ? (currentTaxSub || defaultTaxSub()) : currentPage === "settings" ? currentSettingsSub : null;
  return { page: currentPage, sub: sub };
}
export var PAGE_KEY = "wealthPlanner.page";

// Shareable URLs: /<page>[/<subpage>], e.g. /assets/shares or /expenses/spending. GitHub Pages
// serves this project under a fixed /wealth-planner base; local dev (python http.server, etc.)
// serves it from root — no generic base-path detection needed for a single-repo app.
var BASE_PATH = location.hostname.indexOf("github.io") !== -1 ? "/wealth-planner" : "";

// Root-relative URL for a file that sits next to index.html — the ONLY safe way to reach one from
// app code, because by the time any of it runs the address bar has been rewritten to the current
// route and a *document*-relative URL no longer points where you think.
//
// This was a real, silent, shipped bug (fixed v2.78.1). Both `fetch("index.html?v=…")` (the
// update check) and `register("sw.js")` resolved against the route, so:
//
//   /dashboard          + "sw.js"  ->  /sw.js            correct, by luck
//   /expenses/spending  + "sw.js"  ->  /expenses/sw.js   404
//
// One-segment routes happen to resolve correctly, which is exactly why it went unnoticed: the
// only broken routes are the two-segment ones (/expenses/*, /assets/*), and only on a fresh load
// there — a shared link, a bookmark, or a plain reload. Measured on such a load, the service
// worker never registered at all (no offline support) and "Check for updates" silently 404'd.
export function appAssetUrl(file){
  return BASE_PATH + "/" + file;
}
var ASSETS_SUB_TO_SLUG = { Cash: "cash", Shares: "shares", Super: "super", Vehicle: "vehicle", Other: "other", Offsets: "offsets" };
// #413: Investments → Summary went (its parts are on Net worth and Accounts); an old /assets/summary opens on Cash.
var SLUG_TO_ASSETS_SUB = { summary: "Cash", cash: "Cash", shares: "Shares", super: "Super", vehicle: "Vehicle", other: "Other", offsets: "Offsets" };
var currentAssetsSub = "Cash";
// Expenses' own two halves — the planned budget and the real spend logged against it. Unlike
// Assets' categories (whose ids are the user-facing category names and so need a slug map), these
// are already lowercase route slugs, so they double as their own DOM ids and URL segments.
// #427: Money's tabs. "income" is no tab now — Money in is the top of Budget — but every link that says it still lands there.
var EXPENSES_SUBS = ["budget", "spending", "bills"];
var currentExpensesSub = "budget";
// Tax's three halves (v3.43.0): the year as a plan, past years as returns, and the papers behind
// them. Deep-linkable like Expenses — "open the return" is worth a bookmark in October.
var TAX_SUBS = ["year", "returns", "documents", "people"];
// Plan (v3.57.0): the what-ifs — scenarios to live in, and where each leads.
var PLAN_SUBS = ["scenarios", "projections", "goals", "retirement"];
var currentPlanSub = "scenarios";
// Settings (v3.57.0): the registries and preferences that used to share the Accounts page.
// v3.129.0: People moved to Tax (they're the facts the tax estimate runs on) and Checks to Home →
// Review; showAccountsSubpage still answers to both names and takes you there.
var SETTINGS_SUBS = ["categories", "preferences", "rules"];
var MOVED_SETTINGS = { people: ["tax", "people"], checks: ["dashboard", "review"] };
var currentSettingsSub = "categories";
var currentTaxSub = null;
var DASHBOARD_SUBS = ["overview", "insights", "benchmarks", "review"];
var currentDashboardSub = "overview";
// Between 1 July and 31 October the year just ended is the thing to be doing, so Tax opens on its
// return; the rest of the year it opens on the plan.
export function defaultTaxSub(){
  return lodgementStatus(localDateStr()).inSeason ? "returns" : "year";
}

function buildRoutePath(pageId){
  var parts = [pageId];
  if(pageId === "assets") parts.push(ASSETS_SUB_TO_SLUG[currentAssetsSub] || "cash");
  if(pageId === "expenses") parts.push(currentExpensesSub);
  if(pageId === "tax") parts.push(currentTaxSub || defaultTaxSub());
  if(pageId === "plan") parts.push(currentPlanSub);
  if(pageId === "settings") parts.push(currentSettingsSub);
  // Simpler navigation step 1: Home's tabs and the report on screen have addresses too, so Back steps through them.
  // Overview stays plain /dashboard, which every older link and bookmark already names.
  if(pageId === "dashboard" && currentDashboardSub !== "overview") parts.push(currentDashboardSub);
  if(pageId === "reports" && reportKeyValid(reportShown.key)) parts.push(reportShown.key);
  if(pageId === "detail" && detailTarget.kind) parts.push(detailTarget.kind, encodeURIComponent(detailTarget.id));
  return BASE_PATH + "/" + parts.join("/");
}
// Each history entry the app writes says how deep it is in the app's own entries (0: the first) and the name of the
// screen it was opened from, so a back link can say where it goes and never steps out of the app.
var lastEntry = { depth: 0, title: "Today" };
function entryState(){
  var st = history.state;
  return st && typeof st.depth === "number" ? st : null;
}
var pendingPageWrite = null;
var leavingScroll = null;
// #425: Back to an entry that kept its scroll puts it back once its page is on screen (the page change itself scrolls
// to the top, inside a view transition — so this waits for the page, then a frame for its drawing).
export function restoreScroll(pageId, y){
  if(!(y > 0)) return;
  var tries = 0;
  (function wait(){
    if(document.body.getAttribute("data-current-page") === pageId) return requestAnimationFrame(function(){ window.scrollTo(0, y); });
    if(++tries < 90) requestAnimationFrame(wait);
  })();
}
function syncUrl(pageId, replace, asTab){
  var path = buildRoutePath(pageId);
  if(location.pathname === path){
    // Same address (a deep link landing on itself, the startup pass): just name the entry for the next one's back link.
    var here = entryState(), title = entryTitle(pageId);
    if(here && here.title !== title) try{ history.replaceState(Object.assign({}, here, { title: title }), "", location.href); }catch(e){}
    renderBackLink();
    return;
  }
  var cur = entryState();
  if(!replace && cur && leavingScroll && leavingScroll.path === location.pathname){
    try{ history.replaceState(Object.assign({}, cur, { scroll: leavingScroll.y }), "", location.href); cur = entryState(); }catch(e){}
  }
  leavingScroll = null;
  // showPage() applies inside a view transition, so a tab chosen just after it ("open Spending") writes the address
  // before the page does. That write is the page's: it pushes or replaces as the page asked, never replacing the
  // entry of the page being left (which a tab's own "replace" would, taking it out of Back).
  if(asTab && pendingPageWrite && pendingPageWrite.page === pageId){ replace = pendingPageWrite.replace; pendingPageWrite = null; }
  var next = {page: pageId, assetsSub: currentAssetsSub, expensesSub: currentExpensesSub, taxSub: currentTaxSub, planSub: currentPlanSub,
    settingsSub: currentSettingsSub, title: entryTitle(pageId)};
  // Replacing a page's own entry keeps its place. Replacing a sheet's (search opening a result) is a step on from
  // the page under the sheet, like a push.
  if(replace && cur){ next.depth = cur.depth; next.from = cur.from || null; if(cur.seeded) next.seeded = true; }
  else if(replace && !history.state){ next.depth = 0; next.from = null; }
  else { var base = cur || lastEntry; next.depth = base.depth + 1; next.from = base.title || null; }
  history[replace ? "replaceState" : "pushState"](next, "", path + location.search);
  // #426: counted on this device only (lib/pageuse.js) — a Details page by its kind, not the thing.
  recordView(path.slice(BASE_PATH.length + 1).split("/").slice(0, 2).join("/"), localDateStr());
  renderBackLink();
}
function reportKeyValid(key){ return REPORTS.some(function(r){ return r.key === key; }); }
// What a screen is called where a back link names it: the tab when the tab says more than the page.
var SUB_TITLES = {
  dashboard: { overview: "Today", insights: "Insights", benchmarks: "How you compare", review: "Monthly review" },
  assets: { summary: "Investments" },
  tax: { year: "Tax", returns: "Tax returns", documents: "Tax documents", people: "People" },
  settings: { categories: "Settings", preferences: "Settings", rules: "Import rules" }
};
function entryTitle(pageId){
  var page = PAGES.find(function(p){ return p.id === pageId; });
  var label = page ? page.label : "Today";
  if(pageId === "detail"){
    var h = document.querySelector("#detailBody .dt-head h2");
    return (h && h.textContent.trim()) || label;
  }
  if(pageId === "reports"){
    var rep = REPORTS.find(function(r){ return r.key === reportShown.key; });
    return rep ? rep.label : label;
  }
  var sub = pageId === "dashboard" ? currentDashboardSub : pageId === "expenses" ? currentExpensesSub : pageId === "assets" ? currentAssetsSub
    : pageId === "tax" ? (currentTaxSub || defaultTaxSub()) : pageId === "plan" ? currentPlanSub : pageId === "settings" ? currentSettingsSub : null;
  if(!sub) return label;
  var named = SUB_TITLES[pageId] && SUB_TITLES[pageId][sub];
  if(named) return named;
  var btn = document.querySelector('[data-' + (pageId === "settings" ? "accounts" : pageId) + '-sub="' + sub + '"]');
  var name = btn && (btn.querySelector(".inv-pill-name") || btn);   // #422: a pill carries its total after its name
  return (name && name.textContent.trim()) || label;
}
// Pages with no tab of their own and no other way out get the header's back link. The rest have the menu or
// tab bar; the scenario editor keeps its own (it asks before leaving).
var BACK_LINK_PAGES = ["detail", "reports", "settings", "calc", "tax"];   // #412: Tax too, now under More
// #422: on a phone Investments has no Net worth rail (two rails don't fit), so its way up is the header's back link,
// "‹ Net worth" — always Net worth, the page it lives under, wherever it was opened from. A desktop shows the rail, so
// the link is marked data-phone-only and CSS hides it there (a resize needs no redraw).
function upToNetWorth(){ return currentPage === "assets"; }
// #425: the screen on show, as lib/parents.js names a view.
function viewHere(){
  var v = currentView();
  if(currentPage === "dashboard") v.sub = currentDashboardSub;
  if(currentPage === "detail") v.detail = { kind: detailTarget.kind, id: detailTarget.id };
  return v;
}
function backTarget(){
  if(upToNetWorth()){
    var cur = entryState();
    return { history: !!(cur && cur.depth > 0 && !cur.seeded && cur.from === "Net worth"), title: "Net worth", up: "networth" };
  }
  // The way you came, when it's the app's own. Otherwise (a deep link, a reopened tab: the entry beneath is the Today
  // seedHomeBeneath put there) the screen's parent — "‹ Shares" from a holding — and only then Today.
  var st = entryState();
  if(st && st.depth > 0 && !st.seeded) return { history: true, title: st.from || "Back" };
  var up = parentOf(viewHere(), state);
  if(up) return { history: false, title: up.title, parent: up };
  return { history: false, title: "Today" };
}
// Opens a view lib/parents.js named, in place of the screen on show (it's that screen's way up, not a step on).
function openView(v, opts){
  if(v.page === "dashboard"){ if(currentPage !== "dashboard") showPage("dashboard", opts); return showDashboardSubpage(v.sub || "overview", { replace: true }); }
  showPage(v.page, opts);
  var tab = { replace: true };
  if(v.page === "assets") showAssetsSubpage(v.sub || "Cash", tab);
  else if(v.page === "expenses" && v.sub) showExpensesSubpage(v.sub, tab);
  else if(v.page === "tax" && v.sub) showTaxSubpage(v.sub, tab);
  else if(v.page === "plan" && v.sub) showPlanSubpage(v.sub, tab);
  return true;
}
// #425: on a desktop, an inner screen says where it lives under its title — "Net worth › Shares › VAS" — each part a
// link up. More is left out: a desktop's sidebar lists its pages itself. Net worth's own pages have the rail instead.
var CRUMB_PAGES = ["detail", "dashboard"];
export function renderCrumbs(){
  var nav = document.getElementById("pageCrumbs");
  if(!nav) return;
  var here = viewHere();
  var chain = CRUMB_PAGES.indexOf(currentPage) === -1 ? [] : ancestorsOf(here, state).filter(function(v){ return v.page !== "more"; });
  nav.hidden = !chain.length;
  crumbViews = chain;
  if(!chain.length){ nav.innerHTML = ""; return null; }
  var current = currentPage === "detail" ? entryTitle("detail") : titleFor(currentPage);
  nav.innerHTML = '<ol>' + chain.map(function(v, i){
    return '<li><button type="button" class="link-btn page-crumb" data-crumb="' + i + '">' + escapeAttr(v.title) + '</button></li>';
  }).join("") + '<li><span aria-current="page">' + escapeAttr(current) + '</span></li></ol>';
  return chain.map(function(v){ return v.title; });
}
var crumbViews = [];
export function goCrumb(i){
  var v = crumbViews[Number(i)];
  if(!v) return false;
  return openView(v, {});
}
export function renderBackLink(){
  var st = entryState();
  if(st) lastEntry = { depth: st.depth, title: st.title, from: st.from };
  var crumbs = renderCrumbs();
  var btn = document.getElementById("pageBack");
  if(!btn) return;
  var show = BACK_LINK_PAGES.indexOf(currentPage) !== -1 || (currentPage === "dashboard" && currentDashboardSub !== "overview") || upToNetWorth();
  btn.hidden = !show;
  if(!show) return;
  var to = backTarget();
  var label = btn.querySelector(".page-back-label");
  if(label) label.textContent = to.title;
  btn.setAttribute("aria-label", to.history && to.title === "Back" ? "Back" : "Back to " + to.title);
  // A desktop shows Investments' rail, and the breadcrumb where there is one: there the back link is the phone's, unless
  // it goes somewhere the breadcrumb doesn't name (back to Spending, from a holding opened from a search there).
  btn.toggleAttribute("data-phone-only", !!to.up || !!(crumbs && (!to.history || crumbs.indexOf(to.title) !== -1)));
}
// The header's back link, and any Back button inside a page: the screen before when it is the app's own,
// else Home — never out of the app (history.length counts other sites' entries in the tab too).
export function goBackInApp(){
  var to = backTarget();
  if(to.history){ history.back(); return true; }
  if(to.up) return showPage(to.up);
  if(to.parent) return openView(to.parent, { replace: true });
  if(currentPage === "dashboard") return showDashboardSubpage("overview", { replace: true });
  return showPage("dashboard", { replace: true });
}
// A deep link (or a reopened app remembering another page) starts with nothing of the app's below it, so a phone's
// Back would close the app. Put Home beneath it, the way a native app's first screen is always under the others.
export function seedHomeBeneath(pageId, sub){
  if(pageId === "dashboard") return false;
  var st = entryState();
  if(st && st.depth > 0) return false;
  var here = location.pathname + location.search + location.hash;
  try{
    history.replaceState({ page: "dashboard", depth: 0, title: "Today" }, "", BASE_PATH + "/dashboard" + location.search);
    history.pushState({ page: pageId, depth: 1, from: "Today", title: null, seeded: true }, "", here);
  }catch(e){ return false; }
  return true;
}
// Reports → a report chosen: its own entry, so Back returns to the one before.
export function syncReportRoute(){
  if(currentPage === "reports") syncUrl("reports", false);
}
export function parseRouteFromLocation(){
  var path = location.pathname;
  if(BASE_PATH && path.indexOf(BASE_PATH) === 0) path = path.slice(BASE_PATH.length);
  var segs = path.split("/").filter(Boolean).map(function(s){
    try{ return decodeURIComponent(s).toLowerCase(); }catch(e){ return s.toLowerCase(); }
  });
  if(!segs.length) return null;
  // A detail page's id keeps its case (a person's name).
  if(segs[0] === "detail"){
    var raw = path.split("/").filter(Boolean);
    var did = raw[2] ? (function(){ try{ return decodeURIComponent(raw[2]); }catch(e){ return raw[2]; } })() : null;
    return did ? { page: "detail", sub: null, detail: { kind: segs[1], id: did } } : { page: "dashboard", sub: null };
  }
  // An editor needs the scenario it was opened on: a reload lands on the list, where its draft waits.
  if(segs[0] === "scenario") return { page: "plan", sub: "scenarios" };
  if(ALIASES[segs[0]]) return { page: ALIASES[segs[0]][0], sub: ALIASES[segs[0]][1] };
  var page = PAGES.find(function(p){ return p.id === segs[0]; });
  if(!page) return null;
  var sub = null;
  if(page.id === "assets" && segs[1] && SLUG_TO_ASSETS_SUB[segs[1]]) sub = SLUG_TO_ASSETS_SUB[segs[1]];
  else if(page.id === "expenses" && segs[1] && EXPENSES_SUBS.indexOf(segs[1]) !== -1) sub = segs[1];
  else if(page.id === "tax" && segs[1] && TAX_SUBS.indexOf(segs[1]) !== -1) sub = segs[1];
  else if(page.id === "plan" && segs[1] && PLAN_SUBS.indexOf(segs[1]) !== -1) sub = segs[1];
  else if(page.id === "settings" && segs[1] && SETTINGS_SUBS.indexOf(segs[1]) !== -1) sub = segs[1];
  else if(page.id === "dashboard" && segs[1] && DASHBOARD_SUBS.indexOf(segs[1]) !== -1) sub = segs[1];
  else if(page.id === "reports" && segs[1] && reportKeyValid(segs[1])) sub = segs[1];
  else if(page.id === "settings" && segs[1] && MOVED_SETTINGS[segs[1]]) return { page: MOVED_SETTINGS[segs[1]][0], sub: MOVED_SETTINGS[segs[1]][1] };
  return { page: page.id, sub: sub };
}

// Pages reachable directly from the mobile bottom tab bar; the rest live behind its "More"
// tab. Scenarios/Projections are occasional "what-if" pages, unlike the four data-entry
// pages above them, so the More tab's own active state also lights up for those two.
//
// Tax lives behind More all year (v3.54.2): it took Assets' place in the bar from July to October
// for a while, but Assets is opened far more often than Tax, even in lodgement season — and a tab
// bar that rearranges itself by the calendar costs more than the one tap it saves.
// v3.57.0: the bar is the four everyday jobs — Home, Cash flow, Accounts, Investments — and the
// rest (Property, Tax, Plan, Settings) sit behind More.
// v3.129.0: the pages under Net worth — its nav entry and tab stay lit on each of them.
var NETWORTH_GROUP = ["networth", "accounts", "assets", "properties"];
// #412: the pages a phone's More tab holds — it stays lit on each. A desktop's sidebar lists them itself.
var MORE_GROUP = ["more", "tax", "reports", "calc", "settings"];
// Today's views besides its first, opened from links on it (no tab rail since #412), each named in the header.
var DASHBOARD_TITLES = { insights: "Insights", benchmarks: "How you compare", review: "Monthly review" };
function titleFor(id){
  if(id === "dashboard" && DASHBOARD_TITLES[currentDashboardSub]) return DASHBOARD_TITLES[currentDashboardSub];
  var page = PAGES.find(function(p){ return p.id === id; });
  return page ? page.label : "Today";
}


// Plain-button pages: the page's own single, unambiguous "add" entry point. Income/Assets/
// Scenarios are handled separately below (grouped by person/category/scenario, so there's no one
// global button — the first currently-visible [data-add] element stands in for "the" action on
// whichever group/subpage is showing). Dashboard has no add button at all — logging net worth is
// a direct function call, dispatched by app.js's click handler via data-fab-mode="networth"
// rather than a selector, since there's nothing in the DOM to click. Projections has no natural
// "add" action and simply isn't listed, so the fab hides there.
var QUICK_FAB_BUTTON_PAGES = {
  // Log spend on both of Expenses' halves, not just Spending. Budget briefly had its own "Add
  // expense" action, but that made the page's most frequent job — logging what you just spent —
  // cost an extra tap whenever you arrived on Expenses, which opens on Budget. Adding a budget
  // line is well served without the fab (the ledger footer and every classification card carry
  // their own "+ Add expense"), and it's a set-up-day action, not a daily one. #quickLogBtn lives
  // on the Spending subpage, but a hidden button still clicks fine and the sheet covers the page
  // either way — so logging from Budget lands you back on Budget with the bars already updated.
  expenses: { label: "Log spend", selector: "#quickLogBtn" },
  properties: { label: "Add property", selector: "#addPropertyBtn" }
};
// Accounts' fab follows its visible half, the same way Expenses' used to — resolved per subpage
// rather than per page, so it can't sit in the map above.
function accountsFabAction(){
  var showing = function(id){ var el = document.getElementById(id); return el && !el.hidden; };
  if(showing("accountsSub-categories")) return { label: "Add category", selector: "#addCategoryBtn" };
  if(showing("accountsSub-people")) return { label: "Add person", selector: "#addPersonBtn" };
  return { label: null, selector: null };
}
// The first visible [data-add] inside `rootId` — for pages whose add buttons are per group.
function groupedFabTarget(rootId){
  var section = document.getElementById(rootId);
  var candidates = section ? section.querySelectorAll("[data-add]") : [];
  var target = Array.prototype.find.call(candidates, function(el){ return el.offsetParent !== null; });
  if(!target) return null;
  // Re-found by this same attribute at click time (see app.js), not stored as an element reference
  // — a re-render can replace the actual node before the button is tapped, but the data-add value
  // itself stays stable for the same logical group.
  return { label: (target.textContent || "").replace(/^\+\s*/, "").trim() || "Add",
    selector: '[data-add="' + CSS.escape(target.getAttribute("data-add")) + '"]' };
}
// Every "add or log something" the app can do, in one list, reachable from any page via the fab's
// chevron (#304: now the avatar menu's "Quick actions"). The point is the cross-page case: the fab itself can only trigger what's already on
// screen, so adding a share from the Dashboard meant navigating to Assets, switching to the Shares
// subpage and only then tapping the fab. These carry their own destination, so one tap gets there.
//
// Ordered by how often a household actually does them, not by how the app is organised — logging
// spend is a daily act, adding a property is a once-every-few-years one.
export var QUICK_ACTIONS = [
  { label: "Log spend",     hint: "A real transaction against a budget line", page: "expenses",   sub: "spending", selector: "#quickLogBtn", group: "log" },
  { label: "Add expense",   hint: "A new planned budget line",                page: "expenses",   sub: "budget",   selector: '[data-add="shared"]', group: "add", short: "Budget line" },
  { label: "Log income",    hint: "Pay, rent or a distribution that came in", page: "income",     mode: "received", group: "log" },
  // v3.208.0 (item 240): only offered with an investment property — the statement form, on its Income & costs tab.
  { label: "Log a rent statement", hint: "A property manager's monthly statement", page: "properties", mode: "rentstatement", needsIP: true, group: "log" },
  // v3.141.0: a card repayment is a transfer — this opens the form with the card and its payment in.
  { label: "Pay a card",    hint: "A repayment to a credit card", page: "expenses", sub: "spending", mode: "paycard", group: "log" },
  // No selector on these three: Income and Assets build their add buttons per person/category
  // (data-add="income:<person>", "assets:Cash", "holding"), so the value isn't knowable from here.
  // They resolve to the first visible [data-add] on the destination page instead — the same way
  // updateQuickFab already targets those pages, and robust to the row markup changing.
  { label: "Add income",    hint: "A salary, rent or other income row",       page: "income", group: "add", short: "Income" },
  { label: "Add shares",    hint: "A holding in the Shares list",             page: "assets",     sub: "Shares", group: "add", short: "Shares" },
  { label: "Add cash",      hint: "A savings or offset balance",              page: "assets",     sub: "Cash", group: "add", short: "Cash account" },
  { label: "Add property",  hint: "A home or investment property",            page: "properties", selector: "#addPropertyBtn", group: "add", short: "Property" },
  { label: "Add account",   hint: "A bank or credit card account",            page: "accounts",   selector: "#addAccountBtn", group: "add", short: "Bank or card account" },
  // #426: from a statement or the bank's app — which account, then that account's own balance form.
  // (#426: "Record net worth" is Net worth's own action now — the sheet's first row there — and on Today's projection
  // card; it made the sheet scroll on a 320px phone beside this.)
  { label: "Update a balance", hint: "From a statement or your bank's app",       page: "accounts",   mode: "balance", group: "log" }
];
// Reuses the .review-backdrop/.review-panel sheet shell every other overlay in this app uses (see
// ledger.css), so this inherits the bottom-anchored-on-mobile treatment and the shared backdrop
// behaviour for free rather than inventing a third overlay shape.
// Simpler navigation step 2 (#411): the + button always opens this sheet. It leads with what this page itself adds (the
// page's action, as updateQuickFab found it), then logging, importing and adding — one button that always does the same
// thing, where before it ran the page's action on some pages and opened this list on others.
var SHEET_GROUPS = [["log", "Log"], ["import", "Import"], ["add", "Add something new"]];
function sheetRow(attr, label, hint){
  return '<button type="button" class="qfab-action" ' + attr + '><span class="qfab-action-label">' + escapeAttr(label) + '</span>' +
    '<span class="qfab-action-hint">' + escapeAttr(hint) + '</span></button>';
}
export function quickActionsSheetHtml(){
  var hasIP = (state.properties || []).some(function(p){ return p && p.kind === "IP"; });
  var own = pageAction && pageAction.label && !QUICK_ACTIONS.some(function(a){ return a.label === pageAction.label; }) ? pageAction : null;
  var html = own ? '<h5 class="qfab-group">On this page</h5>' + sheetRow('data-quick-page', own.label, "Here, on " + pageLabel(currentPage)) : "";
  SHEET_GROUPS.forEach(function(g){
    var rows = g[0] === "import"
      ? sheetRow('data-quick-import', "Import a file", "Statements, payslips, trades, prices or a spreadsheet")
      : QUICK_ACTIONS.map(function(action, i){
        if(action.group !== g[0] || (action.needsIP && !hasIP)) return "";
        // Adding is named by what it adds, two to a row: the sheet fits a phone without scrolling.
        if(g[0] === "add") return '<button type="button" class="qfab-chip" data-quick-action="' + i + '" title="' + escapeAttr(action.hint) + '" aria-label="' + escapeAttr(action.label + ": " + action.hint) + '">' + escapeAttr(action.short) + '</button>';
        return sheetRow('data-quick-action="' + i + '"', action.label, action.hint);
      }).join("");
    if(rows) html += '<h5 class="qfab-group">' + g[1] + '</h5>' + (g[0] === "add" ? '<div class="qfab-chips">' + rows + '</div>' : rows);
  });
  return '<div class="review-backdrop" data-qfab-backdrop>' +
    '<div class="review-panel qfab-panel" role="dialog" aria-label="Add, log or import">' +
      '<div class="review-head"><h4>Add, log or import</h4><button type="button" class="icon-btn" data-qfab-close aria-label="Close">✕</button></div>' +
      '<div class="qfab-actions">' + html + '</div>' +
    '</div></div>';
}
function pageLabel(id){ var p = PAGES.find(function(x){ return x.id === id; }); return p ? p.label : "this page"; }
// This page's own add or log action, for the sheet's first row and an empty state's next step (chromewiring.js).
var pageAction = null;
export function currentPageAction(){ return pageAction; }

// Re-targets the quick-action button for whichever page/subpage is now visible — called after
// every page switch and Assets subpage switch (see applyPageChange/showAssetsSubpage below), so
// tapping it always performs the single most useful "add/log something" action for wherever the
// user currently is, without them having to scroll to that page's own +Add button first.
export function updateQuickFab(pageId){
  var fab = document.getElementById("quickFab");
  if(!fab) return;
  var label = null, mode = null, selector = null;
  var grouped = null;
  if(pageId === "dashboard"){
    label = "Log spend";
    selector = "#quickLogBtn";
    mode = "spending";
  } else if(pageId === "networth"){
    // #426: a snapshot of today's total belongs with the total.
    label = "Record net worth"; mode = "networth";
  } else if(pageId === "accounts"){
    label = "Add account"; selector = "#addAccountBtn";
  } else if(pageId === "settings"){
    var settingsAction = accountsFabAction();
    label = settingsAction.label;
    selector = settingsAction.selector;
  } else if(pageId === "plan"){
    if(currentPlanSub === "scenarios") grouped = groupedFabTarget("planSub-scenarios");
  } else if(pageId === "assets"){
    grouped = groupedFabTarget("page-assets");
  } else if(QUICK_FAB_BUTTON_PAGES[pageId]){
    label = QUICK_FAB_BUTTON_PAGES[pageId].label;
    selector = QUICK_FAB_BUTTON_PAGES[pageId].selector;
  }
  if(grouped){ label = grouped.label; selector = grouped.selector; }
  // #411: the button always opens the sheet (quickActionsSheetHtml), named the same everywhere; this page's own action
  // is remembered for the sheet's first row and for an empty state's next step (runPageAction, chromewiring.js).
  pageAction = label ? { label: label, mode: mode, selector: selector } : null;
  fab.hidden = false;
  var headerBtn = document.getElementById("headerAddBtn"), headerLabel = document.getElementById("headerAddLabel");
  if(headerBtn) headerBtn.hidden = false;
  if(headerLabel) headerLabel.textContent = "Add";
  [fab, headerBtn].forEach(function(btn){
    if(!btn) return;
    btn.setAttribute("aria-label", "Add, log or import");
    btn.title = "Add, log or import";
    btn.setAttribute("aria-haspopup", "dialog");
  });
  // #255: it is the view's primary only when the page has an action of its own and shows no primary of its own —
  // lib/help.js's updatePageHelp() settles that as the page changes.
  if(headerBtn) headerBtn.toggleAttribute("data-page-action", !!label);
}
// Overlays that live *outside* any .app-page section (the row-edit modal and its backdrop, the
// search sheet, the quick-log sheet, the expense review) have to be torn down when the page
// changes, or they hang over whatever you navigated to — and worse, the history entry
// pushActiveOverlay() left behind gets stranded under the page entry syncUrl() pushes next, so
// the overlay's own close path stops working entirely.
//
// app.js owns those primitives and can't be imported from here without a cycle, so it registers
// its cleanup once at startup. Pure DOM/state cleanup only, no history: showPage is about to write
// the history entry itself.
var overlayCleanup = null;
export function setOverlayCleanup(fn){ overlayCleanup = fn; }
var leaveGuard = null;
var leavePending = null;
function afterNavigation(result, next){
  if(result && typeof result.then === "function") return result.then(function(ok){ return ok ? next() : false; });
  return result ? next() : false;
}
function afterPendingPage(page, next){
  return afterNavigation(leavePending, function(){ return currentPage === page ? next() : false; });
}
export function setLeaveGuard(fn){ leaveGuard = fn; }
export function showPage(id, opts){
  opts = opts || {};
  // #425: where the page being left was scrolled to, kept on its history entry when the next one is pushed (syncUrl),
  // so Back returns to the same place in a long list. Read now: the page change scrolls to the top before it writes.
  // Not on Back (skipUrl): the address has already changed to the entry being returned to.
  if(!opts.skipUrl && currentPage && id !== currentPage) leavingScroll = { path: location.pathname, y: window.scrollY || 0 };
  if(ALIASES[id]){
    var to = ALIASES[id];
    return afterNavigation(showPage(to[0], opts), function(){
      if(to[0] === "expenses") showExpensesSubpage(to[1], { replace: true, skipUrl: opts.skipUrl });
      if(to[0] === "plan") showPlanSubpage(to[1], { replace: true, skipUrl: opts.skipUrl });
      return true;
    });
  }
  if(!PAGES.some(function(p){ return p.id === id; })) id = "dashboard";
  // v3.188.0 (item 219): leaving a scenario with unsaved changes asks first (its calculators aside).
  if(!opts.guardApproved && currentPage === "scenario" && id !== "scenario" && id !== "calc" && leaveGuard){
    if(leavePending) return false;
    var allowed = leaveGuard(id);
    if(allowed && typeof allowed.then === "function"){
      leavePending = allowed.then(function(ok){
        leavePending = null;
        if(ok) return showPage(id, Object.assign({}, opts, { guardApproved: true }));
        if(opts.skipUrl && location.pathname !== buildRoutePath("scenario")) history.pushState({ page: "scenario" }, "", buildRoutePath("scenario") + location.search);
        return false;
      });
      return leavePending;
    }
    if(!allowed){
      if(opts.skipUrl && location.pathname !== buildRoutePath("scenario")) history.pushState({ page: "scenario" }, "", buildRoutePath("scenario") + location.search);
      return false;
    }
  }
  currentPage = id;
  pendingPageWrite = opts.skipUrl ? null : { page: id, replace: !!opts.replace };
  // The editor or sheet open as this was asked for is the one leaving the page closes. One opened while the change
  // waits for its transition stays: on a slow device the app's first page change applied after an empty household's
  // setup sheet had opened by itself, closed it, and recorded setup as skipped before anyone touched anything.
  var closesOverlay = overlayOpen();

  function applyPageChange(){
    // A view transition runs this later, so a second showPage() in the same tick (showPage("accounts")
    // then showAccountsSubpage("checks"), which moves on to Settings) would otherwise land second
    // and leave the first page's URL and title behind. The newest request wins.
    if(currentPage !== id) return;
    // The per-scenario expense override panel (Expenses page) is a fixed-position overlay
    // appended outside any .app-page section, so it would otherwise stay visible on top of
    // whatever page the user navigates to next.
    closeScenarioOverridePanel();
    if(overlayCleanup && closesOverlay) overlayCleanup();
    // #414: what "Show more on this page" brought back was for that visit.
    hideShownAgain();
    // #425: a Details page and the scenario editor light the section they belong to (a holding's, Net worth).
    var section = id === "detail" || id === "scenario" ? sectionOf({ page: id, detail: { kind: detailTarget.kind, id: detailTarget.id } }, state) : id;
    var navId = NETWORTH_GROUP.indexOf(section) !== -1 ? "networth" : section;
    var tabId = MORE_GROUP.indexOf(navId) !== -1 ? "more" : navId;
    // v3.205.0 (item 236a): what a full redraw left for later, drawn before the page shows.
    drawStale(id);
    PAGES.forEach(function(p){
      var section = document.getElementById("page-" + p.id);
      if(section) section.hidden = (p.id !== id);
      document.querySelectorAll('.nav-item[data-page="' + p.id + '"], .mobile-tab[data-page="' + p.id + '"]').forEach(function(navBtn){
        var on = p.id === (navBtn.classList.contains("mobile-tab") ? tabId : navId);
        navBtn.classList.toggle("active", on);
        if(on) navBtn.setAttribute("aria-current", "page"); else navBtn.removeAttribute("aria-current");
      });
    });
    document.querySelectorAll(".nw-rail-item").forEach(function(b){ markCurrent(b, b.getAttribute("data-page") === id); });
    var page = PAGES.find(function(p){ return p.id === id; });
    // v3.138.0: styles can tell which page is showing (Home hides the header's net worth pill — its
    // first card says the same thing a few pixels below).
    // Its own name (v3.139.1): `data-page` marks the buttons that go to a page, and a click handler
    // looking for the nearest one found <body> — the mobile More tab opened the current page instead.
    document.body.setAttribute("data-current-page", id);
    document.getElementById("pageTitle").textContent = titleFor(id);
    var navLabel = document.getElementById("navMenuCurrentLabel");
    if(navLabel) navLabel.textContent = page ? page.label : "Today";
    if(id === "more") renderMorePage();
    // A detail page needs its target, which a later visit won't have.
    if(id !== "detail" && id !== "scenario") try{ localStorage.setItem(PAGE_KEY, id); }catch(e){}
    renderPeriodButton();
    if(id === "dashboard"){ renderDashboardStats(); renderHomeSummary(); }
    if(id === "reports") renderReports();
    if(id === "detail") renderDetailPage();
    if(id === "scenario"){ renderHomeBody(); renderScenarioEditor(); }
    if(id === "calc"){ renderCalcScenario(); renderCalcTools(); }
    if(id === "plan" && currentPlanSub === "projections") renderProjectionsIfStale();
    if(id === "networth") renderNetWorthPage();
    // v3.98.0: the notices read figures changed on other pages. Since #305 only Home → Insights shows them in full
    // (every other page has one line, drawn by attentionline.js).
    if(id === "dashboard") renderAdvice();
    // The worksheet only re-renders itself while visible (see income.js refreshOpenTaxYear), so
    // arriving on Tax brings it up to date with whatever changed elsewhere in the meantime.
    if(id === "tax") renderTaxYear();
    // Received is planned against the income rows, rent and holdings, which change elsewhere.
    if(id === "expenses" && currentExpensesSub === "budget") renderReceived();
    updateQuickFab(id);
    if(!opts.skipScroll) window.scrollTo(0, 0);
    if(pendingPageWrite && pendingPageWrite.page === id) pendingPageWrite = null;
    if(!opts.skipUrl) syncUrl(id, !!opts.replace); else renderBackLink();
    renderShowMore();
  }

  // A plain hidden-toggle instant swap is the single biggest "this is a website, not an app" tell
  // in the whole nav. The View Transitions API cross-fades old/new page content automatically —
  // no manual before/after class choreography — and simply isn't called at all on browsers
  // without support (Firefox, older Safari) or when the user prefers reduced motion, so this is
  // pure enhancement with no fallback path to maintain.
  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(document.startViewTransition && !prefersReducedMotion){
    var transition = document.startViewTransition(applyPageChange);
    // Chromium may time out the animation even though the synchronous page update succeeds.
    // Await the update separately so real render failures still reject navigation.
    return pageTransitionDone(transition).then(function(){ return currentPage === id; });
  } else {
    applyPageChange();
  }
  return true;
}

// Now that a subnav scrolls instead of wrapping, the active tab can be off-screen when a page is
// entered rather than tapped — a deep link to /assets/other, or restoring the last subpage on
// load. Both leave the rail showing "Summary … Shares" with no sign that the visible content is
// Other. Nothing needs doing when the tab is already in view, which scrollIntoView with
// "nearest" handles by itself.
function scrollActiveSubnavIntoView(railId){
  var rail = document.getElementById(railId);
  var active = rail && rail.querySelector(".subnav-item.active");
  if(!active || !active.scrollIntoView) return;
  // inline:"nearest" scrolls the rail horizontally; block:"nearest" is what stops it dragging the
  // whole *page* down to the rail as a side effect.
  try{ active.scrollIntoView({ inline: "nearest", block: "nearest" }); }catch(e){}
}
export function showAssetsSubpage(id, opts){
  opts = opts || {};
  if(leavePending) return afterPendingPage("assets", function(){ return showAssetsSubpage(id, Object.assign({}, opts, { replace: true })); });
  if(id === "summary" || !ASSETS_SUB_TO_SLUG[id]) id = "Cash";   // #413: no Summary tab now
  currentAssetsSub = id;
  document.querySelectorAll(".assets-subpage").forEach(function(el){ el.hidden = el.id !== "assetsSub-" + id; });
  document.querySelectorAll("#assetsSubnav .subnav-item").forEach(function(btn){
    markCurrent(btn, btn.getAttribute("data-assets-sub") === id);
  });
  updateQuickFab("assets");
  scrollActiveSubnavIntoView("assetsSubnav");
  if(!opts.skipUrl) syncUrl("assets", !!opts.replace, true);
  renderShowMore();
}

// Accounts vs. Categories — the two registries this app asks you to maintain. Session-only, like
// the Dashboard's own split and unlike Assets/Expenses: there's no reason to deep-link a settings
// registry, and keeping it out of the URL keeps buildRoutePath to the two subpages worth sharing.
//
// Since v3.57.0 Accounts is only the accounts; People, Categories, Preferences and Checks are
// Settings. The name stayed because a dozen callers ask for "accounts → checks"; it now opens
// whichever page holds that tab.
export function showAccountsSubpage(id, opts){
  opts = opts || {};
  if(leavePending) return afterNavigation(leavePending, function(){ return showAccountsSubpage(id, Object.assign({}, opts, { replace: true })); });
  if(MOVED_SETTINGS[id]){
    var to = MOVED_SETTINGS[id];
    return afterNavigation(showPage(to[0], opts), function(){
      if(to[0] === "tax") showTaxSubpage(to[1], { replace: true, skipUrl: opts.skipUrl });
      else { showDashboardSubpage(to[1], { replace: true, skipUrl: opts.skipUrl }); setTimeout(function(){ var c = document.getElementById("checksCard"); if(c && c.scrollIntoView) c.scrollIntoView({ block: "start", behavior: "smooth" }); }, 250); }
      return true;
    });
  }
  if(id === "accounts" || SETTINGS_SUBS.indexOf(id) === -1) return currentPage === "accounts" ? true : showPage("accounts", opts);
  if(currentPage !== "settings") return afterNavigation(showPage("settings", Object.assign({}, opts, { skipUrl: true })), function(){ return showAccountsSubpage(id, opts); });
  currentSettingsSub = id;
  document.querySelectorAll("#page-settings .accounts-subpage").forEach(function(el){ el.hidden = el.id !== "accountsSub-" + id; });
  document.querySelectorAll("#accountsSubnav .subnav-item").forEach(function(btn){
    markCurrent(btn, btn.getAttribute("data-accounts-sub") === id);
  });
  scrollActiveSubnavIntoView("accountsSubnav");
  updateQuickFab("settings");
  if(!opts.skipUrl) syncUrl("settings", !!opts.replace, true);
  if(id === "preferences") renderPageUse();
  renderShowMore();
  return true;
}
export function settingsSubpage(){ return currentSettingsSub; }

export function showPlanSubpage(id, opts){
  opts = opts || {};
  if(leavePending) return afterPendingPage("plan", function(){ return showPlanSubpage(id, Object.assign({}, opts, { replace: true })); });
  if(PLAN_SUBS.indexOf(id) === -1) id = "scenarios";
  currentPlanSub = id;
  document.querySelectorAll(".plan-subpage").forEach(function(el){ el.hidden = el.id !== "planSub-" + id; });
  document.querySelectorAll("#planSubnav .subnav-item").forEach(function(btn){
    markCurrent(btn, btn.getAttribute("data-plan-sub") === id);
  });
  scrollActiveSubnavIntoView("planSubnav");
  if(id === "projections") renderProjectionsIfStale();
  updateQuickFab("plan");
  if(!opts.skipUrl) syncUrl("plan", !!opts.replace, true);
  renderShowMore();
}

export function showTaxSubpage(id, opts){
  opts = opts || {};
  if(leavePending) return afterPendingPage("tax", function(){ return showTaxSubpage(id, Object.assign({}, opts, { replace: true })); });
  if(TAX_SUBS.indexOf(id) === -1) id = currentTaxSub || defaultTaxSub();
  currentTaxSub = id;
  document.querySelectorAll(".tax-subpage").forEach(function(el){ el.hidden = el.id !== "taxSub-" + id; });
  document.querySelectorAll("#taxSubnav .subnav-item").forEach(function(btn){
    markCurrent(btn, btn.getAttribute("data-tax-sub") === id);
  });
  scrollActiveSubnavIntoView("taxSubnav");
  updateQuickFab("tax");
  if(!opts.skipUrl) syncUrl("tax", !!opts.replace, true);
  renderShowMore();
}
export function taxSubpage(){ return currentTaxSub || defaultTaxSub(); }
export function dashboardSubpage(){ return currentDashboardSub; }
export function planSubpage(){ return currentPlanSub; }
// #412: More's Tax row says when a return is due, since Tax left the phone's tab bar.
function renderMorePage(){
  var flag = document.getElementById("moreTaxFlag");
  if(!flag) return;
  var st = lodgementStatus(localDateStr());
  flag.hidden = !st.inSeason;
  flag.textContent = st.inSeason ? "Lodge by 31 Oct" : "";
}

// Budget (what you plan to spend) vs. Spending (what you actually spent, logged against it) —
// same pill-subnav + URL-sync pattern as showAssetsSubpage above, and deep-linkable for the same
// reason: "open my spending for the month" is a thing worth bookmarking on a phone. The split
// exists because the two halves are used on completely different rhythms — the budget is set up
// once and revisited occasionally, spending is logged constantly — and stacking all four ledgers
// on one page made the everyday half the one you had to scroll past the other to reach.
export function showExpensesSubpage(id, opts){
  opts = opts || {};
  if(leavePending) return afterPendingPage("expenses", function(){ return showExpensesSubpage(id, Object.assign({}, opts, { replace: true })); });
  var toMoneyIn = id === "income";
  if(EXPENSES_SUBS.indexOf(id) === -1) id = "budget";
  currentExpensesSub = id;
  document.querySelectorAll(".expenses-subpage").forEach(function(el){ el.hidden = el.id !== "expensesSub-" + id; });
  // A view that draws into one tab (lib/views.js opts.tabs) was left stale while another showed.
  if(currentPage === "expenses") drawStale("expenses");
  document.querySelectorAll("#expensesSubnav .subnav-item").forEach(function(btn){
    markCurrent(btn, btn.getAttribute("data-expenses-sub") === id);
  });
  scrollActiveSubnavIntoView("expensesSubnav");
  renderPeriodButton();
  // Received is planned against the income rows, rent and holdings, which change elsewhere — it is on Budget now.
  if(id === "budget") renderReceived();
  updateQuickFab("expenses");
  if(!opts.skipUrl) syncUrl("expenses", !!opts.replace, true);
  renderShowMore();
  // An old Income link (a notice, search, /expenses/income) opens Budget at Money in, once the page has shown.
  if(toMoneyIn) restoreAnchor("moneyIn");
}
function restoreAnchor(id){
  var tries = 0;
  (function wait(){
    var el = document.getElementById(id);
    if(el && document.body.getAttribute("data-current-page") === "expenses" && el.getClientRects().length){
      return requestAnimationFrame(function(){ try{ el.scrollIntoView({ block: "start" }); }catch(e){} });
    }
    if(++tries < 90) requestAnimationFrame(wait);
  })();
}

// Overview (top stats + scenario cards) vs. Insights (50/30/20, FI progress, actual vs. expected,
// upcoming bills, projection accuracy) — same pill-subnav pattern as showAssetsSubpage above, so a
// daily glance at Dashboard only pays for the six Insights cards' scroll length when actually
// wanted. Navigating away and back to Home keeps whichever tab was last open, since the subpage <div>s are never
// destroyed. Since simpler navigation step 1 each tab has its own address (/dashboard/insights), so Back steps
// through them; Overview stays /dashboard.
export function showDashboardSubpage(id, opts){
  opts = opts || {};
  if(leavePending) return afterPendingPage("dashboard", function(){ return showDashboardSubpage(id, Object.assign({}, opts, { replace: true })); });
  if(DASHBOARD_SUBS.indexOf(id) === -1) id = "overview";
  currentDashboardSub = id;
  document.querySelectorAll(".dashboard-subpage").forEach(function(el){ el.hidden = el.id !== "dashboardSub-" + id; });
  document.querySelectorAll(".today-more [data-dashboard-sub]").forEach(function(btn){
    markCurrent(btn, btn.getAttribute("data-dashboard-sub") === id);
  });
  // Drawn here, not by whatever opened it — a link on Today, a notice, a shared /dashboard/benchmarks or Back.
  if(id === "benchmarks") renderBenchmarks();
  if(id === "review"){ renderMonthReview(); renderHealth(); }
  if(currentPage === "dashboard"){ document.getElementById("pageTitle").textContent = titleFor("dashboard"); window.scrollTo(0, 0); }
  renderPeriodButton();
  if(currentPage === "dashboard" && !opts.skipUrl) syncUrl("dashboard", !!opts.replace, true);
}

// Mobile-only dropdown: appNav is a vertical panel behind this toggle below 880px
// (see styles.css), so a page's 7 tabs stay reachable without horizontal scroll-hunting.
export function closeNavMenu(){
  document.querySelector(".app-sidebar").classList.remove("nav-open");
  document.getElementById("navMenuToggle").setAttribute("aria-expanded", "false");
}


