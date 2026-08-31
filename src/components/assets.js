import { state, persist } from "../state.js";
import { ASSET_CATEGORIES, LIQUID_CATEGORIES, SHARE_MARKETS } from "../constants.js";
import { propertiesOffsetTotal, propertiesIlliquidEquityToday, recalcPurchase } from "../calc/property.js";
import { totalAssetsValue, totalNetWorthValue, totalDebtsValue } from "../calc/engine.js";
import { fmtCurrency0, fmtCurrency2, fmtPercent1 } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { syncUiModeToggle } from "../lib/uimode.js";
import { optionsHtml, historyTrendHtml } from "../lib/ledger-table.js";
import { renderLineChart, sparklineHtml, sparklinePlaceholderHtml } from "../lib/charts.js";
import { showToast } from "../lib/toast.js";
import { appendHistorySnapshot } from "../calc/ledger.js";
import { renderProjectionOutputs } from "./projections.js";
import { renderDashboardStats } from "./dashboard.js";

function assetRowHtml(item, idx){
  return '<tr data-index="' + idx + '">' +
    '<td><input type="text" class="a-what" value="' + escapeAttr(item.what) + '" aria-label="Asset name">' + historyTrendHtml(item) + '</td>' +
    '<td><select class="a-category" title="Move to a different category" aria-label="Category">' + optionsHtml(ASSET_CATEGORIES, item.category) + '</select></td>' +
    '<td class="num"><input type="number" step="100" min="0" class="a-amount" value="' + item.amount + '" aria-label="Asset value"></td>' +
    '<td><input type="text" class="a-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></td>' +
    '<td><button type="button" class="asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button></td>' +
    '<td><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete asset">✕</button></td>' +
    '</tr>';
}

function gainLossHtml(item){
  if(item.avgCost == null || item.avgCost === "") return '<span class="calc-note">—</span>';
  var qty = Number(item.quantity) || 0;
  var cost = Number(item.avgCost) || 0;
  var price = Number(item.price) || 0;
  var gainDollar = (price - cost) * qty;
  var pct = cost ? (price - cost) / cost : 0;
  var cls = gainDollar > 0 ? "up" : (gainDollar < 0 ? "down" : "");
  var arrow = gainDollar > 0 ? "▲" : (gainDollar < 0 ? "▼" : "–");
  return '<span class="asset-trend gain-cell ' + cls + '">' + arrow + ' ' + fmtCurrency0.format(Math.abs(gainDollar)) +
    ' (' + fmtPercent1.format(Math.abs(pct)) + ')</span>';
}

function holdingRowHtml(item, idx){
  var qty = Number(item.quantity) || 0;
  var price = Number(item.price) || 0;
  return '<tr data-index="' + idx + '">' +
    '<td><input type="text" class="h-what" value="' + escapeAttr(item.what) + '" aria-label="Holding name">' + historyTrendHtml(item) + '</td>' +
    '<td>' + (sparklineHtml(item.history) || sparklinePlaceholderHtml()) + '</td>' +
    '<td><input type="text" class="h-symbol" value="' + escapeAttr(item.symbol || "") + '" placeholder="e.g. CBA" aria-label="Ticker symbol"></td>' +
    '<td><select class="h-market">' + optionsHtml(SHARE_MARKETS, item.market || "ASX") + '</select></td>' +
    '<td class="num"><input type="number" step="any" min="0" class="h-qty" value="' + qty + '" aria-label="Quantity"></td>' +
    '<td class="num"><input type="number" step="0.01" min="0" class="h-avgcost" value="' + (item.avgCost != null ? item.avgCost : "") + '" placeholder="—" aria-label="Average cost per share"></td>' +
    '<td class="num"><input type="number" step="0.01" min="0" class="h-price" value="' + price + '" aria-label="Current price per share">' +
      (item.priceUpdated ? '<span class="computed-note h-price-note">as of ' + escapeAttr(item.priceUpdated) + '</span>' : '<span class="computed-note h-price-note"></span>') + '</td>' +
    '<td class="num h-value-cell">' + fmtCurrency0.format(qty * price) + '</td>' +
    '<td class="h-gain-cell">' + gainLossHtml(item) + '</td>' +
    '<td><input type="text" class="h-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></td>' +
    '<td><button type="button" class="asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button></td>' +
    '<td><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete holding">✕</button></td>' +
    '</tr>';
}

