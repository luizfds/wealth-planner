import { hiddenPartsLineHtml } from "./parts.js";
import { state } from "../state.js";
import { netWorthList } from "../calc/networthlist.js";
import { toAudAmount, totalNetWorthValue } from "../calc/engine.js";
import { loggedSinceRecorded } from "../calc/accounts.js";
import { estimatesUplift } from "../calc/estimates.js";
import { localDateStr, fmtDate } from "../lib/format.js";
import { detailLinkHtml } from "./detail.js";
import { fmtCurrency0 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { emptyStateHtml } from "../lib/empty.js";

// ---------------- Net worth (v3.129.0) ----------------
// The overview the rail above Accounts, Investments and Property opens on: everything owned and
// owed in one list, each row to its own page.
function money(v){ return (v < 0 ? "−" : "") + fmtCurrency0.format(Math.abs(v)); }
// Where each kind is managed: its page behind the list (#428), opened by the group's heading — Shares with its winners
// and losers, Super, Bank accounts, Property. The chips above are the one switcher: the page behind has none, and is
// titled with the group's name (ASSET_PAGE_TITLES; "Other things" is Vehicle and Other together).
var MANAGE = { cash: "accounts", invest: "assets/Shares", super: "assets/Super", property: "properties", other: "assets/Other", debts: "accounts" };
// What each card ends with: a row in the link colour naming what its page holds, so the way there reads as one — the
// heading's › alone didn't (the owner, after #438). A row with `when` shows only where the group has such rows: Cash's
// offsets and its cash held outside a bank account (on Investments' Offsets and Cash, with no other way in from here),
// Debts' property loans.
var FOOT = {
  cash: [{ go: "accounts", label: "All accounts and cards" },
    { go: "assets/Offsets", label: "Offsets", when: function(r){ return r.kind === "loan"; } },
    { go: "assets/Cash", label: "Cash not in an account", when: function(r){ return r.kind === "asset" && !(state.accounts || []).some(function(a){ return a && a.link === "asset:" + r.id; }); } }],
  invest: [{ go: "assets/Shares", label: "Performance, winners and losers" }],
  super: [{ go: "assets/Super", label: "Contributions and super over time" }],
  property: [{ go: "properties", label: "Loans, income and costs" }],
  other: [{ go: "assets/Other", label: "Each item's value over time" }],
  debts: [{ go: "accounts", label: "All accounts and cards" }, { go: "properties", label: "Property loans", when: function(r){ return r.kind === "loan"; } }]
};
function footHtml(g){
  var rows = (FOOT[g.key] || []).filter(function(f){ return !f.when || g.rows.some(f.when); });
  if(!rows.length) return "";
  // The accessible name starts with what it says (WCAG 2.5.3), then which card: Cash and Debts both have "All accounts".
  return '<div class="nw-foot">' + rows.map(function(f){
    return '<button type="button" class="nw-foot-link" data-go="' + f.go + '">' + escapeAttr(f.label) + '<span class="visually-hidden"> (' + escapeAttr(g.label) + ')</span><span aria-hidden="true">›</span></button>';
  }).join("") + '</div>';
}
export function netWorthPageHtml(){
  var today = localDateStr();
  var l = netWorthList(state, toAudAmount, loggedSinceRecorded(today).byRecord);
  var est = estimatesUplift(state, today);
  if(!l.groups.length) return emptyStateHtml("Nothing here yet. Add an account, a holding or a property and it appears in this list.", { go: "accounts", label: "Go to Accounts →" }) + hiddenPartsLineHtml();
  var owned = l.groups.filter(function(g){ return g.key !== "debts"; }).reduce(function(s, g){ return s + g.total; }, 0);
  var owed = l.groups.filter(function(g){ return g.key === "debts"; }).reduce(function(s, g){ return s - g.total; }, 0);
  var nw = totalNetWorthValue();
  var head = '<div class="nw-head"><div><span>Net worth</span><b>' + money(nw) + '</b>' +
      (est.items.length && Math.abs(est.total) >= 1 ? '<small class="nw-est" title="' + escapeAttr(est.items.map(function(i){ return i.name + ": " + money(i.recorded) + " on record (" + i.from + "), about " + money(i.estimate) + " now"; }).join("\n")) + '">about ' + money(nw + est.total) + ' with estimates for ' + escapeAttr(est.items.map(function(i){ return i.name; }).join(", ")) + '</small>' : '') + '</div>' +
    '<div><span>Owned</span><b>' + money(owned) + '</b></div><div><span>Owed</span><b>' + money(owed) + '</b></div></div>';
  var parts = l.groups.filter(function(g){ return g.key !== "debts" && g.total > 0; });
  var pct = function(g){ var p = g.total / owned * 100; return p >= 1 ? Math.round(p) + "%" : "<1%"; };
  // v3.138.0: the bar says what its colours are, under it — not only in each group's dot further down.
  var bar = owned > 0 ? '<div class="nw-bar" role="img" aria-label="' + escapeAttr("What you own: " + parts.map(function(g){ return g.label + " " + pct(g); }).join(", ")) + '">' + parts.map(function(g, i){
    return '<span class="series-color-' + i + '" style="width:' + (g.total / owned * 100).toFixed(2) + '%" title="' + escapeAttr(g.label + " " + money(g.total)) + '"></span>'; }).join("") + '</div>' +
    '<ul class="nw-legend" aria-hidden="true">' + parts.map(function(g, i){ return '<li><i class="nw-dot series-color-' + i + '"></i>' + escapeAttr(g.label) + ' <b>' + pct(g) + '</b></li>'; }).join("") + '</ul>' : '';
  // Each group's dot is its colour in the bar above.
  var shown = l.groups.filter(function(g){ return g.key !== "debts" && g.total > 0; }).map(function(g){ return g.key; });
  // #413: one list, filtered by kind — All, then each group there is. The figures above stay the whole picture.
  if(nwFilter !== "all" && !l.groups.some(function(g){ return g.key === nwFilter; })) nwFilter = "all";
  var chips = l.groups.length > 1 ? '<div class="nw-chips" role="group" aria-label="Show">' + [{ key: "all", label: "All" }].concat(l.groups).map(function(g){
    var on = nwFilter === g.key;
    return '<button type="button" class="nw-chip' + (on ? ' is-on' : '') + '" data-nw-filter="' + escapeAttr(g.key) + '" aria-pressed="' + on + '">' + escapeAttr(g.label) + '</button>';
  }).join("") + '</div>' : '';
  var groups = nwFilter === "all" ? l.groups : l.groups.filter(function(g){ return g.key === nwFilter; });
  return head + bar + chips + groups.map(function(g){
    var ci = shown.indexOf(g.key);
    var manage = MANAGE[g.key];
    var title = '<span>' + (ci !== -1 ? '<i class="nw-dot series-color-' + ci + '" aria-hidden="true"></i>' : '') + escapeAttr(g.label) + '</span><b>' + money(g.total) + '</b>';
    // The accessible name is what shows (WCAG 2.5.3), then where it goes.
    return '<section class="nw-group"><h2>' + (manage ? '<button type="button" class="nw-go" data-go="' + manage + '">' + title +
        '<span class="visually-hidden">, open</span><span class="nw-go-arrow" aria-hidden="true">›</span></button>' : title) + '</h2>' +
      '<ul>' + g.rows.map(function(r){
      // A home being bought: a way to its Buying card, and a word that it's in progress.
      if(r.buying) return '<li class="nw-buying"><span class="nw-name"><button type="button" class="nw-buy-link" data-go="properties">' + escapeAttr(r.name) + '</button>' +
        '<small><span class="nw-wip">Buying</span> ' + escapeAttr(r.sub + (r.settles ? " · settles " + fmtDate(r.settles, { year: r.settles.slice(0, 4) !== today.slice(0, 4) }) : "")) + '</small></span>' +
        '<b>' + money(r.value) + '</b></li>';
      return '<li><span class="nw-name">' + (r.id ? detailLinkHtml(r.kind, r.id, r.name) : escapeAttr(r.name)) + (r.sub ? '<small>' + escapeAttr(r.sub) + '</small>' : '') + '</span><b class="' + (r.value < 0 ? "neg" : "") + '">' + money(r.value) + '</b></li>';
    }).join("") + '</ul>' + footHtml(g) + '</section>';
  }).join("") + hiddenPartsLineHtml();
}
// The kind the list shows, for this visit (not saved): "all" or a group's key.
var nwFilter = "all";
export function setNetWorthFilter(key){ nwFilter = key || "all"; renderNetWorthPage(); }
export function renderNetWorthPage(){
  var el = typeof document !== "undefined" && document.getElementById("netWorthBody");
  if(el) el.innerHTML = netWorthPageHtml();
}
