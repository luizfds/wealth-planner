import { state } from "../state.js";
import { nextDueDate, daysUntil, lastTransactionDateFor, isOverdue, transactionsInMonth, sumField } from "../calc/ledger.js";
import { staleAssets } from "../calc/engine.js";
import { fmtCurrency0, localDateStr } from "./format.js";
import { MARKET_CURRENCY } from "../constants.js";

// ---------------- Notifications: a small, backend-shaped layer over locally-computed alerts ----------------
// This app has no backend (see CLAUDE.md) — every notification here is derived live from
// state you already have, the moment the app is open, the same "nudge, not a push" limitation
// documented on the Dashboard's stale-assets banner. What matters for reuse: getLocalNotifications()
// returns the exact shape a future `GET /api/notifications` endpoint would return — an array of
// {id, type, severity, title, detail, date, page}. If a backend ever gets added, the UI layer
// (app.js) and the read-state store below don't change at all — only getNotifications() gains a
// second source to merge in, exactly like getLocalNotifications() is merged in today. A
// notification's `id` must stay stable for as long as the underlying issue is unresolved (so
// dismissing it sticks) and change once the issue meaningfully changes (a new instance becomes
// due, a new month starts) — see each generator below for its own id scheme.

var READ_KEY = "wealthPlanner.notifications.read";
// How many days out counts as "due soon" — matches the Dashboard's own Upcoming Bills panel
// (renderUpcomingBillsPanel's due-soon threshold in dashboard.js), so a bill doesn't earn a
// different urgency label in two different places.
var DUE_SOON_DAYS = 7;

function todayStr(){ return localDateStr(); }