export function patchHoldingRow(tr, item){
  var qty = Number(item.quantity) || 0;
  var price = Number(item.price) || 0;
  var valueCell = tr.querySelector(".h-value-cell");
  if(valueCell) valueCell.textContent = fmtCurrency0.format(qty * price);
  var gainCell = tr.querySelector(".h-gain-cell");
  if(gainCell) gainCell.innerHTML = gainLossHtml(item);
  var priceNote = tr.querySelector(".h-price-note");
  if(priceNote) priceNote.textContent = item.priceUpdated ? ("as of " + item.priceUpdated) : "";
  var subCell = tr.querySelector(".h-sub-cell");
  if(subCell) subCell.textContent = qty + " · " + fmtCurrency2.format(holdingAvgCostDisplay(item, price));
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
export function renderAssetPersonFilter(){
  var el = document.getElementById("assetsPersonFilter");
  if(!el) return;
  var persons = distinctAssetPersons();
  // Nobody's tagged a person yet — nothing to filter by, so stay out of the way entirely
  // rather than showing an "Everyone"/"Household" toggle with no other option to choose.
  if(!persons.length){ el.innerHTML = ""; return; }
  var options = [{ key: "", label: "Everyone" }, { key: "__household", label: "Household" }]
    .concat(persons.map(function(p){ return { key: p, label: p }; }));
  el.innerHTML = options.map(function(o){
    return '<button type="button" class="subnav-item' + (assetPersonFilter === o.key ? " active" : "") + '" data-asset-person-filter="' + escapeAttr(o.key) + '">' + escapeAttr(o.label) + '</button>';
  }).join("");
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
    '<svg class="m-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>' +
  '</div>';
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="a-what" value="' + escapeAttr(item.what) + '" aria-label="Asset name"></div>' +
      '<div class="m-edit-field"><label>Category</label><select class="a-category" title="Move to a different category" aria-label="Category">' + optionsHtml(ASSET_CATEGORIES, item.category) + '</select></div>' +
      '<div class="m-edit-field span2"><label>Value</label><input type="number" step="100" min="0" class="a-amount" value="' + item.amount + '" aria-label="Asset value"></div>' +
      '<div class="m-edit-field"><label>Person</label><input type="text" class="a-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></div>' +
    '</div>' +
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
  var isModern = state.uiMode === "modern";
  var body;
  if(!data.items.length){
    body = '<p class="ledger-note" style="margin:0 0 12px">No ' + escapeAttr(cat) + ' tracked yet.</p>' + footerBtn;
  } else if(isModern){
    var rowMeta = assetRowMeta(data);
    body = '<div class="m-card" id="assetsComp-' + cat + '">' + modernAssetCompBarHtml(rowMeta) + '<div class="m-rows m-asset-rows">' + rowMeta.map(function(m){ return modernAssetRowHtml(m.item, m.idx, m.colorIdx); }).join("") + '</div></div><div class="ledger-footer">' + footerBtn + '</div>';
  } else {
    body = '<div class="table-scroll"><table class="assets-table" id="assetCatTable-' + cat + '"></table></div><div class="ledger-footer">' + footerBtn + '</div>';
  }
  container.innerHTML = '<div class="ledgers"><details class="ledger" open>' +
    '<summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">' + escapeAttr(cat) + '</h2></div>' +
    '<div class="ledger-total">Total <b>' + fmtCurrency0.format(total) + '</b></div></summary>' +
    '<div class="ledger-body">' + body + '</div></details></div>';
  if(data.items.length && !isModern){
    var thead = '<thead><tr><th>What</th><th>Category</th><th class="num">Value</th><th>Person</th><th></th><th></th></tr></thead>';
    var rows = data.items.map(function(item, i){ return assetRowHtml(item, data.indices[i]); }).join("");
    document.getElementById("assetCatTable-" + cat).innerHTML = thead + "<tbody>" + rows + "</tbody>";
  }
}

function vehicleRowHtml(item, idx){
  return '<tr data-index="' + idx + '">' +
    '<td><input type="text" class="v-what" value="' + escapeAttr(item.what) + '" aria-label="Vehicle name">' + historyTrendHtml(item) + '</td>' +
    '<td class="num"><input type="number" step="500" min="0" class="v-purchaseprice" value="' + (Number(item.purchasePrice) || 0) + '" aria-label="Purchase price"></td>' +
    '<td><input type="date" class="v-purchasedate" value="' + escapeAttr(item.purchaseDate || "") + '" aria-label="Purchase date"></td>' +
    '<td class="num"><input type="number" step="0.5" min="0" max="100" class="v-deprate" value="' + (item.depreciationRate != null ? item.depreciationRate : 15) + '" aria-label="Depreciation % per year"></td>' +
    '<td class="num v-value-cell">' + fmtCurrency0.format(Number(item.amount) || 0) + (item.computed ? '<span class="computed-note">auto</span>' : '<span class="computed-note">set price + date to auto-depreciate</span>') + '</td>' +
    '<td><input type="text" class="v-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></td>' +
    '<td><button type="button" class="asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button></td>' +
    '<td><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete vehicle">✕</button></td>' +
    '</tr>';
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
    '<svg class="m-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>' +
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
  var isModern = state.uiMode === "modern";
  var body;
  if(!data.items.length){
    body = '<p class="ledger-note" style="margin:0 0 12px">No vehicles tracked yet.</p>' + footerBtn;
  } else if(isModern){
    var rowMeta = assetRowMeta(data);
    body = '<div class="m-card" id="assetsComp-Vehicle">' + modernAssetCompBarHtml(rowMeta) + '<div class="m-rows m-asset-rows">' + rowMeta.map(function(m){ return modernVehicleRowHtml(m.item, m.idx, m.colorIdx); }).join("") + '</div></div><div class="ledger-footer">' + footerBtn + '</div>';
  } else {
    body = '<div class="table-scroll"><table class="assets-table holdings-table" id="vehiclesTable"></table></div><div class="ledger-footer">' + footerBtn + '</div>';
  }
  container.innerHTML = '<div class="ledgers"><details class="ledger" open>' +
    '<summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">Vehicle</h2></div>' +
    '<div class="ledger-total">Total <b>' + fmtCurrency0.format(total) + '</b></div></summary>' +
    '<div class="ledger-body"><p class="ledger-note" style="margin-left:0">Current value is estimated as declining-balance depreciation from your purchase price — a common approximation for cars, not a valuation. Leave depreciation fields blank to enter a value manually instead.</p>' + body + '</div></details></div>';
  if(data.items.length && !isModern){
    var thead = '<thead><tr><th>What</th><th class="num">Purchase price</th><th>Purchase date</th><th class="num">Depreciation %/yr</th><th class="num">Current value</th><th>Person</th><th></th><th></th></tr></thead>';
    var rows = data.items.map(function(item, i){ return vehicleRowHtml(item, data.indices[i]); }).join("");
    document.getElementById("vehiclesTable").innerHTML = thead + "<tbody>" + rows + "</tbody>";
  }
}

function holdingAvgCostDisplay(item, price){
  return item.avgCost != null && item.avgCost !== "" ? Number(item.avgCost) : price;
}
function modernShareRowHtml(item, idx, colorIdx){
  var qty = Number(item.quantity) || 0;
  var price = Number(item.price) || 0;
  var isOpen = !!modernAssetRowOpen[idx];
  var initials = (item.symbol || item.what || "?").slice(0, 2).toUpperCase();
  var avatar = '<span class="m-avatar' + (colorIdx != null ? " series-color-" + colorIdx : " m-avatar-neutral") + '">' + escapeAttr(initials) + '</span>';
  var spark = sparklineHtml(item.history) || sparklinePlaceholderHtml();
  var summary = '<div class="m-row-summary" role="button" tabindex="0" data-row-toggle>' +
    avatar +
    '<div style="flex:1 1 auto; min-width:0">' +
      '<div class="m-row-name">' + escapeAttr(item.what) + '</div>' +
      '<div class="m-row-sub h-sub-cell">' + qty + ' · ' + fmtCurrency2.format(holdingAvgCostDisplay(item, price)) + '</div>' +
    '</div>' +
    spark +
    '<div class="m-row-share-value">' +
      '<div class="m-row-amt h-value-cell" data-computed="amt">' + fmtCurrency0.format(qty * price) + '</div>' +
      '<div class="h-gain-cell">' + gainLossHtml(item) + '</div>' +
    '</div>' +
    '<svg class="m-row-chev" width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg>' +
  '</div>';
  var edit = '<div class="m-row-edit"><div class="m-row-edit-inner"><div class="m-row-edit-pad">' +
    '<div class="m-edit-grid">' +
      '<div class="m-edit-field span3"><label>What</label><input type="text" class="h-what" value="' + escapeAttr(item.what) + '" aria-label="Holding name"></div>' +
      '<div class="m-edit-field"><label>Symbol</label><input type="text" class="h-symbol" value="' + escapeAttr(item.symbol || "") + '" placeholder="e.g. CBA" aria-label="Ticker symbol"></div>' +
      '<div class="m-edit-field"><label>Qty</label><input type="number" step="any" min="0" class="h-qty" value="' + qty + '" aria-label="Quantity"></div>' +
      '<div class="m-edit-field"><label>Price</label><input type="number" step="0.01" min="0" class="h-price" value="' + price + '" aria-label="Current price per share">' + (item.priceUpdated ? '<span class="computed-note h-price-note">as of ' + escapeAttr(item.priceUpdated) + '</span>' : '<span class="computed-note h-price-note"></span>') + '</div>' +
    '</div>' +
    '<details class="tax-advanced m-more-options"><summary>More options</summary>' +
      '<div class="m-edit-grid" style="margin-top:8px">' +
        '<div class="m-edit-field"><label>Market</label><select class="h-market">' + optionsHtml(SHARE_MARKETS, item.market || "ASX") + '</select></div>' +
        '<div class="m-edit-field"><label>Avg cost</label><input type="number" step="0.01" min="0" class="h-avgcost" value="' + (item.avgCost != null ? item.avgCost : "") + '" placeholder="—" aria-label="Average cost per share"></div>' +
        '<div class="m-edit-field"><label>Person</label><input type="text" class="h-person" list="personSuggestions" value="' + escapeAttr(item.person || "") + '" placeholder="Household" aria-label="Person"></div>' +
      '</div>' +
    '</details>' +
    '<div class="m-edit-actions"><button type="button" class="btn btn-ghost btn-sm asset-log-btn" data-asset-log="' + idx + '" title="Snapshot the value above with today\'s date, so it shows up in the portfolio-over-time chart below">Log</button><button type="button" class="btn btn-ghost btn-sm row-del" data-asset-del="' + idx + '" aria-label="Delete holding">Delete</button></div>' +
  '</div></div></div>';
  return '<div class="m-row' + (isOpen ? " open" : "") + '" data-section="assets" data-index="' + idx + '">' + summary + edit + '</div>';
}

// Aggregates unrealized gain/loss across a set of holdings (whatever's currently visible —
// already person-filtered by the caller via assetCategoryItems). Only counts holdings with an
// avg cost set, same requirement gainLossHtml() uses per-row, so a portfolio where nobody's
// entered a cost basis yet correctly reports "nothing to show" rather than a misleading $0.
function sharesGainLossSummary(items){
  var totalCost = 0, totalValue = 0, upCount = 0, downCount = 0, flatCount = 0;
  items.forEach(function(item){
    if(item.avgCost == null || item.avgCost === "") return;
    var qty = Number(item.quantity) || 0;
    var cost = Number(item.avgCost) || 0;
    var price = Number(item.price) || 0;
    totalCost += qty * cost;
    totalValue += qty * price;
    var gain = (price - cost) * qty;
    if(gain > 0.5) upCount++;
    else if(gain < -0.5) downCount++;
    else flatCount++;
  });
  var trackedCount = upCount + downCount + flatCount;
  var gainDollar = totalValue - totalCost;
  return {
    trackedCount: trackedCount, gainDollar: gainDollar,
    pct: totalCost ? gainDollar / totalCost : 0,
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
  var cls = s.gainDollar > 0.5 ? "up" : (s.gainDollar < -0.5 ? "down" : "");
  var arrow = s.gainDollar > 0.5 ? "▲" : (s.gainDollar < -0.5 ? "▼" : "–");
  return '<div class="shares-glance">' +
    '<div class="shares-glance-figure asset-trend ' + cls + '">' + arrow + ' ' + fmtCurrency0.format(Math.abs(s.gainDollar)) + ' (' + fmtPercent1.format(Math.abs(s.pct)) + ')</div>' +
    '<div class="shares-glance-sub">unrealized gain/loss, across ' + s.trackedCount + ' holding' + (s.trackedCount === 1 ? "" : "s") + ' with an avg cost set</div>' +
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

export function renderSharesSubpage(){
  var container = document.getElementById("assetsSub-Shares");
  if(!container) return;
  var data = assetCategoryItems("Shares");
  var total = data.items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
  var footerBtn = '<button type="button" class="btn btn-sm' + (data.items.length ? " btn-ghost" : "") + '" data-add="holding" title="Track an individual holding — symbol, quantity, cost, and value. Set Market to Crypto to track a coin the same way.">+ Add share holding</button>';
  var isModern = state.uiMode === "modern";
  var body;
  if(!data.items.length){
    body = '<p class="ledger-note" style="margin:0 0 12px">No share holdings yet — set Market to "Crypto" on a holding to track a coin the same way (quantity, avg cost, gain/loss, sparkline).</p>' + footerBtn;
  } else if(isModern){
    var rowMeta = assetRowMeta(data);
    body = '<div class="m-card" id="assetsComp-Shares">' + modernAssetCompBarHtml(rowMeta) + '<div class="m-rows m-asset-rows">' + rowMeta.map(function(m){ return modernShareRowHtml(m.item, m.idx, m.colorIdx); }).join("") + '</div></div><div class="ledger-footer">' + footerBtn + '</div>';
  } else {
    body = '<div class="table-scroll"><table class="assets-table holdings-table" id="sharesTable"></table></div><div class="ledger-footer">' + footerBtn + '</div>';
  }
  var pasteTool = data.items.length
    ? '<details class="tax-advanced" style="margin:0 0 14px"><summary>Paste prices from Google Sheets</summary>' +
        '<p class="ledger-note" style="margin:8px 0">This app never fetches prices itself — nothing is sent anywhere. First time: "Copy to clipboard", then paste straight into an empty cell in a Google Sheet (or "Download" and import the file instead) — either way you get a live-price formula already written for every holding, crypto included. Then copy its Symbol and Price columns and paste the two-column range below; matches your holdings by ticker symbol (case-insensitive). After that, re-paste the same two columns any time to refresh prices.</p>' +
        '<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap">' +
          '<button type="button" class="btn btn-sm btn-ghost" id="sharesCopyPriceTemplateBtn" title="Copy the same table to your clipboard, ready to paste straight into a Google Sheets cell">⧉ Copy to clipboard</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="sharesExportPriceTemplateBtn" title="A CSV with every holding\'s symbol and a ready-made =GOOGLEFINANCE(...) formula — open it in Google Sheets to get live prices without writing the formulas yourself">⇩ Download price template</button>' +
        '</div>' +
        '<textarea id="sharesPasteArea" rows="4" placeholder="CBA&#9;105.32&#10;BHP&#9;43.10" style="width:100%;box-sizing:border-box;font-family:&quot;IBM Plex Mono&quot;,monospace;font-size:12.5px;padding:8px;background:var(--paper-sunken);border:1px solid var(--border);border-radius:8px;color:var(--ink);resize:vertical"></textarea>' +
        '<div style="margin-top:8px"><button type="button" class="btn btn-sm" id="sharesPasteApply">Update prices</button></div>' +
      '</details>'
    : "";
  container.innerHTML = '<div class="ledgers"><details class="ledger" open>' +
    '<summary><div class="ledger-title"><svg class="ledger-caret" width="9" height="9" viewBox="0 0 8 8"><path d="M1 0l6 4-6 4z" fill="currentColor"/></svg><h2 class="section-title">Shares</h2></div>' +
    '<div class="ledger-total">Total <b>' + fmtCurrency0.format(total) + '</b></div></summary>' +
    '<div class="ledger-body"><div id="sharesGlance">' + sharesGainLossGlanceHtml(data.items) + '</div>' + pasteTool + body + '</div></details></div>';
  if(data.items.length && !isModern){
    var thead = '<thead><tr><th>What</th><th>Trend</th><th>Symbol</th><th>Mkt</th><th class="num">Qty</th><th class="num">Avg cost</th><th class="num">Price</th><th class="num">Value</th><th>Gain/Loss</th><th>Person</th><th></th><th></th></tr></thead>';
    var rows = data.items.map(function(item, i){ return holdingRowHtml(item, data.indices[i]); }).join("");
    document.getElementById("sharesTable").innerHTML = thead + "<tbody>" + rows + "</tbody>";
  }
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
  ASSET_CATEGORIES.forEach(function(cat){ values[cat] = assetCategoryItems(cat).items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0); });
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
      .reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
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
    var total = data.items.reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0);
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
  var liquid = state.assets.filter(function(a){ return LIQUID_CATEGORIES.indexOf(a.category) !== -1; })
                            .reduce(function(s, a){ return s + (Number(a.amount) || 0); }, 0)
                          + propertiesOffsetTotal();
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
  var dates = Object.keys(dateSet).sort();
  var today = new Date().toISOString().slice(0, 10);
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
    var total = state.assets.reduce(function(sum, a){ return sum + valueAtDate(a.history, a.amount, d); }, 0);
    total += state.properties.reduce(function(sum, p){
      if(!hasValueAtDate(p.history, d)) return sum;
      var loanNet = (p.loans || []).reduce(function(s, l){
        return s + Math.max(0, (Number(l.balance) || 0) - (Number(l.offsetBalance) || 0));
      }, 0);
      return sum + valueAtDate(p.history, p.value, d) - loanNet;
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

export function renderAssets(){
  syncUiModeToggle();
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
  if(state.uiMode === "modern"){
    container.innerHTML = '<div class="m-rows">' + state.debts.map(function(d, idx){
      return '<div class="m-row computed" data-debt-index="' + idx + '"><div class="m-row-summary" style="cursor:default">' +
        '<div style="flex:1 1 auto;min-width:0"><input type="text" class="debt-what" data-debt-index="' + idx + '" value="' + escapeAttr(d.what) + '" aria-label="Debt name" style="all:unset;width:100%;font:inherit;color:inherit">' + historyTrendHtml(d) + '</div>' +
        '<input type="number" step="100" min="0" class="debt-balance" data-debt-index="' + idx + '" value="' + d.balance + '" aria-label="Balance" style="width:110px;text-align:right;font-family:\'IBM Plex Mono\',monospace;border:1px solid transparent;background:transparent;color:inherit;padding:5px 6px;border-radius:6px">' +
        '<button type="button" class="asset-log-btn" data-debt-log="' + idx + '" title="Snapshot the balance above with today\'s date">Log</button>' +
        '<button type="button" class="btn btn-ghost btn-sm row-del" data-debt-del="' + idx + '" aria-label="Delete debt">✕</button>' +
      '</div></div>';
    }).join("") + '</div>';
  } else {
    container.innerHTML = '<div class="table-scroll"><table class="ledger-table"><thead><tr><th>What</th><th class="num">Balance</th><th></th></tr></thead><tbody>' +
      state.debts.map(function(d, idx){
        return '<tr><td class="what-cell"><input type="text" class="debt-what" data-debt-index="' + idx + '" value="' + escapeAttr(d.what) + '" aria-label="Debt name">' + historyTrendHtml(d) + '</td>' +
          '<td class="amount-cell"><input type="number" step="100" min="0" class="debt-balance" data-debt-index="' + idx + '" value="' + d.balance + '" aria-label="Balance"></td>' +
          '<td><button type="button" class="asset-log-btn" data-debt-log="' + idx + '" title="Snapshot the balance above with today\'s date">Log</button>' +
          '<button class="btn btn-ghost btn-sm row-del" data-debt-del="' + idx + '" aria-label="Delete row">✕</button></td></tr>';
      }).join("") + '</tbody></table></div>';
  }
}

export function logAssetSnapshot(idx){
  var asset = state.assets[idx];
  if(!asset) return;
  var num = Number(asset.amount) || 0;
  if(!Array.isArray(asset.history)) asset.history = [];
  var dateStr = appendHistorySnapshot(asset.history, num);
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
  var updatedCount = 0, notFound = [];
  var todayStr = new Date().toISOString().slice(0, 10);
  lines.forEach(function(line){
    var parsed = parseSharesPasteLine(line);
    if(!parsed) return;
    var matches = state.assets.filter(function(a){ return a.category === "Shares" && (a.symbol || "").toUpperCase() === parsed.symbol; });
    if(!matches.length){ notFound.push(parsed.symbol); return; }
    matches.forEach(function(item){
      item.price = parsed.price;
      item.priceUpdated = todayStr;
      item.amount = Math.round((Number(item.quantity) || 0) * parsed.price * 100) / 100;
    });
    updatedCount += matches.length;
  });
  renderAssets();
  renderNetWorthPanel();
  persist();
  var msg = updatedCount + " price" + (updatedCount === 1 ? "" : "s") + " updated" +
    (notFound.length ? " — no holding found for " + notFound.join(", ") : "");
  showToast(msg);
}
