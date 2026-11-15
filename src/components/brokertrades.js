import { state } from "../state.js";
import { parseTrades, planTrades, holdingsFor } from "../calc/brokertrades.js";
import { escapeAttr } from "../lib/html.js";
import { fmtDate, fmtCurrency2 } from "../lib/format.js";

// Staged reads and destinations live only in this tab. No array position is a saved choice.
export var tradesUi = { open: false, parsed: null, choice: {}, sourceText: "", loading: false, error: "", notice: "", result: "", request: 0, dirty: false, review: null };
var holdingKeys = new WeakMap(), nextKey = 0;
export function tradeHoldingKey(asset){
  if(asset.id) return "id:" + asset.id;
  if(!holdingKeys.has(asset)) holdingKeys.set(asset, "row:" + (++nextKey));
  return holdingKeys.get(asset);
}
export function beginTradesRead(text){
  tradesUi.request++; tradesUi.sourceText = text || ""; tradesUi.parsed = null;
  tradesUi.choice = {}; tradesUi.review = null; tradesUi.error = ""; tradesUi.notice = ""; tradesUi.result = "";
  tradesUi.loading = true; tradesUi.dirty = false; tradesUi.open = true;
  return tradesUi.request;
}
export function cancelTradesRead(){
  tradesUi.request++; tradesUi.parsed = null; tradesUi.choice = {}; tradesUi.review = null;
  tradesUi.loading = false; tradesUi.error = ""; tradesUi.notice = ""; tradesUi.result = ""; tradesUi.dirty = false;
}
export function failTradesRead(request){
  if(request !== tradesUi.request) return false;
  tradesUi.loading = false; tradesUi.error = "Couldn't read those files. Choose CSV or Excel again, or paste CSV below. Nothing was imported.";
  return true;
}
export function readTradesText(text){
  var request = beginTradesRead(text);
  return useParsedTrades(parseTrades(text), request);
}
export function useParsedTrades(parsed, request){
  if(request != null && request !== tradesUi.request) return null;
  tradesUi.parsed = parsed; tradesUi.choice = {}; tradesUi.loading = false; tradesUi.error = ""; tradesUi.dirty = false; tradesUi.review = null;
  parsed.trades.forEach(function(t){
    var hs = holdingsFor(state.assets, t.code);
    tradesUi.choice[t.code] = hs.length === 1 ? tradeHoldingKey(state.assets[hs[0]]) : "choose";
  });
  return parsed;
}
export function currentTradePlan(){
  if(!tradesUi.parsed) return [];
  var mapped = {}, choices = tradesUi.choice;
  Object.keys(choices).forEach(function(code){
    var index = state.assets.findIndex(function(a){ return tradeHoldingKey(a) === choices[code]; });
    mapped[code] = index < 0 || holdingsFor(state.assets, code).indexOf(index) === -1 ? "skip" : index;
  });
  return planTrades(state.assets, tradesUi.parsed.trades, mapped).map(function(p){
    var key = choices[p.code] || "choose", asset = p.target != null ? state.assets[p.target] : null;
    p.choiceKey = key; p.needsChoice = key !== "skip" && !asset;
    var currencies = Array.from(new Set(tradesUi.parsed.trades.filter(function(t){ return t.code === p.code && t.currency; }).map(function(t){ return t.currency; })));
    p.sourceCurrencies = currencies;
    p.currencyProblem = asset && currencies.some(function(c){ return c !== (asset.currency || "AUD"); })
      ? "Source currency " + currencies.join(" / ") + " does not match this holding's " + (asset.currency || "AUD") + ". No conversion is made. Choose the correct holding, split the file by currency, or leave this code out." : "";
    return p;
  });
}
export function tradeReviewSignature(plan){
  return JSON.stringify(plan.map(function(p){ return { code:p.code, choice:p.choiceKey, candidates:p.holdings.map(function(i){ return tradeHoldingKey(state.assets[i]); }).sort(),
    holding:p.target != null ? state.assets[p.target] : null, buys:p.newBuys, sales:p.newSales, linked:p.linkSales, blocked:p.currencyProblem }; }));
}
function countTrades(n, noun){ return n + " " + noun + (n === 1 ? "" : "s"); }
function holdingLabel(asset){ return (asset.what || "Holding") + (asset.person ? " · " + asset.person : "") + (asset.market ? " · " + asset.market : "") + " · " + (asset.currency || "AUD"); }