// ---------------- Read-state store ----------------
// Generic on purpose — keyed only by a notification's id, so it doesn't care whether that
// notification was computed locally or (someday) fetched from a server.
function loadReadIds(){
  try{
    var raw = localStorage.getItem(READ_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){
    return [];
  }
}
function saveReadIds(ids){
  try{ localStorage.setItem(READ_KEY, JSON.stringify(ids)); }catch(e){}
}
export function isNotificationRead(id){
  return loadReadIds().indexOf(id) !== -1;
}
export function markNotificationRead(id){
  var ids = loadReadIds();
  if(ids.indexOf(id) === -1){
    ids.push(id);
    // Unbounded growth isn't a real risk here — ids recycle (a bill's id changes with its due
    // date, a month's budget id rolls over) rather than accumulating forever — but a generous cap
    // keeps a pathological case (years of daily use, never clearing localStorage) from growing
    // this unboundedly.
    if(ids.length > 500) ids = ids.slice(ids.length - 500);
    saveReadIds(ids);
  }
}
export function markAllNotificationsRead(notifications){
  var ids = loadReadIds();
  notifications.forEach(function(n){ if(ids.indexOf(n.id) === -1) ids.push(n.id); });
  saveReadIds(ids);
}

// ---------------- Local notification sources ----------------
// Shared expenses overdue or due within DUE_SOON_DAYS — one notification per (item, projected due
// date) pair, so a bill that rolls to a new due date naturally comes back as unread even if the
// previous occurrence was dismissed.
//
// Skips anything already logged today: nextDueDate() always projects the *next* occurrence after
// the last transaction, and for a Weekly expense that next occurrence lands exactly DUE_SOON_DAYS
// out — so without this check, logging one this morning immediately produces a fresh "Due in 7
// days" notification for the same item, the moment it's paid. Same-day is a deliberately narrow
// guard (not "logged recently enough for its own freq", which is reviewDueNotifications' job) —
// it only silences the instant the log happens, not the genuine next-cycle reminder a few days
// later.
function dueBillNotifications(){
  var today = todayStr();
  return state.shared
    .map(function(item){
      var lastDate = lastTransactionDateFor(state.transactions, item.id);
      if(lastDate === today) return null;
      var due = nextDueDate(lastDate, item.freq);
      return due ? { item: item, due: due, days: daysUntil(due) } : null;
    })
    .filter(function(x){ return x && x.days <= DUE_SOON_DAYS; })
    .map(function(x){
      var overdue = x.days < 0;
      return {
        id: "duebill:" + x.item.id + ":" + x.due,
        type: "duebill",
        severity: overdue ? "bad" : "warn",
        title: x.item.what,
        detail: (overdue ? "Overdue — was due " : "Due ") + x.due + " · " + fmtCurrency0.format(x.item.amount),
        date: x.due,
        page: "expenses"
      };
    });
}
// Shared expenses with no transaction logged recently enough against their own frequency —
// matching expenses.js's own isDueForReview() (duplicated here as a plain predicate rather than
// imported, so this file only depends on the pure calc layer, not a UI component).
//
// Collapsed into a single notification rather than one per item — this is the one source here
// with no natural cap on how many can fire at once (dueBillNotifications is bounded by
// DUE_SOON_DAYS, staleAssetNotifications by "30+ days", budgetNotifications is one per month by
// construction), and every shared expense starts with no transactions logged against it, so a
// brand-new budget (or Sample data, which never seeds transactions) used to mean one "X needs a
// fresh entry" per line — the bell showing "9+" on the very first look at the app, all of it
// saying the same thing. The id is a hash of the current *set* of due items (sorted so member
// order doesn't matter) rather than each item's own id, so "mark read" stays read while that set
// is unchanged and only resurfaces once it actually changes (an item newly falls due, or one
// gets logged and drops out).
function reviewDueNotifications(){
  var due = state.shared.filter(function(item){
    var lastDate = lastTransactionDateFor(state.transactions, item.id);
    return lastDate ? isOverdue(lastDate, item.freq) : true;
  });
  if(!due.length) return [];
  if(due.length === 1){
    return [{
      id: "review:" + due[0].id,
      type: "review",
      severity: "warn",
      title: due[0].what + " needs a fresh entry",
      detail: "No recent transaction logged against this budget line — use Review expenses on the Expenses tab.",
      date: todayStr(),
      page: "expenses"
    }];
  }
  var names = due.slice(0, 3).map(function(item){ return item.what; }).join(", ");
  var extraCount = due.length - 3;
  return [{
    id: "review:" + due.map(function(item){ return item.id; }).sort().join(","),
    type: "review",
    severity: "warn",
    title: due.length + " budget lines need a fresh entry",
    detail: names + (extraCount > 0 ? " and " + extraCount + " more" : "") + " — use Review expenses on the Expenses tab.",
    date: todayStr(),
    page: "expenses"
  }];
}
// Assets not logged in 30+ days — assets have no stable id (see assets.js), so this falls back to
// name-based identity: acceptable here since the cost of a false "unread" after a rename is just
// seeing the reminder once more, not losing anything.
function staleAssetNotifications(){
  return staleAssets().map(function(s){
    return {
      id: "stale:" + s.what,
      type: "stale-asset",
      severity: "info",
      title: s.what + " hasn't been logged recently",
      detail: s.days == null ? "Never logged a value" : ("Last logged " + s.days + " days ago"),
      date: todayStr(),
      page: "assets"
    };
  });
}
// Shares/crypto prices going stale, and (when the portfolio actually holds anything priced in
// USD) the USD → AUD conversion rate going stale or never having been set — both refreshed by
// the same "Paste prices from Google Sheets" action on the Shares tab, so they're folded into one
// notification rather than two competing ones. 7 days matches assets.js's own STALE_PRICE_DAYS
// (the threshold behind each row's stale-price dot), duplicated here as a plain number rather
// than imported for the same reason reviewDueNotifications() duplicates isOverdue() as a plain
// predicate: this file only depends on the pure calc/lib layer, not a UI component.
//
// The id is scoped to today's date rather than to the underlying issue (unlike every other
// source here) — this one's meant to actually come back daily as a nudge to check in, not stay
// dismissed for a week just because you cleared it once while nothing had changed yet.
var STALE_PRICE_DAYS = 7;
function sharePricesNotifications(){
  var shares = state.assets.filter(function(a){ return a.category === "Shares"; });
  if(!shares.length) return [];
  var staleCount = shares.filter(function(a){
    return !a.priceUpdated || daysUntil(a.priceUpdated) <= -STALE_PRICE_DAYS;
  }).length;
  var hasUsd = shares.some(function(a){ return (MARKET_CURRENCY[a.market] || "AUD") !== "AUD"; });
  var fx = state.fx || {};
  var fxStale = hasUsd && (!fx.usdAud || !fx.usdAudUpdated || daysUntil(fx.usdAudUpdated) <= -STALE_PRICE_DAYS);
  if(!staleCount && !fxStale) return [];
  var parts = [];
  if(staleCount) parts.push(staleCount + " price" + (staleCount === 1 ? "" : "s") + " 7+ days old");
  if(fxStale) parts.push(fx.usdAud ? "USD → AUD rate 7+ days old" : "no USD → AUD rate set");
  return [{
    id: "shareprices:" + todayStr(),
    type: "share-prices",
    severity: "info",
    title: "Share prices could use a refresh",
    detail: parts.join(" · ") + " — paste an update from the Shares tab.",
    date: todayStr(),
    page: "assets"
  }];
}
// This month's spend vs. plan, overall — one notification per calendar month (id rolls over at
// the month boundary), so dismissing August's doesn't silently dismiss September's too. Same
// rounded-to-cents math as renderActualVsPlannedPanel() in expenses.js, for the same reason (an
// unrounded delta can sit a hair under the threshold from float error alone).
function budgetNotifications(){
  var month = todayStr().slice(0, 7);
  var monthTxns = transactionsInMonth(state.transactions);
  var plannedTotal = Math.round(sumField(state.shared, "monthly") * 100) / 100;
  var actualTotal = Math.round(monthTxns.reduce(function(s, t){ return s + (Number(t.amount) || 0); }, 0) * 100) / 100;
  var delta = actualTotal - plannedTotal;
  if(delta <= 0.5) return [];
  return [{
    id: "budget:" + month,
    type: "budget",
    severity: "bad",
    title: "Over budget this month",
    detail: fmtCurrency0.format(actualTotal) + " spent against " + fmtCurrency0.format(plannedTotal) + " planned so far",
    date: todayStr(),
    page: "expenses"
  }];
}

// "Have they actually started using the app" — same check app.js's own hasRealUserData() makes
// before warning about an Import overwriting things, duplicated here (rather than imported) for
// the same reason reviewDueNotifications() duplicates isOverdue(): this file only depends on the
// pure calc/lib layer, not app.js. A brand-new install with nothing entered yet has nothing worth
// backing up, so it shouldn't nag about it.
function hasRealUserData(){
  return !!(state.income.length || state.shared.length || state.assets.length ||
    state.properties.length || state.transactions.length || state.debts.length);
}
// This is a browser-only, no-backend app (see CLAUDE.md) — Export/Share (lib/backup.js) are the
// only way this data survives clearing site data or losing the device, and nothing else reminds
// anyone to actually do it. state.lastBackupDate is stamped by doExport()/doShare() specifically,
// not by the per-section CSV/template exports (those are partial, not a real recovery path).
//
// id is the last-backup date itself (or "never") rather than today's date — unlike
// sharePricesNotifications' deliberately-daily id, this one should stay dismissed for the full
// BACKUP_REMINDER_DAYS window once cleared, not resurface every morning; it only comes back once
// the underlying fact (how stale the backup is) has actually changed.
var BACKUP_REMINDER_DAYS = 30;
function backupReminderNotification(){
  if(!hasRealUserData()) return [];
  var last = state.lastBackupDate;
  var daysSince = last ? -daysUntil(last) : null; // daysUntil is negative for a past date
  if(last && daysSince < BACKUP_REMINDER_DAYS) return [];
  return [{
    id: "backup:" + (last || "never"),
    type: "backup",
    severity: "info",
    title: last ? "Time for a fresh backup" : "You haven't backed up yet",
    detail: (last ? "Last backup was " + daysSince + " days ago" : "Everything's stored only in this browser") + " — use Export (top right) to save a copy.",
    date: todayStr(),
    page: "dashboard"
  }];
}

// The one local source today — a future remote source (fetched notifications from a backend)
// would be added here as a sibling function and merged into getNotifications() below, unchanged
// everywhere else.
export function getLocalNotifications(){
  return [].concat(
    dueBillNotifications(),
    reviewDueNotifications(),
    staleAssetNotifications(),
    sharePricesNotifications(),
    backupReminderNotification(),
    budgetNotifications()
  );
}

// Public entry point the UI calls: every notification, each carrying its own `read` flag, sorted
// unread-first then soonest/most-relevant date first.
export function getNotifications(){
  var readIds = loadReadIds();
  return getLocalNotifications()
    .map(function(n){ return Object.assign({}, n, { read: readIds.indexOf(n.id) !== -1 }); })
    .sort(function(a, b){
      if(a.read !== b.read) return a.read ? 1 : -1;
      return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0);
    });
}
export function unreadNotificationCount(){
  return getNotifications().filter(function(n){ return !n.read; }).length;
}
