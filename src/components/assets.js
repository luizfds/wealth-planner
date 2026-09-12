import { state, persist } from "../state.js";
import { ASSET_CATEGORIES, LIQUID_CATEGORIES, SHARE_MARKETS, MARKET_CURRENCY } from "../constants.js";
import { propertiesOffsetTotal, propertiesIlliquidEquityToday, recalcPurchase } from "../calc/property.js";
import { totalAssetsValue, totalNetWorthValue, totalDebtsValue, liquidAssetsValue, toAudAmount } from "../calc/engine.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1, fmtCurrency0For, fmtCurrency2For, localDateStr, fmtQtyDisplay } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { optionsHtml, historyTrendHtml } from "../lib/ledger-table.js";
import { renderLineChart, renderStackedAreaChart, sparklineHtml, sparklinePlaceholderHtml } from "../lib/charts.js";
import { showToast } from "../lib/toast.js";
import { appendHistorySnapshot, daysUntil, householdYearWindow, householdYearBasis } from "../calc/ledger.js";
import { TIME_RANGES, rangeLabel, rangeByKey, rangeStartDate, bestFitRange, timeRangeControlHtml } from "../lib/timerange.js";
import { observationDates, categorySeries, trimUntracked, allocationSeries, valueOn } from "../calc/history.js";
import { holdingDividend, saleCapitalGain } from "../calc/tax.js";
import { renderProjectionOutputs } from "./projections.js";
import { renderDashboardStats } from "./dashboard.js";
import { parseCsv } from "../lib/backup.js";

// Every other figure in this app is implicitly AUD; a Shares holding's price/value is only
// sometimes that (ASX), and otherwise USD (US, Crypto) — see MARKET_CURRENCY. Used to pick the
// right Intl-formatted currency symbol ("US$..." vs a bare "$...") for that holding's own
// figures, rather than silently formatting a USD number as if it were AUD.
function holdingCurrency(item){
  return MARKET_CURRENCY[item.market] || "AUD";
}
// "Gain/Loss" ($) and "Change" (%) are the same underlying comparison — this holding's price now
// vs. its price at the start of the selected Change window (sharesChangeWindow, defined below) —
// so both are computed together here instead of duplicating the window/history lookup. Used by
// gainLossHtml()/priceChangeHtml() (display), the winners/losers filter, and the gain-based sort
// further down. Previously Gain/Loss compared against Avg cost (a fixed since-purchase basis,
// independent of the window picker) — changed to match Change's own window so picking "1W" moves
// every gain/loss figure on the page together, not just the % badge. null (not a $0 struct)
// specifically means "no price logged from at least that far back", so a filter or sort can tell
// that apart from a holding that's genuinely flat.
function holdingWindowChange(item){
  var win = SHARES_CHANGE_WINDOWS.find(function(w){ return w.key === sharesChangeWindow; });
  var price = Number(item.price) || 0;
  var qty = Number(item.quantity) || 0;
  if(!win || !price || !Array.isArray(item.history) || !item.history.length) return null;
  var priced = item.history.filter(function(h){ return h.price != null; });
  if(!priced.length) return null;
  // history is kept date-sorted by appendHistorySnapshot, and filter() preserves that order.
  var from = null;
  if(win.all){
    // A single priced entry is necessarily today's own price — comparing it to itself would
    // read as a flat "0%"/$0 that looks like real data instead of "nothing to compare against yet".
    if(priced.length >= 2) from = priced[0];
  } else {
    var targetStr;
    if(win.ytd){
      // The day *before* the year opened: the loop below takes the last priced entry on or before
      // the target, and a price logged exactly on 1 July is this year's opening price, not the
      // baseline the year's gain should be measured from.
      var yearStart = new Date(householdYearWindow().start + "T00:00:00");
      yearStart.setDate(yearStart.getDate() - 1);
      targetStr = localDateStr(yearStart);
    } else {
      var target = new Date();
      target.setDate(target.getDate() - win.days);
      targetStr = localDateStr(target);
    }
    // the last priced entry on or before the target date is the closest known price at (or just
    // before) that point in time.
    for(var i = 0; i < priced.length; i++){
      if(priced[i].date <= targetStr) from = priced[i]; else break;
    }
  }
  if(!from || !from.price) return null;
  return { fromDate: from.date, pct: (price - from.price) / from.price, gainDollar: (price - from.price) * qty };
}
function windowFallbackHtml(){
  var win = SHARES_CHANGE_WINDOWS.find(function(w){ return w.key === sharesChangeWindow; });
  var label = win ? sharesWindowLabel(win) : "";
  return '<span class="calc-note" title="No price logged from at least ' + escapeAttr(label) + ' ago — paste updated prices or use Log to start tracking this.">— ' + escapeAttr(label) + '</span>';
}
function gainLossHtml(item){
  var g = holdingWindowChange(item);
  if(!g) return windowFallbackHtml();
  var cls = g.gainDollar > 0 ? "up" : (g.gainDollar < 0 ? "down" : "");
  var arrow = g.gainDollar > 0 ? "▲" : (g.gainDollar < 0 ? "▼" : "–");
  return '<span class="asset-trend gain-cell ' + cls + '">' + arrow + ' ' + fmtCurrency0For(holdingCurrency(item)).format(Math.abs(g.gainDollar)) +
    ' (' + fmtPercent1.format(Math.abs(g.pct)) + ')</span>';
}

// Sales already recorded against this holding. Each states whether the discount applied and how
// long it was held, because that's the one thing about a CGT event people misjudge — and once it's
// recorded it's too late to act on, so the number has to be visible rather than inferred.
function salesListHtml(item, idx){
  var sales = Array.isArray(item.sales) ? item.sales : [];
  if(!sales.length) return "";
  return '<div class="sale-list">' + sales.map(function(sale, si){
    var g = saleCapitalGain(sale);
    var cls = g.isLoss ? "down" : "up";
    return '<div class="sale-row">' +
      '<span class="sale-date">' + escapeAttr(sale.date) + '</span>' +
      '<span class="sale-detail">' + fmtQtyDisplay.format(Number(sale.units) || 0) + ' units · ' +
        fmtCurrency0.format(Number(sale.proceeds) || 0) + ' less ' + fmtCurrency0.format(Number(sale.costBase) || 0) + ' cost base</span>' +
      '<span class="asset-trend ' + cls + '">' + (g.isLoss ? "" : "+") + fmtCurrency0.format(g.raw) + '</span>' +
      '<span class="sale-discount' + (g.discountApplied ? " on" : "") + '" title="' +
        escapeAttr(g.heldDays + " days held. The 50% discount needs more than 12 months (366 days).") + '">' +
        (g.isLoss ? "loss" : (g.discountApplied ? "−50% discount → " + fmtCurrency0.format(g.assessable) : "no discount")) + '</span>' +
      '<button type="button" class="icon-btn" data-asset-sale-del="' + idx + ':' + si + '" aria-label="Delete this sale">✕</button>' +
    '</div>';
  }).join("") + '</div>';
}

// The franking credit and grossed-up figure for one holding, shown under the Franked % field —
// because "$700 cash" and "$1,000 of taxable income with a $300 credit" are very different
// statements and only the second one is what goes on a return.
// Records a sale against a holding and reduces the units held — a sale that didn't change the
// holding would leave the portfolio claiming units that are gone, which is worse than not
// recording it at all.
//
// The cost base defaults to avgCost x units when left blank, which is right for the common case
// and wrong for anyone who tracks parcels separately — hence a field rather than only the derived
// figure.
export function recordAssetSale(idx, input){
  var item = state.assets[idx];
  if(!item) return null;
  var units = Math.max(0, Number(input.units) || 0);
  var proceeds = Math.max(0, Number(input.proceeds) || 0);
  if(!units || !proceeds) return { error: "Enter both the units sold and what you sold them for." };
  var held = Math.max(0, Number(item.quantity) || 0);
  if(units > held) return { error: "You only hold " + fmtQtyDisplay.format(held) + " units." };
  var costBase = input.costBase !== "" && input.costBase != null
    ? Math.max(0, Number(input.costBase) || 0)
    : Math.round((item.avgCost != null ? item.avgCost : 0) * units * 100) / 100;
  if(!Array.isArray(item.sales)) item.sales = [];
  item.sales.push({
    date: input.date || localDateStr(),
    acquired: input.acquired || "",
    units: units,
    proceeds: proceeds,
    costBase: costBase
  });
  item.sales.sort(function(a, b){ return (b.date || "").localeCompare(a.date || ""); });
  item.quantity = Math.round((held - units) * 1e8) / 1e8;
  item.amount = Math.round(item.quantity * (Number(item.price) || 0) * 100) / 100;
  return { sale: item.sales[0], item: item };
}
export function deleteAssetSale(idx, saleIdx){
  var item = state.assets[idx];
  if(!item || !Array.isArray(item.sales)) return null;
  var removed = item.sales.splice(saleIdx, 1)[0];
  if(!removed) return null;
  // Put the units back: deleting a sale has to undo what recording it did, or a mistyped sale
  // permanently loses units from the portfolio.
  item.quantity = Math.round(((Number(item.quantity) || 0) + (Number(removed.units) || 0)) * 1e8) / 1e8;
  item.amount = Math.round(item.quantity * (Number(item.price) || 0) * 100) / 100;
  return removed;
}

export function dividendNoteText(item){
  var d = holdingDividend(item);
  if(!d.cash) return "";
  return fmtCurrency0.format(d.cash) + "/yr cash" +
    (d.credit ? " + " + fmtCurrency0.format(d.credit) + " franking credit = " + fmtCurrency0.format(d.grossedUp) + " declared" : " (unfranked)");
}

// "as of 2026-08-31 · USD" (or just "USD" with no date yet) — always shown, not only once a
// price has been pasted/logged, so the currency is visible from the moment a holding is added.
function priceNoteText(item){
  var currency = holdingCurrency(item);
  return item.priceUpdated ? ("as of " + item.priceUpdated + " · " + currency) : currency;
}

// A week is generous for a share/crypto price (these move daily) but short enough that it only
// flags a holding genuinely left untouched, not one from yesterday. priceUpdated is set by
// editing the Price field or by the Paste-prices feature — never by Log, which snapshots a
// point-in-time *value* into history, a different concern from "is the live price current".
// Empty priceUpdated (a holding whose price has never been edited/pasted since it was added, mock
// data included) counts as stale too, same as priceNoteText()'s own "no date yet" fallback above.
var STALE_PRICE_DAYS = 7;
function isPriceStale(item){
  return !item.priceUpdated || daysUntil(item.priceUpdated) <= -STALE_PRICE_DAYS;
}
// Small dot + tooltip, not a text badge — the collapsed row has no room to spare (see the
// max-width comment on .m-row-share-value in assets.css) for a second warning label competing
// with the name, price, and gain/loss already fighting for space there.
function stalePriceDotHtml(item){
  if(!isPriceStale(item)) return "";
  var days = item.priceUpdated ? daysUntil(item.priceUpdated) * -1 : null;
  var title = days == null ? "Price never updated — paste or edit it to refresh" : "Price last updated " + days + " day" + (days === 1 ? "" : "s") + " ago";
  return '<span class="h-stale-dot" title="' + escapeAttr(title) + '" aria-label="' + escapeAttr(title) + '"></span>';
}

