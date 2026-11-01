// ---------------- The bell (v3.206.1, item 237) ----------------
//
// The notifications panel and its badge, moved out of app.js as they were; app.js calls wireNotifications()
// where its listeners used to be added.
import { escapeAttr } from "../lib/html.js";
import { getNotifications, unreadNotificationCount, markNotificationRead, markAllNotificationsRead } from "../lib/notifications.js";
import { renderHealth } from "./health.js";
import { renderMonthReview } from "./monthreview.js";
import { showPage, showDashboardSubpage, showExpensesSubpage, showAccountsSubpage } from "./nav.js";

var notifPanelOpen;

export function renderNotifBadge(){
  var count = unreadNotificationCount();
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
function notifItemHtml(n){
  return '<button type="button" class="notif-item' + (n.read ? "" : " is-unread") + '" data-notif-id="' + escapeAttr(n.id) + '" data-notif-page="' + escapeAttr(n.page) + '"' + (n.sub ? ' data-notif-sub="' + escapeAttr(n.sub) + '"' : '') + '>' +
    '<span class="notif-dot ' + escapeAttr(n.severity) + '" aria-hidden="true"></span>' +
    '<span class="notif-item-body"><span class="notif-item-title">' + escapeAttr(n.title) + '</span><span class="notif-item-detail">' + escapeAttr(n.detail) + '</span></span>' +
  '</button>';
}
function renderNotifPanelContent(){
  var root = document.getElementById("notifPanelRoot");
  if(!root) return;
  var notifications = getNotifications();
  var hasUnread = notifications.some(function(n){ return !n.read; });
  var list = notifications.length
    ? '<div class="notif-list">' + notifications.map(notifItemHtml).join("") + '</div>'
    : '<p class="notif-empty">Nothing to flag right now — bills, review reminders, and budget alerts will show up here.</p>';
  root.innerHTML = '<div class="notif-panel" id="notifPanel" role="dialog" aria-label="Notifications">' +
    '<div class="notif-panel-head"><h4>Notifications</h4><button type="button" class="notif-mark-all-btn" id="notifMarkAllBtn"' + (hasUnread ? "" : " disabled") + '>Mark all read</button></div>' +
    list +
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
function openNotifPanel(triggerBtn){
  notifPanelOpen = true;
  renderNotifPanelContent();
  positionNotifPanel(triggerBtn);
  document.querySelectorAll(".notif-bell-btn").forEach(function(btn){ btn.setAttribute("aria-expanded", String(btn === triggerBtn)); });
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
    if(e.target.closest("#notifMarkAllBtn")){
      markAllNotificationsRead(getNotifications());
      renderNotifBadge();
      renderNotifPanelContent();
      return;
    }
    var item = e.target.closest("[data-notif-id]");
    if(item){
      markNotificationRead(item.getAttribute("data-notif-id"));
      renderNotifBadge();
      closeNotifPanel();
      showPage(item.getAttribute("data-notif-page"));
      var notifSub = item.getAttribute("data-notif-sub");
      if(notifSub && item.getAttribute("data-notif-page") === "dashboard"){ showDashboardSubpage(notifSub); if(notifSub === "review") renderMonthReview(); }
      if(notifSub && item.getAttribute("data-notif-page") === "accounts"){ showAccountsSubpage(notifSub); if(notifSub === "checks") renderHealth(); }
      if(notifSub && item.getAttribute("data-notif-page") === "expenses") showExpensesSubpage(notifSub, { replace: true });
    }
  });
  // Cheap enough to run on the same "tab regains focus" signal as the update checker below — local
  // data can change while the tab was backgrounded (e.g. a bill's due date rolling over at midnight)
  // without any edit happening in this tab to trigger a re-render otherwise.
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible") renderNotifBadge();
  });
}