export function tradesCardHtml(){
  var parsed = tradesUi.parsed, plan = currentTradePlan();
  tradesUi.review = parsed ? { signature: tradeReviewSignature(plan) } : null;
  return '<details class="tax-advanced tr-card" style="margin:0 0 14px"' + (tradesUi.open ? ' open' : '') + ' data-tr-panel><summary>Import trades from your broker</summary>' +
    '<p class="ledger-note">Choose CSV or Excel trade history, or paste CSV. Review the destination holding, dates and counts before adding lots and sales. Current units held do not change. Prices and brokerage must use the destination holding’s currency; no currency conversion is made. If Currency is absent, check the source currency yourself. References distinguish identical rows within this read. Recorded purchases match by date, units and price; recorded sales by date and units.</p>' +
    '<div class="tr-inputs"><button type="button" class="btn btn-sm" data-tr-pick-file>Choose CSV or Excel</button><input type="file" accept=".csv,text/csv,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple data-tr-file hidden></div>' +
    '<textarea class="tr-text field-control" rows="3" data-tr-text placeholder="Date,Code,Side,Quantity,Price,Brokerage" aria-label="Paste trades CSV">' + escapeAttr(tradesUi.sourceText) + '</textarea>' +
    '<div><button type="button" class="btn btn-sm" data-tr-read>Read trades</button> <button type="button" class="btn btn-sm btn-ghost" data-tr-cancel>Cancel review</button></div>' +
    '<p class="ledger-note" data-tr-status role="status" tabindex="-1">' + escapeAttr(tradesUi.loading ? "Reading files. Nothing has been imported." : tradesUi.error || tradesUi.result || tradesUi.notice || (tradesUi.dirty ? "Text changed. Read trades again before importing." : "")) + '</p>' +
    (parsed ? '<div class="tr-preview">' + (parsed.trades.length ? tradesPreviewHtml(plan, state.assets, parsed) : '<p class="ledger-note" data-tr-review tabindex="-1">No trades found. Check the Date, Code, Side, Quantity and Price columns, then choose or paste the corrected file.</p>') + '</div>' : '') + '</details>';
}

export function tradesPreviewHtml(plan, assets, parsed){
  var total = plan.reduce(function(s,p){ return s + (p.target != null && !p.currencyProblem ? p.newBuys.length + p.newSales.length : 0); },0);
  var blocked = plan.some(function(p){ return p.needsChoice || p.currencyProblem; });
  var rows = plan.map(function(p){
    var key = p.choiceKey || (p.target != null ? tradeHoldingKey(assets[p.target]) : "choose");
    var pick = '<label>Destination for ' + escapeAttr(p.code) + '<select class="field-control" data-tr-pick="' + escapeAttr(p.code) + '"><option value="choose"' + (key === "choose" || p.needsChoice ? ' selected' : '') + '>Choose a holding</option>' +
      p.holdings.map(function(i){ var id = tradeHoldingKey(assets[i]); return '<option value="' + escapeAttr(id) + '"' + (key === id ? ' selected' : '') + '>' + escapeAttr(holdingLabel(assets[i])) + '</option>'; }).join("") +
      '<option value="skip"' + (key === "skip" ? ' selected' : '') + '>Leave this code out</option></select></label>';
    var news = p.target == null ? "Not selected" : countTrades(p.newBuys.length, "buy") + ", " + countTrades(p.newSales.length, "sale") + " to add; " + countTrades(p.buys + p.sells - p.newBuys.length - p.newSales.length, "duplicate") + " left out";
    var currencies = p.sourceCurrencies || [], currency = currencies.length === 1 ? currencies[0] : p.target != null ? assets[p.target].currency || "AUD" : "";
    var totals = currencies.length > 1 ? "Mixed source currencies — totals withheld." : "Purchases " + fmtCurrency2.format(p.newBuys.reduce(function(n,t){return n+t.units*t.price+t.brokerage;},0)) + " " + currency + " · Sale proceeds " + fmtCurrency2.format(p.newSales.reduce(function(n,t){return n+t.units*t.price-t.brokerage;},0)) + " " + currency;
    var problem = p.currencyProblem || (p.needsChoice ? "Choose the destination, or explicitly leave this code out. A previous selection may no longer exist." : p.problem);
    return '<li><div class="tr-row"><b>' + escapeAttr(p.code) + '</b><span class="tr-pick">' + pick + '</span><span class="tr-new">' + escapeAttr(news) + '<br>' + escapeAttr(totals) + '</span></div>' + (problem ? '<p class="tr-problem">' + escapeAttr(problem) + '</p>' : '') + '</li>';
  }).join("");
  var dates = parsed && parsed.trades.map(function(t){ return t.date; }).sort();
  return '<p class="ledger-note" data-tr-review tabindex="-1">' + (parsed ? countTrades(parsed.trades.length, 'trade') + ' to review · ' + countTrades(parsed.duplicates || 0, 'duplicate row') + ' ignored · ' + countTrades(parsed.skipped || 0, 'row') + ' skipped' + (dates.length ? ' · ' + escapeAttr(fmtDate(dates[0],{year:true})) + ' to ' + escapeAttr(fmtDate(dates[dates.length-1],{year:true})) : '') + (parsed.unrecognised ? ' · ' + parsed.unrecognised + ' tables not recognised' : '') : 'Review the destinations') + '.</p>' +
    '<ul class="tr-list">' + rows + '</ul><button type="button" class="btn btn-sm" data-tr-apply' + (!total || blocked || tradesUi.dirty ? ' disabled' : '') + '>Add ' + countTrades(total, 'trade') + '</button>';
}