// Session-only (not persisted, mirrors sharesGainFilter's own convention) — which lookback
// window the "change" badge on every holding uses. Only Log and the price-paste feature ever
// write a .price onto a history entry (see logAssetSnapshot/applySharesPaste), so a holding with
// no price history at all — or none old enough to reach the selected window — simply has
// nothing to show; there's no synthetic/interpolated fallback here, unlike valueAtDate's
// portfolio-chart use of history, since a made-up price would be actively misleading.
export var sharesChangeWindow = "1d";
export function setSharesChangeWindow(value){
  sharesChangeWindow = value;
  renderSharesSubpage();
}
// The eight windows now live in lib/timerange.js: a transaction list needs exactly the same set,
// and two copies is how "6M" ends up quietly meaning two different things in one app.
var SHARES_CHANGE_WINDOWS = TIME_RANGES;
function priceChangeHtml(item){
  var c = holdingWindowChange(item);
  var win = SHARES_CHANGE_WINDOWS.find(function(w){ return w.key === sharesChangeWindow; });
  var label = win ? sharesWindowLabel(win) : "";
  if(!c) return windowFallbackHtml();
  var cls = c.pct > 0 ? "up" : (c.pct < 0 ? "down" : "");
  var arrow = c.pct > 0 ? "▲" : (c.pct < 0 ? "▼" : "–");
  return '<span class="asset-trend ' + cls + '" title="Since ' + escapeAttr(c.fromDate) + '">' + arrow + ' ' + fmtPercent1.format(Math.abs(c.pct)) + ' ' + escapeAttr(label) + '</span>';
}
// "YTD" on the calendar basis, "FYTD" on the financial one — see SHARES_CHANGE_WINDOWS.
function sharesWindowLabel(w){
  return rangeLabel(w, householdYearBasis());
}
function sharesChangeWindowHtml(){
  return timeRangeControlHtml(sharesChangeWindow, "shares-change-window", {
    id: "sharesChangeWindow", ariaLabel: "Price change window",
    yearBasis: householdYearBasis(), titlePrefix: "Price change over the last"
  });
}
export function patchHoldingRow(tr, item){
  var qty = Number(item.quantity) || 0;
  var price = Number(item.price) || 0;
  var currency = holdingCurrency(item);
  var valueCell = tr.querySelector(".h-value-cell");
  if(valueCell) valueCell.textContent = fmtCurrency0For(currency).format(qty * price);
  var gainCell = tr.querySelector(".h-gain-cell");
  if(gainCell) gainCell.innerHTML = gainLossHtml(item);
  var changeCell = tr.querySelector(".h-change-cell");
  if(changeCell) changeCell.innerHTML = priceChangeHtml(item);
  var priceNote = tr.querySelector(".h-price-note");
  if(priceNote) priceNote.textContent = priceNoteText(item);
  var staleCell = tr.querySelector(".h-stale-cell");
  if(staleCell) staleCell.innerHTML = stalePriceDotHtml(item);
  var subCell = tr.querySelector(".h-sub-cell");
  if(subCell) subCell.textContent = fmtQtyDisplay.format(qty) + " · " + fmtCurrency2For(currency).format(price);
}

// Keeps the Shares page's aggregate gain/loss figure in step with a live qty/avg-cost/price
// edit — patchHoldingRow() above only touches that one row's own gain/loss, not the portfolio
// total, so without this the header figure would go stale until the next full re-render.
export function patchSharesGlance(){
  var el = document.getElementById("sharesGlance");
  if(!el) return;
  el.innerHTML = sharesGainLossGlanceHtml(assetCategoryItems("Shares").items);
}

