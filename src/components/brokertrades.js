import { state } from "../state.js";
import { parseTrades, planTrades } from "../calc/brokertrades.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Investments → Shares → Import trades (v3.91.0) — calc/brokertrades.js ----------------
// Session-only: what was read, and which holding each code goes to.
export var tradesUi = { open: false, parsed: null, choice: {} };

export function readTradesText(text){
  return useParsedTrades(parseTrades(text));
}
// v3.96.0: what several files (or a spreadsheet's sheets) held, together.
export function useParsedTrades(parsed){
  tradesUi.parsed = parsed;
  tradesUi.choice = {};
  return parsed;
}
export function currentTradePlan(){
  return tradesUi.parsed ? planTrades(state.assets, tradesUi.parsed.trades, tradesUi.choice) : [];
}

export function tradesCardHtml(){
  var parsed = tradesUi.parsed;
  return '<details class="tax-advanced tr-card" style="margin:0 0 14px"' + (tradesUi.open ? ' open' : '') + ' data-tr-panel><summary>Import trades from your broker</summary>' +
    '<p class="ledger-note" style="margin:8px 0">Your broker\'s trade history — CommSec\'s Transactions CSV, Stake\'s Investment Activity report (.xlsx, one per financial year: choose them all at once), or any file with a date, code, buy/sell, units and price. Each buy becomes a purchase lot; each sell a recorded sale from the oldest lots first. Units held aren\'t changed, and reading the same file twice adds nothing.</p>' +
    '<div class="tr-inputs"><label class="btn btn-sm">Choose CSV or Excel<input type="file" accept=".csv,text/csv,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple data-tr-file hidden></label>' +
    '<span class="ledger-note">or paste it:</span></div>' +
    '<textarea class="tr-text" rows="3" data-tr-text placeholder="Date,Code,Side,Quantity,Price,Brokerage" aria-label="Paste trades CSV"></textarea>' +
    '<div><button type="button" class="btn btn-sm" data-tr-read>Read trades</button></div>' +
    (parsed ? '<div class="tr-preview">' + (parsed.trades.length ? tradesPreviewHtml(currentTradePlan(), state.assets, parsed) : '<p class="ledger-note">No trades found in that file' + (parsed.format ? '' : ' — it needs a header row with a date and either a Details column (CommSec) or code, units and price columns') + '.</p>') + '</div>' : '') +
  '</details>';
}

export function tradesPreviewHtml(plan, assets, parsed){
  var total = plan.reduce(function(s, p){ return s + (p.target != null ? p.newBuys.length + p.newSales.length : 0); }, 0);
  var rows = plan.map(function(p){
    var pick;
    if(!p.holdings.length) pick = '<span class="tr-none">no holding</span>';
    else if(p.holdings.length === 1) pick = escapeAttr(assets[p.holdings[0]].what || p.code) + ' <label class="tr-skip"><input type="checkbox" data-tr-skip="' + escapeAttr(p.code) + '"' + (p.target == null ? ' checked' : '') + '> leave out</label>';
    else pick = '<select data-tr-pick="' + escapeAttr(p.code) + '" aria-label="Which ' + escapeAttr(p.code) + ' holding">' +
      p.holdings.map(function(i){ return '<option value="' + i + '"' + (p.target === i ? ' selected' : '') + '>' + escapeAttr(assets[i].what || p.code) + '</option>'; }).join("") +
      '<option value="skip"' + (p.target == null ? ' selected' : '') + '>Leave out</option></select>';
    var news = p.target == null ? '—' : (p.newBuys.length + ' buy' + (p.newBuys.length === 1 ? '' : 's') + ', ' + p.newSales.length + ' sale' + (p.newSales.length === 1 ? '' : 's') + ' new' +
      (p.buys + p.sells > p.newBuys.length + p.newSales.length ? ' <small>(' + (p.buys + p.sells - p.newBuys.length - p.newSales.length) + ' already there)</small>' : ''));
    return '<li><div class="tr-row"><b>' + escapeAttr(p.code) + '</b><span class="tr-pick">' + pick + '</span><span class="tr-new">' + news + '</span></div>' +
      (p.problem && p.target != null || !p.holdings.length ? '<p class="tr-problem">' + escapeAttr(p.problem) + '</p>' : '') + '</li>';
  }).join("");
  return '<p class="ledger-note" style="margin:8px 0 4px">' + (parsed ? parsed.trades.length + ' trade' + (parsed.trades.length === 1 ? '' : 's') + ' read' + (parsed.format === "CommSec" ? ' (CommSec)' : '') + (parsed.skipped ? ', ' + parsed.skipped + ' other row' + (parsed.skipped === 1 ? '' : 's') + ' skipped' : '') + '.' : '') + '</p>' +
    '<ul class="tr-list">' + rows + '</ul>' +
    '<button type="button" class="btn btn-sm" data-tr-apply' + (total ? '' : ' disabled') + '>' + (total ? 'Add ' + total + ' trade' + (total === 1 ? '' : 's') : 'Nothing new to add') + '</button>';
}
