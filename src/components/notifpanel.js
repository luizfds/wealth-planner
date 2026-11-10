// ---------------- The bell (v3.206.1, item 237) ----------------
//
// The notifications panel and its badge, moved out of app.js as they were; app.js calls wireNotifications()
// where its listeners used to be added.
import { escapeAttr } from "../lib/html.js";
import { getNotifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } from "../lib/notifications.js";
import { attentionItems, viewItems, canDismiss } from "../lib/attention.js";
import { renderHealth } from "./health.js";
import { renderMonthReview } from "./monthreview.js";
import { showPage, showDashboardSubpage, showExpensesSubpage, showAccountsSubpage, showTaxSubpage, currentView } from "./nav.js";
import { openTxReview } from "./spendingwiring.js";
import { renderTaxYear, setTaxYearSelected } from "./taxyear.js";

var notifPanelOpen;
// #305: opened from a page's line, the list shows only what is about that view, with a way to the rest.
var panelView = null;

export function renderNotifBadge(){
  var count = unreadNotificationCount();
  document.querySelectorAll(".notif-bell-btn").forEach(function(btn){
    btn.setAttribute("aria-label", count ? "Notifications, " + (count > 9 ? "9+" : count) + " unread" : "Notifications");
  });
  document.querySelectorAll(".notif-badge").forEach(function(el){
    el.textContent = count > 9 ? "9+" : String(count);
    el.hidden = count === 0;
  });
}
function closeNotifPanel(){
  if(!notifPanelOpen) return;
  notifPanelOpen = false;
  var root = document.getElementById("notifPanelRoot");
  if(root) root.innerHTML = "";
  document.querySelectorAll(".notif-bell-btn").forEach(function(btn){ btn.setAttribute("aria-expanded", "false"); });
}
// #305: one row for every item — its label (Urgent, To do, Watch, Opportunity, Worth knowing), its title and a
// line of detail. A To do goes where it is done; an observation goes to its figures.
function goAttrs(n){
  if(n.group === "know"){
    if(n.go && n.go.filter) return ' data-sv' + Object.keys(n.go.filter).map(function(k){ return ' data-sv-' + k + '="' + escapeAttr(n.go.filter[k]) + '"'; }).join("");
    return n.go ? ' data-adv-go="' + escapeAttr(n.go.page) + '"' + (n.go.sub ? ' data-adv-sub="' + escapeAttr(n.go.sub) + '"' : '') : '';
  }
  return ' data-notif-id="' + escapeAttr(n.id) + '" data-notif-page="' + escapeAttr(n.page) + '"' + (n.sub ? ' data-notif-sub="' + escapeAttr(n.sub) + '"' : '') +
    (n.action ? ' data-notif-action="' + escapeAttr(n.action) + '"' : '') + (n.fy != null ? ' data-notif-fy="' + escapeAttr(String(n.fy)) + '"' : '');
}
function notifItemHtml(n){
  // An observation that can be put away gets a second button beside its row (a button can't hold a button).
  if(n.group === "know" && canDismiss(n)) return '<div class="notif-row">' + rowButtonHtml(n) +
    '<button type="button" class="icon-btn notif-dismiss" data-notice-dismiss="' + escapeAttr(n.id) + '" aria-label="' + escapeAttr("Dismiss: " + n.title) + '" title="Dismiss — it comes back if its figures change">✕</button></div>';
  return rowButtonHtml(n);
}
function rowButtonHtml(n){
  return '<button type="button" class="notif-item' + (n.group === "todo" && !n.read ? " is-unread" : "") + '"' + goAttrs(n) + '>' +
    '<span class="notif-item-body"><span class="notif-label ' + escapeAttr(n.tone) + '">' + escapeAttr(n.label) + '</span>' +
    '<span class="notif-item-title">' + escapeAttr(n.title) + '</span><span class="notif-item-detail">' + escapeAttr(n.detail) + '</span></span>' +
  '</button>';
}
function groupHtml(title, items, empty){
  return '<section class="notif-group" aria-label="' + title + '"><h3 class="notif-group-title">' + title + (items.length ? ' <span>' + items.length + '</span>' : '') + '</h3>' +
    (items.length ? '<div class="notif-list">' + items.map(notifItemHtml).join("") + '</div>' : '<p class="notif-empty">' + empty + '</p>') + '</section>';
}
function renderNotifPanelContent(){
  var root = document.getElementById("notifPanelRoot");
  if(!root) return;
  var all = panelView ? viewItems(panelView) : attentionItems();
  var hasUnread = all.todo.some(function(n){ return !n.read; });
  var scope = panelView ? '<p class="notif-scope">About this page <button type="button" class="link-btn" data-notif-all>Show everything</button></p>' : '';
  root.innerHTML = '<div class="notif-panel" id="notifPanel" role="dialog" aria-label="What needs attention">' +
    '<div class="notif-panel-head"><h2>What needs attention</h2><button type="button" class="notif-mark-all-btn" id="notifMarkAllBtn"' + (hasUnread ? "" : " disabled") + '>Mark all read</button></div>' + scope +
    (panelView && !all.todo.length ? "" : groupHtml("To do", all.todo, "All done — nothing needs you right now.")) +
    (all.know.length ? groupHtml("Worth knowing", all.know, "") : "") +
  '</div>';
}
// Rendered into #notifPanelRoot (a position:fixed root outside any scrolling ancestor — see the
// CSS comment on .notif-panel), so it's positioned in JS from the trigger button's own bounding
// rect rather than plain CSS anchoring, keeping it correct regardless of which of the two trigger
// buttons (desktop vs. mobile — different places in the layout entirely) opened it.
function positionNotifPanel(triggerBtn){
  var panel = document.getElementById("notifPanel");
  if(!panel || !triggerBtn) return;
  var rect = triggerBtn.getBoundingClientRect();
  var width = panel.offsetWidth || 340;
  var left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
  var top = Math.min(rect.bottom + 8, window.innerHeight - 60);
  panel.style.left = left + "px";
  panel.style.top = top + "px";
}
function openNotifPanel(triggerBtn, view){
  panelView = view || null;
  notifPanelOpen = true;
  renderNotifPanelContent();
  positionNotifPanel(triggerBtn);
  document.querySelectorAll(".notif-bell-btn").forEach(function(btn){ btn.setAttribute("aria-expanded", String(btn === triggerBtn)); });
}