// Session-only (not persisted) — which person's assets every category subpage is filtered to.
// "" = everyone (no filter), "__household" = only items with no person set. Deliberately only
// filters each category's own list/total, not the Summary subpage's headline stats (total net
// worth, liquid/illiquid) or engine.js's totals — those are whole-household figures regardless
// of who's asking to see just their own slice, and property equity/debts have no person field
// to split by anyway.
export var assetPersonFilter = "";
export function setAssetPersonFilter(value){
  assetPersonFilter = value;
  renderAssets();
}
function distinctAssetPersons(){
  var names = {};
  state.assets.forEach(function(a){ if(a.person) names[a.person] = true; });
  return Object.keys(names).sort();
}
function assetPersonMatches(item){
  if(!assetPersonFilter) return true;
  if(assetPersonFilter === "__household") return !item.person;
  return item.person === assetPersonFilter;
}
// Everyone / Household / each tagged person, in the order the sheet lists them.
function assetPersonOptions(){
  return [{ key: "", label: "Everyone" }, { key: "__household", label: "Household" }]
    .concat(distinctAssetPersons().map(function(p){ return { key: p, label: p }; }));
}
function assetPersonLabel(){
  var match = assetPersonOptions().find(function(o){ return o.key === assetPersonFilter; });
  return match ? match.label : "Everyone";
}
// One chip, not a rail. This used to be a second row of .subnav pills sitting directly under the
// real subnav, distinguishable from it only by a border — so the page had two strips competing to
// be "the tabs". Phrased as a sentence ("Showing Everyone") so it reads as state rather than
// navigation, and the options live in a sheet, which is where a control you change occasionally
// belongs.
export function renderAssetPersonFilter(){
  var el = document.getElementById("assetsPersonFilter");
  if(!el) return;
  // Nobody's tagged a person yet — nothing to filter by, so stay out of the way entirely rather
  // than offering a chip whose sheet has only "Everyone" and "Household" in it.
  if(!distinctAssetPersons().length){ el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML = '<button type="button" class="filter-chip" data-asset-person-open ' +
      'aria-haspopup="dialog" title="Choose whose assets to show">Showing <b>' + escapeAttr(assetPersonLabel()) + '</b>' +
      '<span class="filter-chip-caret" aria-hidden="true">▾</span></button>';
}
// Session-only, like every other overlay's state here: null when the sheet is closed.
export var assetPersonSheetOpen = false;
export function setAssetPersonSheetOpen(open){ assetPersonSheetOpen = open; }
// Reuses the .review-backdrop/.review-panel shell every other sheet in this app uses, so it
// inherits the bottom-anchored-on-mobile treatment and the shared backdrop behaviour for free.
export function renderAssetPersonSheet(){
  var root = document.getElementById("assetPersonSheetRoot");
  if(!root) return;
  if(!assetPersonSheetOpen){ root.innerHTML = ""; return; }
  var rows = assetPersonOptions().map(function(o){
    var selected = assetPersonFilter === o.key;
    return '<button type="button" class="qfab-action' + (selected ? " is-selected" : "") + '" data-asset-person-filter="' + escapeAttr(o.key) + '"' +
      ' aria-pressed="' + (selected ? "true" : "false") + '">' +
      '<span class="qfab-action-label">' + escapeAttr(o.label) + '</span>' +
      '<span class="qfab-action-hint">' + escapeAttr(assetPersonHint(o.key)) + '</span>' +
    '</button>';
  }).join("");
  root.innerHTML = '<div class="review-backdrop" data-asset-person-backdrop>' +
    '<div class="review-panel qfab-panel" role="dialog" aria-label="Show assets for">' +
      '<div class="review-head"><h4>Show assets for</h4><button type="button" class="icon-btn" data-asset-person-close aria-label="Close">✕</button></div>' +
      '<div class="qfab-actions">' + rows + '</div>' +
    '</div></div>';
}
function assetPersonHint(key){
  if(key === "") return "Every asset, however it's tagged";
  if(key === "__household") return "Only assets with no person on them";
  return "Only assets tagged " + key;
}

function assetCategoryItems(cat){
  var items = [], indices = [];
  state.assets.forEach(function(a, idx){ if((a.category || "Other") === cat && assetPersonMatches(a)){ items.push(a); indices.push(idx); } });
  return { items: items, indices: indices };
}

// Session-only (not persisted) — shared across every asset subpage (Cash/Shares/Super/Vehicle/
// Other) and both row types below. Keyed by the row's index into the flat state.assets array,
// which (unlike Properties' several separately-indexed arrays) is already globally unique
// regardless of category, so no section prefix is needed to avoid collisions.
export var modernAssetRowOpen = {};

// Every item in a category gets a color, cycling the same 8-color series used everywhere else —
// shared by each row's identity dot and the category's composition bar so the two stay in sync.
function assetRowMeta(data){
  return data.items.map(function(item, i){ return { item: item, idx: data.indices[i], colorIdx: i % 8 }; });
}
function modernAssetCompBarHtml(rowMeta){
  var segs = rowMeta.map(function(m){ return { item: m.item, colorIdx: m.colorIdx, amount: Math.max(0, Number(m.item.amount) || 0) }; })
    .filter(function(x){ return x.amount > 0.5; });
  if(segs.length < 2) return "";
  var total = segs.reduce(function(s, x){ return s + x.amount; }, 0);
  return '<div class="m-comp-bar" data-comp-bar>' + segs.map(function(x){
    var pct = total > 0 ? x.amount / total : 0;
    return '<div class="m-comp-seg series-color-' + x.colorIdx + '" style="flex:' + x.amount + ' 1 0%" title="' + escapeAttr(x.item.what) + ': ' + fmtCurrency0.format(x.amount) + ' (' + fmtPercent1.format(pct) + ')"></div>';
  }).join("") + '</div>';
}
function modernAssetRowHtml(item, idx, colorIdx){
  var isOpen = !!modernAssetRowOpen[idx];
  var dot = colorIdx != null ? '<span class="m-row-dot series-color-' + colorIdx + '" aria-hidden="true"></span>' : "";
  var summary = '<div class="m-row-summary" role="button" tabindex="0" data-row-toggle>' +
    dot +
    '<div style="flex:1 1 auto; min-width:0"><div class="m-row-name">' + escapeAttr(item.what) + '</div></div>' +
    '<span class="m-row-amt" data-computed="amt">' + fmtCurrency0.format(Number(item.amount) || 0) + '</span>' +
    '<span class="m-row-chev" aria-hidden="true">✕</span>' +
  '</div>';
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="a-what" value="' + escapeAttr(item.what) + '" aria-label="Asset name"></div>' +
      '<div class="m-edit-field"><label>Category</label><select class="a-category" title="Move to a different category" aria-label="Category">' + optionsHtml(ASSET_CATEGORIES, item.category) + '</select></div>' +
      '<div class="m-edit-field span2"><label>Value</label><input type="number" step="100" min="0" class="a-amount" value="' + item.amount + '" aria-label="Asset value"></div>' +
      '<div class="m-edit-field"><label>Person</label><input type="text" class="a-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></div>' +
    '</div>' +
    // Sales live behind a disclosure: most holdings have none, and a CGT form permanently open on
    // every row would bury the fields people actually use daily.
    '<div class="m-edit-actions"><button type="button" class="btn btn-ghost btn-sm asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete asset">Delete</button></div>' +
  '</div></div></div>';
  return '<div class="m-row' + (isOpen ? " open" : "") + '" data-section="assets" data-index="' + idx + '">' + summary + edit + '</div>';
}

export function renderAssetCategoryPage(cat){
  var container = document.getElementById("assetsSub-" + cat);
  if(!container) return;
  var data = assetCategoryItems(cat);
  var total = data.items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
  var footerBtn = '<button type="button" class="btn btn-sm' + (data.items.length ? " btn-ghost" : "") + '" data-add="assets:' + escapeAttr(cat) + '">+ Add ' + escapeAttr(cat) + '</button>';
  var body;
  if(!data.items.length){
    body = '<p class="ledger-note" style="margin:0 0 12px">No ' + escapeAttr(cat) + ' tracked yet.</p>' + footerBtn;
  } else {
    var rowMeta = assetRowMeta(data);
    body = '<div class="m-card" id="assetsComp-' + cat + '">' + modernAssetCompBarHtml(rowMeta) + '<div class="m-rows m-asset-rows">' + rowMeta.map(function(m){ return modernAssetRowHtml(m.item, m.idx, m.colorIdx); }).join("") + '</div></div><div class="ledger-footer">' + footerBtn + '</div>';
  }
  // Every category gets the value-over-time chart Shares has had to itself. The reference data
  // makes the case: super carried 13 months of logged history and showed it as a 56px sparkline,
  // while Shares — nine days of history — had a full chart.
  var historyCard = data.items.length
    ? '<details class="ledger" open><summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>' +
        '<h2 class="section-title">' + escapeAttr(cat) + ' over time</h2></div></summary>' +
        '<div class="ledger-body"><div id="assetHistoryPanel-' + escapeAttr(cat) + '"></div></div></details>'
    : "";
  container.innerHTML = '<div class="ledgers"><details class="ledger" open>' +
    '<summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">' + escapeAttr(cat) + '</h2></div>' +
    '<div class="ledger-total">Total <b>' + fmtCurrency0.format(total) + '</b></div></summary>' +
    '<div class="ledger-body">' + body + '</div></details>' + historyCard + '</div>';
  if(data.items.length) renderAssetCategoryHistoryChart(cat);
}

// One category's logged value over time. Shares keeps its own chart (it also plots per-holding
// prices); this is the same question for every other category, which until now had no answer
// beyond a row sparkline.
export function renderAssetCategoryHistoryChart(cat){
  var container = document.getElementById("assetHistoryPanel-" + cat);
  if(!container) return;
  var data = assetCategoryItems(cat);
  var today = localDateStr();
  var records = data.items.map(function(a){ return { history: a.history, current: a.amount }; });
  var dates = observationDates(records.map(function(r){ return r.history; }), [today]);
  // Two real observations, not two dates: appending today always gives at least one, so counting
  // dates alone would draw a "trend" through a single logged point and a value typed in a box.
  var logged = observationDates(records.map(function(r){ return r.history; }), []);
  if(logged.length < 2){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">Press <b>Log</b> on a ' +
      escapeAttr(cat) + ' row at least twice — a month apart, say — and its value over time appears here. ' +
      (logged.length === 1 ? "One snapshot so far." : "None logged yet.") + '</p>';
    return;
  }
  var points = trimUntracked(categorySeries(records, dates, { today: today }));
  container.innerHTML = "";
  var chartDiv = document.createElement("div");
  container.appendChild(chartDiv);
  renderLineChart(chartDiv, [{ label: cat, colorClass: "series-color-0", points: points }], {
    height: 200,
    yFormat: function(v){ return fmtCurrency0.format(v); },
    xFormat: function(ms){ return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short" }); },
    xTickCount: Math.min(6, Math.max(2, points.length)),
    ariaLabel: cat + " value over time",
    alwaysLegend: false
  });
  var first = points[0], last = points[points.length - 1];
  var delta = last.y - first.y;
  var note = document.createElement("p");
  note.className = "ledger-note";
  note.style.margin = "8px 0 0";
  note.innerHTML = (delta >= 0 ? "Up " : "Down ") + "<b>" + fmtCurrency0.format(Math.abs(delta)) + "</b> since " +
    escapeAttr(first.dateLabel) + " — from your logged snapshots, not a projection.";
  container.appendChild(note);
}

export function patchVehicleRow(tr, item){
  var valueCell = tr.querySelector(".v-value-cell");
  if(valueCell) valueCell.innerHTML = fmtCurrency0.format(Number(item.amount) || 0) + (item.computed ? '<span class="computed-note">auto</span>' : '<span class="computed-note">set price + date to auto-depreciate</span>');
}

function modernVehicleRowHtml(item, idx, colorIdx){
  var isOpen = !!modernAssetRowOpen[idx];
  var dot = colorIdx != null ? '<span class="m-row-dot series-color-' + colorIdx + '" aria-hidden="true"></span>' : "";
  var summary = '<div class="m-row-summary" role="button" tabindex="0" data-row-toggle>' +
    dot +
    '<div style="flex:1 1 auto; min-width:0"><div class="m-row-name">' + escapeAttr(item.what) + '</div></div>' +
    '<span class="m-row-amt" data-computed="amt">' + fmtCurrency0.format(Number(item.amount) || 0) + '</span>' +
    '<span class="m-row-chev" aria-hidden="true">✕</span>' +
  '</div>';
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="v-what" value="' + escapeAttr(item.what) + '" aria-label="Vehicle name"></div>' +
      '<div class="m-edit-field"><label>Purchase price</label><input type="number" step="500" min="0" class="v-purchaseprice" value="' + (Number(item.purchasePrice) || 0) + '" aria-label="Purchase price"></div>' +
      '<div class="m-edit-field"><label>Purchase date</label><input type="date" class="v-purchasedate" value="' + escapeAttr(item.purchaseDate || "") + '" aria-label="Purchase date"></div>' +
      '<div class="m-edit-field"><label>Depreciation %/yr</label><input type="number" step="0.5" min="0" max="100" class="v-deprate" value="' + (item.depreciationRate != null ? item.depreciationRate : 15) + '" aria-label="Depreciation % per year"></div>' +
      '<div class="m-edit-field"><label>Person</label><input type="text" class="v-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></div>' +
    '</div>' +
    '<p class="ledger-note v-value-cell" style="margin:8px 0 0">Current value <b>' + fmtCurrency0.format(Number(item.amount) || 0) + '</b>' + (item.computed ? '<span class="computed-note">auto</span>' : '<span class="computed-note">set price + date to auto-depreciate</span>') + '</p>' +
    '<div class="m-edit-actions"><button type="button" class="btn btn-ghost btn-sm asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete vehicle">Delete</button></div>' +
  '</div></div></div>';
  return '<div class="m-row' + (isOpen ? " open" : "") + '" data-section="assets" data-index="' + idx + '">' + summary + edit + '</div>';
}

export function renderVehiclesSubpage(){
  var container = document.getElementById("assetsSub-Vehicle");
  if(!container) return;
  var data = assetCategoryItems("Vehicle");
  var total = data.items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
  var footerBtn = '<button type="button" class="btn btn-sm' + (data.items.length ? " btn-ghost" : "") + '" data-add="vehicle" title="Track a car or other depreciating vehicle — enter purchase price, date, and an annual depreciation rate and its current value is estimated for you">+ Add vehicle</button>';
  var body;
  if(!data.items.length){
    body = '<p class="ledger-note" style="margin:0 0 12px">No vehicles tracked yet.</p>' + footerBtn;
  } else {
    var rowMeta = assetRowMeta(data);
    body = '<div class="m-card" id="assetsComp-Vehicle">' + modernAssetCompBarHtml(rowMeta) + '<div class="m-rows m-asset-rows">' + rowMeta.map(function(m){ return modernVehicleRowHtml(m.item, m.idx, m.colorIdx); }).join("") + '</div></div><div class="ledger-footer">' + footerBtn + '</div>';
  }
  container.innerHTML = '<div class="ledgers"><details class="ledger" open>' +
    '<summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">Vehicle</h2></div>' +
    '<div class="ledger-total">Total <b>' + fmtCurrency0.format(total) + '</b></div></summary>' +
    '<div class="ledger-body"><p class="ledger-note" style="margin-left:0">Current value is estimated as declining-balance depreciation from your purchase price — a common approximation for cars, not a valuation. Leave depreciation fields blank to enter a value manually instead.</p>' + body + '</div></details>' +
    // Vehicles get the same over-time chart as every other category. Theirs is the one most likely
    // to be empty — a depreciating car is exactly the thing nobody logs — so the panel's job here
    // is mostly to say that out loud rather than to draw anything.
    (data.items.length
      ? '<details class="ledger" open><summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>' +
        '<h2 class="section-title">Vehicle over time</h2></div></summary>' +
        '<div class="ledger-body"><div id="assetHistoryPanel-Vehicle"></div></div></details>'
      : "") +
    '</div>';
  if(data.items.length) renderAssetCategoryHistoryChart("Vehicle");
}

function modernShareRowHtml(item, idx, colorIdx){
  var qty = Number(item.quantity) || 0;
  var price = Number(item.price) || 0;
  var currency = holdingCurrency(item);
  var isOpen = !!modernAssetRowOpen[idx];
  var initials = (item.symbol || item.what || "?").slice(0, 2).toUpperCase();
  var avatar = '<span class="m-avatar' + (colorIdx != null ? " series-color-" + colorIdx : " m-avatar-neutral") + '">' + escapeAttr(initials) + '</span>';
  var spark = sparklineHtml(item.history) || sparklinePlaceholderHtml();
  // Qty · current price, not qty · avg cost — the collapsed row's one line of secondary detail
  // should explain the Value figure shown to its right (qty * price), and price is what's
  // actually live/changing day to day. Avg cost is a cost-basis input you set once and rarely
  // revisit; it's still right there under "More options" (below), just not fighting price for
  // the one line of room here.
  // Symbol leads (bold, never truncates), the full name follows as a secondary, truncatable
  // label — a ticker is short by nature ("BBD" vs. "Banco Bradesco S.A."), so leading with it is
  // what actually leaves enough room for the sparkline to stay visible at every width instead of
  // needing to hide below 640px (the previous fix). Falls back to the name alone, in the primary
  // weight, for a holding with no symbol set.
  var symbolText = (item.symbol || "").trim();
  var titleHtml = symbolText
    ? '<span class="m-row-name">' + escapeAttr(symbolText) + '</span><span class="m-row-name-secondary">' + escapeAttr(item.what) + '</span>'
    : '<span class="m-row-name">' + escapeAttr(item.what) + '</span>';
  var summary = '<div class="m-row-summary" role="button" tabindex="0" data-row-toggle>' +
    avatar +
    '<div class="m-row-share-name">' +
      // A sibling to .m-row-name, not nested inside it — .m-row-name-secondary truncates with an
      // ellipsis when the name is long, and a dot nested inside that same overflow:hidden box
      // would get clipped away right when a long name needs it most. m-row-name-line's own flex
      // row keeps the dot as a flex:none item that always renders at fixed size (see assets.css).
      '<div class="m-row-name-line">' + titleHtml + '<span class="h-stale-cell">' + stalePriceDotHtml(item) + '</span></div>' +
      '<div class="m-row-sub h-sub-cell">' + fmtQtyDisplay.format(qty) + ' · ' + fmtCurrency2For(currency).format(price) + '</div>' +
    '</div>' +
    spark +
    '<div class="m-row-share-value">' +
      '<div class="m-row-amt h-value-cell" data-computed="amt">' + fmtCurrency0For(currency).format(qty * price) + '</div>' +
      '<div class="h-gain-cell">' + gainLossHtml(item) + '</div>' +
      '<div class="h-change-cell">' + priceChangeHtml(item) + '</div>' +
    '</div>' +
    '<span class="m-row-chev" aria-hidden="true">✕</span>' +
  '</div>';
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="h-what" value="' + escapeAttr(item.what) + '" aria-label="Holding name"></div>' +
      '<div class="m-edit-field"><label>Symbol</label><input type="text" class="h-symbol" value="' + escapeAttr(item.symbol || "") + '" placeholder="e.g. CBA" aria-label="Ticker symbol"></div>' +
      '<div class="m-edit-field"><label>Qty</label><input type="number" step="any" min="0" class="h-qty" value="' + qty + '" aria-label="Quantity"></div>' +
      '<div class="m-edit-field"><label>Price</label><input type="number" step="0.01" min="0" class="h-price" value="' + price + '" aria-label="Current price per ' + (item.market === "Crypto" ? "coin" : "share") + ' (' + currency + ')"><span class="computed-note h-price-note">' + priceNoteText(item) + '</span></div>' +
      '<div class="m-edit-field"><label>Market</label><select class="h-market">' + optionsHtml(SHARE_MARKETS, item.market || "ASX") + '</select></div>' +
      '<div class="m-edit-field"><label>Avg cost</label><input type="number" step="0.01" min="0" class="h-avgcost" value="' + (item.avgCost != null ? item.avgCost : "") + '" placeholder="—" aria-label="Average cost per share"></div>' +
      '<div class="m-edit-field"><label>Person</label><input type="text" class="h-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></div>' +
      // Per-unit, not a yearly total: a total would silently become wrong the moment units are
      // bought or sold, which is exactly when nobody thinks to revisit it.
      '<div class="m-edit-field"><label>Dividend / unit /yr</label><input type="number" step="0.01" min="0" class="h-dividend" value="' + (Number(item.dividendPerUnit) || 0) + '" placeholder="0" title="Yearly distribution per share or unit. Multiplied by the quantity above, so it follows the holding if you buy or sell." aria-label="Yearly dividend per unit"></div>' +
      '<div class="m-edit-field"><label>Franked %</label><input type="number" step="5" min="0" max="100" class="h-franked" value="' + (item.frankedPct == null ? 100 : item.frankedPct) + '" title="How much of the dividend carries a franking credit for company tax already paid. Fully franked is 100; LICs, REITs and foreign income are often less." aria-label="Franked percentage"><span class="computed-note h-div-note">' + dividendNoteText(item) + '</span></div>' +
    '</div>' +
    '<details class="row-more-options"><summary>Record a sale (capital gains)</summary><div style="margin-top:8px">' +
      '<div class="m-edit-grid">' +
        '<div class="m-edit-field"><label>Units sold</label><input type="number" step="any" min="0" class="h-sale-units" placeholder="0" aria-label="Units sold"></div>' +
        '<div class="m-edit-field"><label>Sold for (total)</label><input type="number" step="0.01" min="0" class="h-sale-proceeds" placeholder="0" title="Total proceeds, after brokerage" aria-label="Sale proceeds"></div>' +
        '<div class="m-edit-field"><label>Sold on</label><input type="date" class="h-sale-date" value="' + localDateStr() + '" aria-label="Sale date"></div>' +
        '<div class="m-edit-field"><label>Acquired on</label><input type="date" class="h-sale-acquired" title="When you bought these units. Held more than 12 months, an individual\'s gain is halved — and \"more than\" is exact: 12 months to the day does not qualify." aria-label="Acquisition date"></div>' +
        '<div class="m-edit-field span2"><label>Cost base</label><input type="number" step="0.01" min="0" class="h-sale-costbase" placeholder="' + (item.avgCost != null ? "avg cost x units" : "0") + '" title="What the units cost you, including brokerage. Left blank it is worked out from the Avg cost above." aria-label="Cost base"></div>' +
      '</div>' +
      '<div class="m-edit-actions"><button type="button" class="btn btn-sm btn-primary" data-asset-sale="' + idx + '">Record sale</button></div>' +
      salesListHtml(item, idx) +
    '</div></details>' +
    '<div class="m-edit-actions"><button type="button" class="btn btn-ghost btn-sm asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete holding">Delete</button></div>' +
  '</div></div></div>';
  return '<div class="m-row' + (isOpen ? " open" : "") + '" data-section="assets" data-index="' + idx + '">' + summary + edit + '</div>';
}

// Aggregates gain/loss over the selected Change window across a set of holdings (whatever's
// currently visible — already person-filtered by the caller via assetCategoryItems). Only counts
// holdings with price history reaching that far back, same requirement gainLossHtml() uses
// per-row, so a portfolio where nothing's been logged/pasted yet correctly reports "nothing to
// show" rather than a misleading $0. Each holding's own dollar figures get converted to AUD (a
// no-op for anything already AUD) before summing, so a USD holding doesn't get added to an AUD
// one at face value — see toAudAmount() in calc/engine.js.
function sharesGainLossSummary(items){
  var gainDollar = 0, startValue = 0, upCount = 0, downCount = 0, flatCount = 0;
  items.forEach(function(item){
    var g = holdingWindowChange(item);
    if(!g) return;
    var qty = Number(item.quantity) || 0, price = Number(item.price) || 0;
    var gainAud = toAudAmount(item, g.gainDollar);
    gainDollar += gainAud;
    startValue += toAudAmount(item, qty * price) - gainAud;
    if(gainAud > 0.5) upCount++;
    else if(gainAud < -0.5) downCount++;
    else flatCount++;
  });
  var trackedCount = upCount + downCount + flatCount;
  return {
    trackedCount: trackedCount, gainDollar: gainDollar,
    pct: startValue ? gainDollar / startValue : 0,
    upCount: upCount, downCount: downCount, flatCount: flatCount
  };
}
function sharesGlanceBarSegHtml(count, colorStyle, label){
  if(!count) return "";
  return '<div class="tax-waterfall-seg" style="flex:' + count + ' 1 0%;' + colorStyle + '" title="' + count + ' ' + label + '"></div>';
}
function sharesGlanceLegendItemHtml(count, colorStyle, label){
  if(!count) return "";
  return '<div class="tax-waterfall-item"><span class="proj-swatch" style="' + colorStyle + '"></span>' + count + ' ' + label + '</div>';
}
function sharesGainLossGlanceHtml(items){
  var s = sharesGainLossSummary(items);
  if(!s.trackedCount) return "";
  var win = SHARES_CHANGE_WINDOWS.find(function(w){ return w.key === sharesChangeWindow; });
  var label = win ? sharesWindowLabel(win) : "";
  var cls = s.gainDollar > 0.5 ? "up" : (s.gainDollar < -0.5 ? "down" : "");
  var arrow = s.gainDollar > 0.5 ? "▲" : (s.gainDollar < -0.5 ? "▼" : "–");
  return '<div class="shares-glance">' +
    '<div class="shares-glance-figure asset-trend ' + cls + '">' + arrow + ' ' + fmtCurrency0.format(Math.abs(s.gainDollar)) + ' (' + fmtPercent1.format(Math.abs(s.pct)) + ')</div>' +
    '<div class="shares-glance-sub">' + escapeAttr(label) + ' gain/loss, across ' + s.trackedCount + ' holding' + (s.trackedCount === 1 ? "" : "s") + ' with price history</div>' +
    '<div class="tax-waterfall-bar shares-glance-bar">' +
      sharesGlanceBarSegHtml(s.upCount, "background:var(--good)", "up") +
      sharesGlanceBarSegHtml(s.flatCount, "background:var(--ink-soft)", "flat") +
      sharesGlanceBarSegHtml(s.downCount, "background:var(--bad)", "down") +
    '</div>' +
    '<div class="tax-waterfall-legend">' +
      sharesGlanceLegendItemHtml(s.upCount, "background:var(--good)", "up") +
      sharesGlanceLegendItemHtml(s.flatCount, "background:var(--ink-soft)", "flat") +
      sharesGlanceLegendItemHtml(s.downCount, "background:var(--bad)", "down") +
    '</div>' +
  '</div>';
}

// Session-only (not persisted, mirrors assetPersonFilter's own convention) — narrows the row
// list/table to holdings whose unrealized gain is positive/negative/not trackable yet.
// Deliberately does NOT affect sharesGainLossGlanceHtml() above: that panel summarizes the whole
// (person-filtered) portfolio, and narrowing the row list below it shouldn't silently change
// what the summary above it means.
export var sharesGainFilter = "";
export function setSharesGainFilter(value){
  sharesGainFilter = value;
  renderSharesSubpage();
}
function sharesGainMatches(item){
  var g = holdingWindowChange(item);
  if(sharesGainFilter === "winners") return !!g && g.gainDollar > 0;
  if(sharesGainFilter === "losers") return !!g && g.gainDollar < 0;
  if(sharesGainFilter === "unset") return !g;
  return true;
}
var SHARES_GAIN_FILTERS = [
  { key: "", label: "All" },
  { key: "winners", label: "▲ Winners" },
  { key: "losers", label: "▼ Losers" },
  // Was "No cost set" back when gain/loss compared against Avg cost — now it's about price
  // history for the selected window instead (see holdingWindowChange), so a holding lands here
  // whenever there's no price logged from at least that far back, cost basis aside.
  { key: "unset", label: "No history" }
];

// Also session-only. "" (Default) keeps whatever order state.assets itself stores them in — the
// same order every other asset category renders in — rather than silently imposing a sort nobody
// asked for the moment this feature shipped.
export var sharesSortMode = "";
export function setSharesSortMode(value){
  sharesSortMode = value;
  renderSharesSubpage();
}
var SHARES_SORT_OPTIONS = [
  { key: "", label: "Sort: Default" },
  { key: "name", label: "Sort: Name (A–Z)" },
  { key: "value-desc", label: "Sort: Value (high–low)" },
  { key: "value-asc", label: "Sort: Value (low–high)" },
  { key: "gain-desc", label: "Sort: Gain/loss $ (high–low)" },
  { key: "gain-asc", label: "Sort: Gain/loss $ (low–high)" },
  { key: "pct-desc", label: "Sort: Gain/loss % (high–low)" },
  { key: "pct-asc", label: "Sort: Gain/loss % (low–high)" }
];
// Sorts items/indices together (indices have to keep pointing at each item's real position in
// state.assets, same convention as every other filtered-then-rendered list in this app) — a
// holding with no price history for the selected window sorts after any gain/loss-figure sort so
// "can't compare" doesn't read as "compares as zero".
function sortShareData(data){
  if(!sharesSortMode) return data;
  var paired = data.items.map(function(item, i){ return { item: item, idx: data.indices[i] }; });
  function value(item){ return (Number(item.quantity) || 0) * (Number(item.price) || 0); }
  paired.sort(function(a, b){
    var ga = holdingWindowChange(a.item), gb = holdingWindowChange(b.item);
    switch(sharesSortMode){
      case "name": return a.item.what.localeCompare(b.item.what);
      case "value-desc": return value(b.item) - value(a.item);
      case "value-asc": return value(a.item) - value(b.item);
      case "gain-desc": return (gb ? gb.gainDollar : -Infinity) - (ga ? ga.gainDollar : -Infinity);
      case "gain-asc": return (ga ? ga.gainDollar : Infinity) - (gb ? gb.gainDollar : Infinity);
      case "pct-desc": return (gb ? gb.pct : -Infinity) - (ga ? ga.pct : -Infinity);
      case "pct-asc": return (ga ? ga.pct : Infinity) - (gb ? gb.pct : Infinity);
      default: return 0;
    }
  });
  return { items: paired.map(function(p){ return p.item; }), indices: paired.map(function(p){ return p.idx; }) };
}
function sharesFilterSortHtml(){
  var filterHtml = '<div class="chip-row" id="sharesGainFilter" role="group" aria-label="Filter holdings">' + SHARES_GAIN_FILTERS.map(function(o){
    return '<button type="button" class="chip' + (sharesGainFilter === o.key ? " active" : "") + '" aria-pressed="' + (sharesGainFilter === o.key) + '" data-shares-gain-filter="' + escapeAttr(o.key) + '">' + escapeAttr(o.label) + '</button>';
  }).join("") + '</div>';
  var sortHtml = '<select id="sharesSortSelect" aria-label="Sort holdings">' + SHARES_SORT_OPTIONS.map(function(o){
    return '<option value="' + o.key + '"' + (sharesSortMode === o.key ? " selected" : "") + '>' + escapeAttr(o.label) + '</option>';
  }).join("") + '</select>';
  return '<div class="shares-toolbar">' + filterHtml + sortHtml + '</div>' +
    '<div class="shares-toolbar shares-toolbar-start">' +
      '<span class="shares-toolbar-label">Change</span>' + sharesChangeWindowHtml() +
    '</div>';
}

export function renderSharesSubpage(){
  var container = document.getElementById("assetsSub-Shares");
  if(!container) return;
  var allData = assetCategoryItems("Shares");
  var total = allData.items.reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0);
  var filteredPairs = allData.items.map(function(item, i){ return { item: item, idx: allData.indices[i] }; }).filter(function(p){ return sharesGainMatches(p.item); });
  var data = sortShareData({ items: filteredPairs.map(function(p){ return p.item; }), indices: filteredPairs.map(function(p){ return p.idx; }) });
  var footerBtn = '<button type="button" class="btn btn-sm' + (allData.items.length ? " btn-ghost" : "") + '" data-add="holding" title="Track an individual holding — symbol, quantity, cost, and value. Set Market to Crypto to track a coin the same way.">+ Add share holding</button>';
  var toolbar = allData.items.length ? sharesFilterSortHtml() : "";
  var body;
  if(!allData.items.length){
    body = '<p class="ledger-note" style="margin:0 0 12px">No share holdings yet — set Market to "Crypto" on a holding to track a coin the same way (quantity, avg cost, gain/loss, sparkline).</p>' + footerBtn;
  } else if(!data.items.length){
    body = '<p class="ledger-note" style="margin:0 0 12px">No holdings match this filter.</p>';
  } else {
    var rowMeta = assetRowMeta(data);
    body = '<div class="m-card" id="assetsComp-Shares">' + modernAssetCompBarHtml(rowMeta) + '<div class="m-rows m-asset-rows">' + rowMeta.map(function(m){ return modernShareRowHtml(m.item, m.idx, m.colorIdx); }).join("") + '</div></div><div class="ledger-footer">' + footerBtn + '</div>';
  }
  // Only worth mentioning once there's an actual USD-denominated holding for a rate to convert —
  // same gate sharesPriceTemplateTable() (lib/backup.js) uses to decide whether the template
  // even includes the USDAUD row. Two states: a rate is set (show it, and how stale), or one
  // isn't (flag that Net worth/Dashboard/allocation are currently adding USD holdings' raw
  // numbers in as if they were already AUD — see toAudAmount() in calc/engine.js).
  var hasUsdHoldings = allData.items.some(function(a){ return (MARKET_CURRENCY[a.market] || "AUD") !== "AUD"; });
  var fxNote = !hasUsdHoldings ? "" : (state.fx && state.fx.usdAud
    ? '<p class="ledger-note" style="margin:8px 0"><b>USD → AUD:</b> 1 USD = ' + Number(state.fx.usdAud).toFixed(4) + ' AUD (as of ' + escapeAttr(state.fx.usdAudUpdated) + ') — used to convert your USD holdings into Net worth, Dashboard, and allocation totals. Re-paste the template below (it includes a conversion row) any time to refresh it.</p>'
    : '<p class="ledger-note" style="margin:8px 0;color:var(--brass-strong)">You have USD-priced holdings but no USD → AUD rate set yet — Net worth, Dashboard, and allocation totals are currently adding their raw USD numbers in as if they were already AUD. Paste the template below (it now includes a conversion row) to fix this.</p>');
  var pasteTool = allData.items.length
    ? '<details class="tax-advanced" style="margin:0 0 14px"><summary>Paste prices from Google Sheets</summary>' +
        '<p class="ledger-note" style="margin:8px 0">This app never fetches prices itself — nothing is sent anywhere. First time: "Copy to clipboard", then paste straight into an empty cell in a Google Sheet (or "Download" and import the file instead) — either way you get a live-price formula already written for every holding, crypto included, plus a USD → AUD exchange rate row if you hold anything priced in USD. Then copy its Symbol and Price columns and paste the two-column range below; matches your holdings by ticker symbol (case-insensitive), and the exchange rate row updates your USD → AUD conversion. After that, re-paste the same range any time to refresh prices.</p>' +
        fxNote +
        '<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-sm btn-ghost" id="sharesCopyPriceTemplateBtn" title="Copy the same table to your clipboard, ready to paste straight into a Google Sheets cell">⧉ Copy to clipboard</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="sharesExportPriceTemplateBtn" title="A CSV with every holding\'s symbol and a ready-made =GOOGLEFINANCE(...) formula — open it in Google Sheets to get live prices without writing the formulas yourself">⇩ Download price template</button>' +
        '</div>' +
        '<textarea id="sharesPasteArea" rows="4" placeholder="CBA&#9;105.32&#10;BHP&#9;43.10" style="width:100%;box-sizing:border-box;font-family:&quot;IBM Plex Mono&quot;,monospace;font-size:12.5px;padding:8px;background:var(--paper-sunken);border:1px solid var(--border);border-radius:8px;color:var(--ink);resize:vertical"></textarea>' +
        '<div style="margin-top:8px"><button type="button" class="btn btn-sm" id="sharesPasteApply">Update prices</button></div>' +
      '</details>'
    : "";
  var historyPanel = allData.items.length
    ? '<details class="ledger" open><summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">Shares value over time</h2></div></summary>' +
      '<div class="ledger-body"><div id="sharesHistoryPanel"></div></div></details>'
    : "";
  container.innerHTML = '<div class="ledgers"><details class="ledger" open>' +
    '<summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">Shares</h2></div>' +
    '<div class="ledger-total">Total <b>' + fmtCurrency0.format(total) + '</b></div></summary>' +
    '<div class="ledger-body"><div id="sharesGlance">' + sharesGainLossGlanceHtml(allData.items) + '</div>' + pasteTool + toolbar + body + '</div></details>' + historyPanel + '</div>';
  if(allData.items.length) renderSharesHistoryChart();
}

// Scoped to just this (person-filtered) Shares portfolio — deliberately reads allData, not the
// winners/losers-filtered `data` above, since this describes the whole holding set the same way
// the at-a-glance panel and Total do, not whatever the row filter currently narrows the list to.
export function renderSharesHistoryChart(){
  var container = document.getElementById("sharesHistoryPanel");
  if(!container) return;
  var data = assetCategoryItems("Shares");
  var dateSet = {};
  data.items.forEach(function(a){
    (a.history || []).forEach(function(h){ dateSet[h.date] = true; });
  });
  var dates = Object.keys(dateSet).sort();
  var today = localDateStr();
  if(dates.indexOf(today) === -1) dates.push(today);

  if(!data.items.length || dates.length < 2){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">Log a value for at least one holding (or paste updated prices) to start tracking your Shares value over time.</p>';
    return;
  }

  function valueAtDate(history, currentAmount, d){
    if(!history || !history.length) return d === today ? (Number(currentAmount) || 0) : 0;
    var atOrBefore = history.filter(function(h){ return h.date <= d; });
    if(!atOrBefore.length) return 0;
    return atOrBefore[atOrBefore.length - 1].value;
  }
  var points = dates.map(function(d){
    var total = data.items.reduce(function(sum, a){ return sum + toAudAmount(a, valueAtDate(a.history, a.amount, d)); }, 0);
    return { x: new Date(d + "T00:00:00").getTime(), y: total, dateLabel: d };
  });

  container.innerHTML = "";
  var chartDiv = document.createElement("div");
  container.appendChild(chartDiv);

  renderLineChart(chartDiv, [{ label: "Shares value", colorClass: "series-color-2", points: points }], {
    height: 220,
    yFormat: function(v){ return fmtCurrency0.format(v); },
    xFormat: function(ms){ return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short" }); },
    xTickCount: Math.min(7, Math.max(2, dates.length)),
    ariaLabel: "Shares value over time",
    alwaysLegend: false
  });
}

export function parseSharesPasteLine(line){
  var trimmed = line.trim();
  if(!trimmed) return null;
  var parts = trimmed.split(/\t+/);
  if(parts.length < 2) parts = trimmed.split(/,+/);
  if(parts.length < 2) parts = trimmed.split(/\s+/);
  if(parts.length < 2) return null;
  var symbol = parts[0].trim().replace(/^["']|["']$/g, "").replace(/^[A-Za-z]+:/, "").toUpperCase();
  var price = parseFloat(parts[parts.length - 1].replace(/[^0-9.\-]/g, ""));
  if(!symbol || isNaN(price)) return null;
  return { symbol: symbol, price: price };
}

var ASSET_ALLOC_SEGMENTS = [
  { key: "Cash", colorClass: "series-color-0", liquid: true },
  { key: "Shares", colorClass: "series-color-2", liquid: true },
  { key: "Offset", colorClass: "series-color-4", liquid: true },
  { key: "Super", colorClass: "series-color-6", liquid: false },
  { key: "Vehicle", colorClass: "series-color-5", liquid: false },
  { key: "Other", colorClass: "series-color-3", liquid: false },
  { key: "Property", colorClass: "series-color-1", liquid: false }
];
function assetAllocationValues(){
  var values = {};
  ASSET_CATEGORIES.forEach(function(cat){ values[cat] = assetCategoryItems(cat).items.reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0); });
  values.Property = propertiesIlliquidEquityToday();
  values.Offset = propertiesOffsetTotal();
  return values;
}
function allocBarHtml(segments, values){
  var whole = segments.reduce(function(s, seg){ return s + Math.max(0, values[seg.key]); }, 0);
  var visible = segments.filter(function(seg){ return values[seg.key] > 0; });
  if(!visible.length) return '<p class="ledger-note" style="margin:0">Nothing here yet.</p>';
  var bar = visible.map(function(seg){
    return '<div class="tax-waterfall-seg ' + seg.colorClass + '" style="flex:' + values[seg.key] + ' 1 0%" title="' + seg.key + ': ' + fmtCurrency0.format(values[seg.key]) + ' (' + fmtPercent1.format(whole > 0 ? values[seg.key] / whole : 0) + ')"></div>';
  }).join("");
  var legend = visible.map(function(seg){
    return '<div class="tax-waterfall-item"><span class="proj-swatch ' + seg.colorClass + '"></span><div class="tax-waterfall-item-text"><span class="tax-waterfall-item-label">' + seg.key + '</span><span class="tax-waterfall-item-value">' + fmtCurrency0.format(values[seg.key]) + '</span></div></div>';
  }).join("");
  return '<div class="tax-waterfall-bar">' + bar + '</div><div class="tax-waterfall-legend">' + legend + '</div>';
}
function renderAssetAllocationHtml(){
  var values = assetAllocationValues();
  var liquidSegs = ASSET_ALLOC_SEGMENTS.filter(function(seg){ return seg.liquid; });
  var illiquidSegs = ASSET_ALLOC_SEGMENTS.filter(function(seg){ return !seg.liquid; });
  var liquidTotal = liquidSegs.reduce(function(s, seg){ return s + Math.max(0, values[seg.key]); }, 0);
  var illiquidTotal = illiquidSegs.reduce(function(s, seg){ return s + Math.max(0, values[seg.key]); }, 0);
  if(liquidTotal + illiquidTotal <= 0) return '<p class="ledger-note" style="margin:0">Add some assets or properties to see your allocation.</p>';
  return '<div class="tax-inputs-label">Liquid — ' + fmtCurrency0.format(liquidTotal) + '</div>' + allocBarHtml(liquidSegs, values) +
    '<div class="tax-inputs-label" style="margin-top:16px">Illiquid — ' + fmtCurrency0.format(illiquidTotal) + '</div>' + allocBarHtml(illiquidSegs, values);
}

export function renderAssetsSummary(){
  var statsEl = document.getElementById("assetsSummaryStats");
  if(statsEl){
    var liquidAssets = state.assets.filter(function(a){ return LIQUID_CATEGORIES.indexOf(a.category) !== -1; })
      .reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0);
    var offset = propertiesOffsetTotal();
    var liquid = liquidAssets + offset;
    var illiquid = totalAssetsValue() - liquidAssets;
    var propEquity = propertiesIlliquidEquityToday();
    statsEl.innerHTML =
      '<div class="stat-tile"><span>Total net worth</span><b>' + fmtCurrency0.format(totalNetWorthValue()) + '</b><small>assets + property equity</small></div>' +
      '<div class="stat-tile" title="Cash + Shares + any property offset balances — real, spendable cash"><span>Liquid assets</span><b>' + fmtCurrency0.format(liquid) + '</b><small>Cash + Shares + Offset</small></div>' +
      '<div class="stat-tile"><span>Illiquid assets</span><b>' + fmtCurrency0.format(illiquid) + '</b><small>Super + Vehicle + Other</small></div>' +
      '<div class="stat-tile" title="Value minus full loan balance, net of offset — only accessible by selling or refinancing"><span>Property equity</span><b>' + fmtCurrency0.format(propEquity) + '</b><small>across ' + state.properties.length + ' propert' + (state.properties.length === 1 ? "y" : "ies") + ', net of offset</small></div>';
  }
  var allocEl = document.getElementById("assetsAllocation");
  if(allocEl) allocEl.innerHTML = renderAssetAllocationHtml();
}

export function patchAssetCategoryTotals(){
  ASSET_CATEGORIES.forEach(function(cat){
    var data = assetCategoryItems(cat);
    var total = data.items.reduce(function(s, a){ return s + toAudAmount(a, a.amount); }, 0);
    var container = document.getElementById("assetsSub-" + cat);
    var totalEl = container && container.querySelector(".ledger-total b");
    if(totalEl) totalEl.textContent = fmtCurrency0.format(total);
    var barWrap = container && container.querySelector("#assetsComp-" + cat + " [data-comp-bar]");
    if(barWrap) barWrap.outerHTML = modernAssetCompBarHtml(assetRowMeta(data));
  });
  renderAssetsSummary();
}

export function renderNetWorthPanel(){
  var total = totalNetWorthValue();
  var liquid = liquidAssetsValue();
  var purchaseScenarios = state.scenarios.filter(function(s){ return state.purchase[s] && state.purchase[s].enabled; });
  // This table's columns (LVR/stamp duty/LMI/upfront cash) are all purchase-specific and don't
  // apply to a scenario using the invest leg instead — rather than force it into a row shape
  // that doesn't fit, just point at where its own numbers live (Scenarios tab).
  var investScenarios = state.scenarios.filter(function(s){ return state.invest[s] && state.invest[s].enabled; });
  var investNote = investScenarios.length
    ? '<p class="calc-note" style="margin-top:10px">' + (investScenarios.length === 1 ? escapeAttr(investScenarios[0]) + ' is' : investScenarios.map(escapeAttr).join(", ") + ' are') +
      ' using "invest instead of buying" — see the Scenarios tab for that leg\'s own numbers.</p>'
    : '';
  var panel = document.getElementById("netWorthPanel");
  if(!purchaseScenarios.length){
    panel.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin-top:14px">Turn on the purchase calculator for a scenario (under &quot;Your home&quot;) to see how buying would affect your net worth.</p>' + investNote;
    return;
  }
  var rows = purchaseScenarios.map(function(s){
    var out = recalcPurchase(s);
    var costs = out.stampDutyForTotal + out.lmi + out.otherTotal;
    var netAfter = total - costs;
    var shortfall = out.upfrontCash - liquid;
    return '<tr><td>' + escapeAttr(s) + '</td>' +
      '<td class="num">' + fmtCurrency0.format(out.upfrontCash) + '</td>' +
      '<td class="num">' + fmtCurrency0.format(liquid) + '</td>' +
      '<td class="num ' + (shortfall > 0 ? "short" : "ok") + '">' + (shortfall > 0 ? "shortfall " : "surplus ") + fmtCurrency0.format(Math.abs(shortfall)) + '</td>' +
      '<td class="num">' + fmtCurrency0.format(netAfter) + '</td></tr>';
  }).join("");
  panel.innerHTML =
    '<div class="table-scroll"><table class="worth-table">' +
      '<thead><tr><th>Scenario</th>' +
        '<th class="num" title="Deposit + stamp duty + LMI + other acquisition costs for this scenario — the cash you need available on settlement day.">Upfront cash needed</th>' +
        '<th class="num" title="Your Cash + Shares from the assets above, plus any property offset balances (real, spendable cash). Super and property equity can\'t be drawn on for a deposit.">Liquid assets (cash + shares + offset)</th>' +
        '<th class="num" title="Liquid assets minus upfront cash needed. A shortfall means your current liquid savings don\'t cover it — you\'d need to save more first, borrow a larger share (higher LVR, likely with LMI), or choose a cheaper property.">Surplus / shortfall</th>' +
        '<th class="num" title="Current total assets minus stamp duty, LMI and other acquisition costs (see note below).">Net worth after</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table></div>' +
    '<p class="calc-note" style="margin-top:10px">Net worth after purchase = current total assets minus stamp duty, LMI and other acquisition costs. The deposit itself just moves from cash into home equity, so it doesn\'t change net worth on its own.</p>' +
    investNote;
}

// Where the money actually is, over time. A single net-worth line cannot answer "am I getting more
// property-heavy" — the number can double while the mix quietly concentrates into one asset.
//
// Colour is keyed to the bucket, never to its position in the list: a bucket that empties out must
// not hand its colour to the next one along, or the chart repaints itself whenever the data
// changes shape. These four hues were checked as a set with the dataviz validator under --pairs
// all (worst CVD ΔE 9.2 deutan, worst normal-vision ΔE 16.3) before being assigned here.
var ALLOCATION_BUCKETS = [
  { key: "Super", colorClass: "series-color-0" },
  { key: "Shares", colorClass: "series-color-1" },
  { key: "Cash", colorClass: "series-color-2" },
  { key: "Property", colorClass: "series-color-6" },
  { key: "Other", colorClass: "series-color-3" }
];
// Session-only, like every other range control in the app: which window the "how it shifted"
// stack is showing. Not persisted — a filter is about the look you're having now, not a setting.
// null until either the user picks one or the first render works one out from the data — see
// bestFitRange(). Resolving it lazily rather than at load is what lets a chosen range stick: once
// it holds a key, nothing recomputes it.
var allocationRange = null;
export function setAllocationRange(value){
  allocationRange = rangeByKey(value) ? value : "all";
  renderAllocationChart();
}

// The buckets as they stand today, as {key, colorClass, records}. Shared by both halves of the
// panel so the bar and the stack can never disagree about what counts as what.
function allocationBuckets(){
  // Property equity, not property value: the mortgage is not part of what you own, and a chart that
  // counts the whole house makes a heavily-geared portfolio look far more diversified than it is.
  var propertyRecords = state.properties.map(function(p){
    var loanNet = (p.loans || []).reduce(function(sum, l){
      return sum + Math.max(0, (Number(l.balance) || 0) - (Number(l.offsetBalance) || 0));
    }, 0);
    return {
      history: (p.history || []).map(function(h){ return { date: h.date, value: Math.max(0, (Number(h.value) || 0) - loanNet) }; }),
      current: Math.max(0, (Number(p.value) || 0) - loanNet)
    };
  });
  return ALLOCATION_BUCKETS.map(function(b){
    if(b.key === "Property") return Object.assign({}, b, { records: propertyRecords });
    var cats = b.key === "Other" ? ["Vehicle", "Other"] : [b.key];
    return Object.assign({}, b, {
      // Converted to AUD, snapshots included: a US holding logs its value in USD, and a chart that
      // mixes converted current amounts with unconverted history steps on the day the log ends.
      records: state.assets.filter(function(a){ return cats.indexOf(a.category) !== -1; })
        .map(function(a){
          return {
            history: (a.history || []).map(function(h){ return { date: h.date, value: toAudAmount(a, h.value) }; }),
            current: toAudAmount(a, a.amount)
          };
        })
    });
  }).filter(function(b){ return b.records.length; });
}

// Today's mix as a single composition bar. This is the question the section title actually asks,
// and it needs no time axis to answer — which matters, because the stack below it is at the mercy
// of how evenly the user has logged. On the reference data the whole composition exists inside the
// last fortnight of a thirteen-month axis, so the stack was one flat slab and a 20px sliver; this
// bar reads the same at any logging cadence, including none at all.
export function todaysMixHtml(buckets, today){
  var rows = buckets.map(function(b){
    var y = categorySeries(b.records, [today], { today: today })[0].y;
    return { key: b.key, colorClass: b.colorClass, y: Math.max(0, y) };
  }).filter(function(r){ return r.y > 0; });
  var whole = rows.reduce(function(sum, r){ return sum + r.y; }, 0);
  if(whole <= 0 || !rows.length) return "";
  // Largest first: the bar is read left to right, and "what dominates" is the point of it.
  rows.sort(function(a, b){ return b.y - a.y; });
  var segs = rows.map(function(r){
    var share = r.y / whole;
    return '<div class="rule-seg ' + r.colorClass + '" style="width:' + (share * 100) + '%" title="' +
      escapeAttr(r.key) + ' ' + fmtCurrency0.format(r.y) + ' — ' + fmtPercent1.format(share) + ' of what you own">' +
      // Only label a slice wide enough to hold the text; the legend below carries the rest.
      (share >= 0.14 ? fmtPercent1.format(share) : "") + '</div>';
  }).join("");
  var legend = rows.map(function(r){
    return '<div class="rule-legend-item"><span class="rule-swatch ' + r.colorClass + '"></span>' +
      escapeAttr(r.key) + ' <b>' + fmtCurrency0.format(r.y) + '</b></div>';
  }).join("");
  return '<div class="alloc-today">' +
    '<div class="cat-chart-title">What you own today — ' + fmtCurrency0.format(whole) + '</div>' +
    '<div class="rule-bar">' + segs + '</div>' +
    '<div class="rule-legend">' + legend + '</div>' +
  '</div>';
}

export function renderAllocationChart(){
  var container = document.getElementById("allocationHistoryPanel");
  if(!container) return;
  var today = localDateStr();
  var buckets = allocationBuckets();
  container.innerHTML = "";
  if(!buckets.length){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">Add an asset or a property and the shape of your wealth — how much is super, shares, cash or property — appears here.</p>';
    return;
  }

  // Half one: today, always. It does not depend on having logged anything.
  var mix = document.createElement("div");
  mix.innerHTML = todaysMixHtml(buckets, today);
  if(mix.firstChild) container.appendChild(mix.firstChild);

  // Half two: how that mix got here. This one does need history.
  var assetHistories = state.assets.map(function(a){ return a.history; });
  var propHistories = state.properties.map(function(p){ return p.history; });
  var logged = observationDates(assetHistories.concat(propHistories), []);
  if(logged.length < 2){
    var hint = document.createElement("p");
    hint.className = "ledger-note";
    hint.style.margin = "14px 0 0";
    hint.textContent = "Log a value on at least two dates and the mix above gets a history — how it shifted, not just where it landed.";
    container.appendChild(hint);
    return;
  }

  if(allocationRange === null){
    allocationRange = bestFitRange(logged, { today: today, yearStart: householdYearWindow().start });
  }
  var shift = document.createElement("div");
  shift.className = "alloc-shift";
  shift.innerHTML = '<div class="alloc-shift-head">' +
    '<div class="cat-chart-title" style="margin:0">How the mix has shifted</div>' +
    timeRangeControlHtml(allocationRange, "allocation-range", {
      yearBasis: householdYearBasis(), ariaLabel: "Time range for the allocation history",
      titlePrefix: "Show the last"
    }) + '</div>';
  container.appendChild(shift);

  // Filter the observation dates to the chosen window rather than the records: valueOn() still
  // reads the full history, so the first point in a short window carries forward what was true
  // before it instead of starting the chart at zero.
  var range = rangeByKey(allocationRange) || rangeByKey("all");
  var from = rangeStartDate(range, { today: today, yearStart: householdYearWindow().start });
  var dates = observationDates(assetHistories.concat(propHistories), [today])
    .filter(function(d){ return from === null || d >= from || d === today; });
  if(dates.length < 2){
    var tooShort = document.createElement("p");
    tooShort.className = "ledger-note";
    tooShort.style.margin = "10px 0 0";
    tooShort.textContent = "Nothing was logged in this window — only " + rangeLabel(range, householdYearBasis()) +
      " of it, and one point is not a shift. Try a longer range.";
    shift.appendChild(tooShort);
    return;
  }

  var series = allocationSeries(buckets, dates, { today: today });
  var chartDiv = document.createElement("div");
  shift.appendChild(chartDiv);
  // "Aug 2026 / Sep 2026" says almost nothing across a four-week window — inside a quarter the
  // useful unit is the day, and across years it is the month. The axis follows the window it is
  // actually drawing rather than one fixed format for all eight of them.
  var spanDays = (new Date(dates[dates.length - 1] + "T00:00:00") - new Date(dates[0] + "T00:00:00")) / 86400000;
  var xFormat = spanDays <= 100
    ? function(ms){ return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
    : function(ms){ return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short" }); };
  renderStackedAreaChart(chartDiv, series, {
    height: 200,
    yFormat: function(v){ return fmtCurrency0.format(v); },
    xFormat: xFormat,
    xTickCount: 4,
    // No legend on the stack: the composition bar directly above it is keyed by the same colours
    // for the same buckets, so a second legend is the same key printed twice.
    legend: false,
    ariaLabel: "How your mix of assets has shifted over time"
  });
  var note = document.createElement("p");
  note.className = "ledger-note";
  note.style.margin = "8px 0 0";
  note.innerHTML = "Property counts as equity — value minus what's still owed — not the whole house. " +
    "Debts you owe elsewhere aren't in this chart: it's what you own, not your net worth.";
  shift.appendChild(note);
}

export function renderPortfolioHistoryChart(){
  var container = document.getElementById("portfolioHistoryPanel");
  if(!container) return;
  var dateSet = {};
  state.assets.forEach(function(a){
    (a.history || []).forEach(function(h){ dateSet[h.date] = true; });
  });
  state.properties.forEach(function(p){
    (p.history || []).forEach(function(h){ dateSet[h.date] = true; });
  });
  (state.debts || []).forEach(function(d){
    (d.history || []).forEach(function(h){ dateSet[h.date] = true; });
  });
  var dates = Object.keys(dateSet).sort();
  var today = localDateStr();
  if(dates.indexOf(today) === -1) dates.push(today);

  if(dates.length < 2){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">Log a value for at least one asset (click "Log" in the table above) to start tracking your net worth over time.</p>';
    return;
  }

  function valueAtDate(history, currentAmount, d){
    if(!history || !history.length) return d === today ? (Number(currentAmount) || 0) : 0;
    var atOrBefore = history.filter(function(h){ return h.date <= d; });
    if(!atOrBefore.length) return 0;
    return atOrBefore[atOrBefore.length - 1].value;
  }
  function hasValueAtDate(history, d){
    if(!history || !history.length) return d === today;
    return history.some(function(h){ return h.date <= d; });
  }
  // Net out each property's loans (at today's balance/offset — we don't log loan balance
  // history) against its historical valuation, so this tracks net worth like every other
  // total in the app, not gross asset value inflated by debt that's never subtracted. Only
  // applied on dates where we actually have a logged valuation for that property, so a
  // property with just one recent snapshot doesn't drag earlier points deep into negative
  // territory for a loan it didn't have tracked at that point.
  var points = dates.map(function(d){
    var total = state.assets.reduce(function(sum, a){ return sum + toAudAmount(a, valueAtDate(a.history, a.amount, d)); }, 0);
    total += state.properties.reduce(function(sum, p){
      if(!hasValueAtDate(p.history, d)) return sum;
      var loanNet = (p.loans || []).reduce(function(s, l){
        return s + Math.max(0, (Number(l.balance) || 0) - (Number(l.offsetBalance) || 0));
      }, 0);
      return sum + valueAtDate(p.history, p.value, d) - loanNet;
    }, 0);
    // Debts too, or this chart is not net worth. It was $17,000 above the net-worth figure in the
    // page header on the reference data — a credit-card limit the app knows about, tracks in
    // totalNetWorthValue(), and this chart quietly left out while labelling itself "Net worth".
    // Same rule as the properties above: only subtracted on dates the debt was actually tracked,
    // so a debt logged once recently doesn't retroactively push a year of history downward.
    total -= (state.debts || []).reduce(function(sum, dbt){
      if(!hasValueAtDate(dbt.history, d)) return sum;
      return sum + valueAtDate(dbt.history, dbt.balance, d);
    }, 0);
    return { x: new Date(d + "T00:00:00").getTime(), y: total, dateLabel: d };
  });

  container.innerHTML = "";
  var chartDiv = document.createElement("div");
  container.appendChild(chartDiv);

  renderLineChart(chartDiv, [{ label: "Net worth", colorClass: "series-color-0", points: points }], {
    height: 220,
    yFormat: function(v){ return fmtCurrency0.format(v); },
    xFormat: function(ms){ return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short" }); },
    xTickCount: Math.min(7, Math.max(2, dates.length)),
    ariaLabel: "Net worth over time",
    alwaysLegend: false
  });
}

// ---------------- Import assets from a spreadsheet ----------------
// Same shape as expenses.js/income.js's CSV import — mirrors exportAssetsCsv()'s own headers. The
// meaningful fields differ by Category though (a Cash row only needs Amount; a Shares row needs
// Symbol/Market/Quantity/Price; a Vehicle row needs Purchase price/date/Depreciation) — so unlike
// Expenses/Income, an unrecognized Category is a hard error per row rather than defaulted, since
// silently treating a Shares row as Cash would just drop its symbol/quantity/price on the floor.
var ASSETS_IMPORT_HEADERS = ["what", "category", "amount", "symbol", "market", "quantity", "avg cost", "price", "person", "purchase price", "purchase date", "depreciation %/yr"];
function matchAssetsImportHeader(headerRow){
  var colOf = {};
  headerRow.forEach(function(h, i){
    var key = (h || "").trim().toLowerCase();
    if(ASSETS_IMPORT_HEADERS.indexOf(key) !== -1 && colOf[key] === undefined) colOf[key] = i;
  });
  return colOf;
}
function assetsImportCell(cells, colOf, key){
  return colOf[key] !== undefined ? (cells[colOf[key]] || "").trim() : "";
}
export function parseAssetsImportCsv(text){
  var rows = parseCsv(text);
  if(!rows.length) return { valid: [], errors: [], headerOk: false };
  var colOf = matchAssetsImportHeader(rows[0]);
  if(colOf.what === undefined || colOf.category === undefined) return { valid: [], errors: [], headerOk: false };
  var valid = [], errors = [];
  rows.slice(1).forEach(function(cells, i){
    var rowNum = i + 2;
    var what = assetsImportCell(cells, colOf, "what");
    var categoryRaw = assetsImportCell(cells, colOf, "category");
    if(!what && cells.every(function(c){ return !c || !c.trim(); })) return; // fully blank row
    if(!what){ errors.push({ row: rowNum, reason: 'Missing "What"' }); return; }
    var category = ASSET_CATEGORIES.find(function(c){ return c.toLowerCase() === categoryRaw.toLowerCase(); });
    if(!category){ errors.push({ row: rowNum, reason: 'Category "' + categoryRaw + '" isn\'t one of ' + ASSET_CATEGORIES.join("/") }); return; }
    var item = { what: what, category: category, person: assetsImportCell(cells, colOf, "person") };
    if(category === "Shares"){
      var symbol = assetsImportCell(cells, colOf, "symbol");
      if(!symbol){ errors.push({ row: rowNum, reason: "Shares row needs a Symbol" }); return; }
      var quantityRaw = assetsImportCell(cells, colOf, "quantity");
      var quantity = parseFloat(quantityRaw.replace(/[^0-9.\-]/g, ""));
      if(!quantityRaw || isNaN(quantity)){ errors.push({ row: rowNum, reason: 'Quantity "' + quantityRaw + '" isn\'t a number' }); return; }
      var marketRaw = assetsImportCell(cells, colOf, "market");
      var marketMatch = SHARE_MARKETS.find(function(m){ return m.toLowerCase() === marketRaw.toLowerCase(); });
      var avgCostRaw = assetsImportCell(cells, colOf, "avg cost");
      var avgCostNum = avgCostRaw === "" ? NaN : parseFloat(avgCostRaw.replace(/[^0-9.\-]/g, ""));
      var priceRaw = assetsImportCell(cells, colOf, "price");
      var price = priceRaw === "" ? 0 : (parseFloat(priceRaw.replace(/[^0-9.\-]/g, "")) || 0);
      item.symbol = symbol.toUpperCase();
      item.market = marketMatch || "ASX";
      item.quantity = quantity;
      item.avgCost = isNaN(avgCostNum) ? null : avgCostNum;
      item.price = price;
      item.amount = Math.round(quantity * price * 100) / 100;
    } else if(category === "Vehicle"){
      var purchasePriceRaw = assetsImportCell(cells, colOf, "purchase price");
      var depRaw = assetsImportCell(cells, colOf, "depreciation %/yr");
      item.purchasePrice = purchasePriceRaw === "" ? 0 : (parseFloat(purchasePriceRaw.replace(/[^0-9.\-]/g, "")) || 0);
      item.purchaseDate = assetsImportCell(cells, colOf, "purchase date");
      item.depreciationRate = depRaw === "" ? 15 : (parseFloat(depRaw.replace(/[^0-9.\-]/g, "")) || 0);
      item.amount = 0; // auto-recalculated once purchasePrice+purchaseDate land in state — see recalcComputedItems()
    } else {
      var amountRaw = assetsImportCell(cells, colOf, "amount");
      var amount = parseFloat(amountRaw.replace(/[^0-9.\-]/g, ""));
      if(!amountRaw || isNaN(amount)){ errors.push({ row: rowNum, reason: 'Amount "' + amountRaw + '" isn\'t a number' }); return; }
      item.amount = amount;
    }
    valid.push(item);
  });
  return { valid: valid, errors: errors, headerOk: true };
}
function assetsImportRowDetail(item){
  if(item.category === "Shares") return item.quantity + " @ " + fmtCurrency2.format(item.price) + (item.market ? " (" + item.market + ")" : "");
  if(item.category === "Vehicle") return fmtCurrency0.format(item.purchasePrice) + " purchase price, " + item.depreciationRate + "%/yr" + (item.purchaseDate ? " from " + item.purchaseDate : "");
  return fmtCurrency2.format(item.amount);
}
export function renderAssetsImportPreview(parsed){
  var container = document.getElementById("assetsImportPreview");
  if(!container) return parsed.valid;
  container.hidden = false;
  if(!parsed.headerOk){
    container.innerHTML = '<p class="ledger-note" style="margin:0;color:var(--brass-strong)">Couldn\'t find "What" and "Category" columns in that file — download the import template below, or check your header row matches it.</p>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-ghost" id="assetsImportCancelBtn">Dismiss</button></div>';
    return parsed.valid;
  }
  if(!parsed.valid.length && !parsed.errors.length){
    container.innerHTML = '<p class="ledger-note" style="margin:0">No rows found in that file.</p>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-sm btn-ghost" id="assetsImportCancelBtn">Dismiss</button></div>';
    return parsed.valid;
  }
  var summary = parsed.valid.length + " row" + (parsed.valid.length === 1 ? "" : "s") + " ready to import" +
    (parsed.errors.length ? ", " + parsed.errors.length + " skipped" : "");
  var errorsHtml = parsed.errors.length
    ? '<ul style="margin:6px 0 0;padding-left:18px;font-size:12px;color:var(--ink-soft)">' +
        parsed.errors.slice(0, 10).map(function(e){ return "<li>Row " + e.row + ": " + escapeAttr(e.reason) + "</li>"; }).join("") +
        (parsed.errors.length > 10 ? "<li>and " + (parsed.errors.length - 10) + " more</li>" : "") +
      "</ul>"
    : "";
  var previewRows = parsed.valid.slice(0, 8).map(function(item){
    return "<tr><td>" + escapeAttr(item.what) + "</td><td>" + escapeAttr(item.category) + "</td><td>" + escapeAttr(assetsImportRowDetail(item)) + "</td></tr>";
  }).join("");
  var moreNote = parsed.valid.length > 8 ? '<p class="ledger-note" style="margin:6px 0 0">and ' + (parsed.valid.length - 8) + " more…</p>" : "";
  container.innerHTML =
    '<p class="ledger-note" style="margin:0"><b>' + summary + "</b></p>" +
    errorsHtml +
    (parsed.valid.length ? '<div class="table-scroll" style="margin-top:8px"><table class="import-preview-table"><thead><tr><th>What</th><th>Category</th><th>Detail</th></tr></thead><tbody>' + previewRows + "</tbody></table></div>" + moreNote : "") +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      (parsed.valid.length ? '<button type="button" class="btn btn-sm" id="assetsImportConfirmBtn">Import ' + parsed.valid.length + " asset" + (parsed.valid.length === 1 ? "" : "s") + "</button>" : "") +
      '<button type="button" class="btn btn-sm btn-ghost" id="assetsImportCancelBtn">Cancel</button>' +
    "</div>";
  return parsed.valid;
}
export function clearAssetsImportPreview(){
  var container = document.getElementById("assetsImportPreview");
  if(container){ container.hidden = true; container.innerHTML = ""; }
}
// Same minimal per-category shapes "+Add asset"/"+Add holding"/"+Add vehicle" push today. A
// Shares row with a real price also gets priceUpdated + a history snapshot stamped — same as a
// paste-prices import (applySharesPaste) — so it doesn't immediately show as "stale"/"never
// updated" the moment it lands, and so it already has a first point for its sparkline.
export function commitAssetsImport(items){
  var today = localDateStr();
  items.forEach(function(item){
    if(item.category === "Shares"){
      var holding = {
        what: item.what, category: "Shares", symbol: item.symbol, market: item.market,
        quantity: item.quantity, avgCost: item.avgCost, price: item.price,
        priceUpdated: item.price > 0 ? today : "", person: item.person, amount: item.amount, history: []
      };
      if(item.price > 0){
        var entryDate = appendHistorySnapshot(holding.history, holding.amount, today);
        var entry = holding.history.find(function(h){ return h.date === entryDate; });
        if(entry) entry.price = item.price;
      }
      state.assets.push(holding);
    } else if(item.category === "Vehicle"){
      state.assets.push({ what: item.what, category: "Vehicle", purchasePrice: item.purchasePrice, purchaseDate: item.purchaseDate, depreciationRate: item.depreciationRate, amount: item.amount, person: item.person });
    } else {
      state.assets.push({ what: item.what, category: item.category, amount: item.amount, person: item.person });
    }
  });
}

export function renderAssets(){
  renderAssetPersonFilter();
  renderAssetCategoryPage("Cash");
  renderSharesSubpage();
  renderAssetCategoryPage("Super");
  renderVehiclesSubpage();
  renderAssetCategoryPage("Other");
  renderAssetsSummary();
  renderDebts();
  renderNetWorthPanel();
  renderPortfolioHistoryChart();
  renderAllocationChart();
  renderProjectionOutputs();
}

// Deliberately not built on the generic ledger-table.js machinery — debts have a different
// shape (just what/balance, no freq/period math) and reusing rowHtml()/modernPlainRowHtml()
// would mean fighting their amount+frequency assumptions rather than a small bespoke renderer.
export function renderDebts(){
  var container = document.getElementById("debtsTable");
  var totalEl = document.getElementById("totalDebtsAmount");
  if(!container) return;
  var total = totalDebtsValue();
  if(totalEl) totalEl.textContent = fmtCurrency0.format(total);
  if(!state.debts.length){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">No debts tracked — add anything you owe outside a property loan (credit cards, personal loans, BNPL).</p>';
    return;
  }
  container.innerHTML = '<div class="m-rows">' + state.debts.map(function(d, idx){
    return '<div class="m-row computed" data-debt-index="' + idx + '"><div class="m-row-summary" style="cursor:default">' +
      '<div style="flex:1 1 auto;min-width:0"><input type="text" class="debt-what" data-debt-index="' + idx + '" value="' + escapeAttr(d.what) + '" aria-label="Debt name" style="all:unset;width:100%;font:inherit;color:inherit">' + historyTrendHtml(d) + '</div>' +
      '<input type="number" step="100" min="0" class="debt-balance" data-debt-index="' + idx + '" value="' + d.balance + '" aria-label="Balance" style="width:110px;text-align:right;font-family:\'IBM Plex Mono\',monospace;border:1px solid transparent;background:transparent;color:inherit;padding:5px 6px;border-radius:6px">' +
      '<button type="button" class="asset-log-btn" data-debt-log="' + idx + '" title="Snapshot the balance above with today\'s date">Log</button>' +
      '<button type="button" class="btn btn-ghost btn-sm row-del" data-debt-del="' + idx + '" aria-label="Delete debt">✕</button>' +
    '</div></div>';
  }).join("") + '</div>';
}

export function logAssetSnapshot(idx){
  var asset = state.assets[idx];
  if(!asset) return;
  var num = Number(asset.amount) || 0;
  if(!Array.isArray(asset.history)) asset.history = [];
  var dateStr = appendHistorySnapshot(asset.history, num);
  // A Shares holding's history entry also gets tagged with the per-share price at that moment
  // (not just the total value above), so a later "change over the last day/week/month" figure
  // can compare price to price — not total value, which would also move with quantity if shares
  // were bought or sold in between. Every other asset category's history stays value-only.
  if(asset.category === "Shares"){
    var entry = asset.history.find(function(h){ return h.date === dateStr; });
    if(entry) entry.price = Number(asset.price) || 0;
  }
  renderAssets();
  renderProjectionOutputs();
  persist();
  showToast("Logged " + fmtCurrency0.format(num) + " for " + asset.what + " (" + dateStr + ")");
}

export function logDebtSnapshot(idx){
  var debt = state.debts[idx];
  if(!debt) return;
  var num = Number(debt.balance) || 0;
  if(!Array.isArray(debt.history)) debt.history = [];
  var dateStr = appendHistorySnapshot(debt.history, num);
  renderDebts();
  renderDashboardStats();
  persist();
  showToast("Logged " + fmtCurrency0.format(num) + " for " + debt.what + " (" + dateStr + ")");
}

export function applySharesPaste(){
  var area = document.getElementById("sharesPasteArea");
  if(!area) return;
  var lines = area.value.split(/\r?\n/);
  var updatedCount = 0, notFound = [], unparseable = [];
  var fxUpdated = false;
  var todayStr = localDateStr();
  lines.forEach(function(line){
    var trimmed = line.trim();
    if(!trimmed) return;
    var parsed = parseSharesPasteLine(line);
    if(!parsed){
      // A non-blank line that failed to parse — most commonly a #N/A/#ERROR!/blank price cell
      // (a GOOGLEFINANCE formula that briefly failed to resolve that ticker), which used to be
      // dropped with zero feedback: the row's price silently never updated (and so neither did
      // its sparkline/trend, which only move when history actually gets a new, different value)
      // with nothing on screen explaining why. Best-effort the first token so the toast can name
      // it, rather than leaving "why didn't GPRO update" a mystery.
      var firstToken = trimmed.split(/\t+|,+|\s+/)[0];
      if(firstToken) unparseable.push(firstToken.toUpperCase());
      return;
    }
    // Not a holding at all — the exchange rate row the price template adds whenever there's a
    // USD-denominated holding to convert (see sharesPriceTemplateTable() in lib/backup.js).
    // Routes straight to state.fx instead of the symbol-match below, same paste box, same
    // GOOGLEFINANCE-formula-in/plain-number-out round trip as every share price on this page.
    if(parsed.symbol === "USDAUD"){
      state.fx.usdAud = parsed.price;
      state.fx.usdAudUpdated = todayStr;
      fxUpdated = true;
      return;
    }
    var matches = state.assets.filter(function(a){ return a.category === "Shares" && (a.symbol || "").toUpperCase() === parsed.symbol; });
    if(!matches.length){ notFound.push(parsed.symbol); return; }
    matches.forEach(function(item){
      item.price = parsed.price;
      item.priceUpdated = todayStr;
      item.amount = Math.round((Number(item.quantity) || 0) * parsed.price * 100) / 100;
      // Same history snapshot the manual "Log" button records — without this, a pasted price
      // update the value but the sparkline/trend note (both driven by item.history) stayed
      // frozen until someone clicked Log on every row by hand.
      if(!Array.isArray(item.history)) item.history = [];
      var entryDate = appendHistorySnapshot(item.history, item.amount, todayStr);
      var entry = item.history.find(function(h){ return h.date === entryDate; });
      if(entry) entry.price = parsed.price;
    });
    updatedCount += matches.length;
  });
  renderAssets();
  renderNetWorthPanel();
  persist();
  var msg = updatedCount + " price" + (updatedCount === 1 ? "" : "s") + " updated" +
    (fxUpdated ? " — USD/AUD rate refreshed" : "") +
    (notFound.length ? " — no holding found for " + notFound.join(", ") : "") +
    (unparseable.length ? " — couldn't read a price for " + unparseable.join(", ") + " (check for #N/A or a blank cell in your sheet)" : "");
  showToast(msg);
}