// After an observation is put away from somewhere else while the list is open.
export function refreshNotifPanel(){ if(notifPanelOpen) renderNotifPanelContent(); }
// Where a To do is done. One function for the bell's rows and Home's To do, which carry the same attributes.
export function followNotification(el){
  var page = el.getAttribute("data-notif-page"), sub = el.getAttribute("data-notif-sub"), action = el.getAttribute("data-notif-action"), fy = el.getAttribute("data-notif-fy");
  markNotificationRead(el.getAttribute("data-notif-id"));
  renderNotifBadge();
  closeNotifPanel();
  if(action === "backup"){ var exp = document.getElementById("exportBtn"); if(exp) exp.click(); return; }
  if(action === "txreview"){ openTxReview(); return; }
  if(page === "tax"){ if(fy) setTaxYearSelected(fy); showPage("tax"); showTaxSubpage(sub || "year", { replace: true }); renderTaxYear(); return; }
  showPage(page);
  if(sub && page === "dashboard"){ showDashboardSubpage(sub); if(sub === "review") renderMonthReview(); window.scrollTo({ top: 0, behavior: "smooth" }); }
  if(sub && page === "accounts"){ showAccountsSubpage(sub); if(sub === "checks") renderHealth(); }
  if(sub && page === "expenses") showExpensesSubpage(sub, { replace: true });
}

export function wireNotifications(){
  // ---------------- Notifications ----------------
  // A bell over locally-computed alerts (overdue/upcoming bills, expenses due for review, stale
  // assets, over-budget-this-month) — see lib/notifications.js for why this only ever refreshes on
  // load/focus/open, same "nudge, not a push" limitation as the Dashboard's stale-assets banner.
  // Two trigger buttons in the DOM (desktop topbar, mobile sidebar row — see index.html) share this
  // one panel/badge-refresh logic; whichever one was clicked decides where the panel anchors.
  notifPanelOpen = false;
  document.querySelectorAll(".notif-bell-btn").forEach(function(btn){
    btn.addEventListener("click", function(e){
      e.stopPropagation();
      if(notifPanelOpen){ closeNotifPanel(); return; }
      openNotifPanel(btn);
    });
  });
  document.addEventListener("click", function(e){
    if(!notifPanelOpen) return;
    if(e.target.closest(".notif-panel") || e.target.closest(".notif-bell-btn")) return;
    closeNotifPanel();
  });
  document.addEventListener("keydown", function(e){
    if(e.key === "Escape") closeNotifPanel();
  });
  window.addEventListener("resize", function(){
    if(notifPanelOpen) positionNotifPanel(document.querySelector('.notif-bell-btn[aria-expanded="true"]'));
  });
  document.getElementById("notifPanelRoot").addEventListener("click", function(e){
    if(e.target.closest("[data-notif-all]")){ panelView = null; renderNotifPanelContent(); return; }
    if(e.target.closest("#notifMarkAllBtn")){
      markAllNotificationsRead(panelView ? viewItems(panelView).todo : getNotifications());
      renderNotifBadge();
      renderNotifPanelContent();
      return;
    }
    var item = e.target.closest("[data-notif-id]");
    if(item){ followNotification(item); return; }
    // An observation's own link (data-adv-go, or data-sv for Spending filtered) is followed by the page's
    // handlers; the panel only gets out of the way.
    if(e.target.closest("[data-adv-go], [data-sv]")) closeNotifPanel();
  });
  // Home's "All N to-dos" (and any other [data-open-bell]) opens the same list.
  document.addEventListener("click", function(e){
    var line = e.target.closest("[data-attn-line]");
    if(!line && !e.target.closest("[data-open-bell]")) return;
    e.stopPropagation();
    var bell = Array.prototype.find.call(document.querySelectorAll(".notif-bell-btn"), function(b){ return b.getClientRects().length > 0; });
    if(bell){ openNotifPanel(bell, line ? currentView() : null); var first = document.querySelector("#notifPanel .notif-item"); if(first) first.focus(); }
  });
  // Cheap enough to run on the same "tab regains focus" signal as the update checker below — local
  // data can change while the tab was backgrounded (e.g. a bill's due date rolling over at midnight)
  // without any edit happening in this tab to trigger a re-render otherwise.
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible") renderNotifBadge();
  });
}
