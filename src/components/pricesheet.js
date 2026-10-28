import { state, persist } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { localDateStr } from "../lib/format.js";
import { sheetCsvUrls, readPriceSheet, applyPrices, applyBackfill, sheetRefreshDue } from "../calc/pricesheet.js";

// ---------------- Investments → Shares: prices from a Google Sheet (v3.75.0) ----------------
// The card that sets it up, and the read itself. The read only ever GETs the one sheet link the
// person pasted; nothing is sent with it.

// The fallback start for backfilling holdings that have no purchase lots: two years ago.
// Session-only: whether the Shares page's sheet panel is open, so a re-render after a read keeps it.
export var priceSheetUi = { open: false };

export function defaultBackfillFrom(today){
  var t = today || localDateStr();
  return (Number(t.slice(0, 4)) - 2) + t.slice(4);
}

function fetchText(url){
  return fetch(url, { credentials: "omit", cache: "no-store" }).then(function(r){
    if(!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  }).then(function(t){
    // A sheet that isn't shared answers with Google's sign-in page, not CSV.
    if(/^\s*</.test(t)) throw new Error("not-shared");
    return t;
  });
}
// Tries each URL the link allows, first one that reads wins.
function fetchSheet(link){
  var urls = sheetCsvUrls(link);
  if(!urls.length) return Promise.reject(new Error("bad-link"));
  var i = 0, lastErr = null;
  function next(){
    if(i >= urls.length) return Promise.reject(lastErr || new Error("unreachable"));
    return fetchText(urls[i++]).catch(function(e){ lastErr = e; return next(); });
  }
  return next();
}

// Reads the sheet and applies it. Resolves with the result recorded on state.priceSheet.lastResult.
export function refreshPriceSheet(){
  var sheet = state.priceSheet;
  var today = localDateStr();
  return fetchSheet(sheet.url).then(function(text){
    var parsed = readPriceSheet(text);
    var p = applyPrices(state, parsed.prices, today);
    var b = applyBackfill(state, parsed.history, today);
    sheet.lastRead = today;
    sheet.lastResult = { ok: true, at: new Date().toISOString(), updated: p.updated, fx: p.fxUpdated, benchmarks: p.benchmarks,
      notFound: p.notFound, unreadable: parsed.unreadable, backfilled: b.added, backfilledHoldings: b.holdings };
    persist();
    return sheet.lastResult;
  }).catch(function(e){
    var why = e && e.message;
    sheet.lastResult = { ok: false, at: new Date().toISOString(),
      reason: why === "bad-link" ? "That isn't a Google Sheets link." :
        why === "not-shared" ? "The sheet isn't shared. In Google Sheets: Share → General access → Anyone with the link (Viewer)." :
        "Couldn't reach the sheet" + (navigator.onLine === false ? " — you're offline." : ". Check it's shared as Anyone with the link, or use File → Share → Publish to web → CSV and paste that link.") };
    persist();
    return sheet.lastResult;
  });
}
export function priceSheetDue(){ return sheetRefreshDue(state.priceSheet, localDateStr()); }

export function priceSheetResultText(r){
  if(!r) return "";
  if(!r.ok) return r.reason;
  var bits = [r.updated + " price" + (r.updated === 1 ? "" : "s") + " updated"];
  if(r.fx) bits.push("USD → AUD refreshed");
  if(r.benchmarks) bits.push(r.benchmarks + " benchmark price" + (r.benchmarks === 1 ? "" : "s"));
  if(r.backfilled) bits.push(r.backfilled + " past weekly price" + (r.backfilled === 1 ? "" : "s") + " filled in across " + r.backfilledHoldings + " holding" + (r.backfilledHoldings === 1 ? "" : "s"));
  if(r.notFound && r.notFound.length) bits.push("no holding for " + r.notFound.join(", "));
  if(r.unreadable && r.unreadable.length) bits.push("no price yet for " + r.unreadable.join(", ") + " (#N/A or blank in the sheet)");
  return bits.join(" · ");
}

export function priceSheetCardHtml(){
  var sh = state.priceSheet || {};
  var from = sh.backfillFrom || defaultBackfillFrom();
  var r = sh.lastResult;
  var when = r && r.at ? new Date(r.at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  var status = sh.url
    ? '<p class="ps-status ' + (r && !r.ok ? "bad" : "") + '">' + (r ? "<b>" + (r.ok ? "Read " : "Tried ") + escapeAttr(when) + ":</b> " + escapeAttr(priceSheetResultText(r)) : "Not read yet.") + '</p>'
    : "";
  return '<div class="ps-card">' +
    '<p class="ledger-note help">Prices come from a Google Sheet you keep, read each day you open the app. Only the sheet is read — no price service is asked anything, and nothing about your holdings is sent.</p>' +
    '<ol class="ps-steps">' +
      '<li><b>Make the sheet.</b> Copy the template and paste it into cell A1 of an empty Google Sheet. It has a live price for each holding, plus weekly prices back to its first purchase — or, for a holding with no purchase lots, back to ' +
        '<input type="date" class="ps-from" data-ps-from value="' + escapeAttr(from) + '" aria-label="Fill in prices back to">' + '.' +
        '<div class="ps-actions"><button type="button" class="btn btn-sm" data-ps-copy>⧉ Copy sheet template</button></div></li>' +
      '<li><b>Share it.</b> In Google Sheets: Share → General access → <i>Anyone with the link</i>, Viewer. Copy the link.</li>' +
      '<li><b>Paste the link here.</b>' +
        '<div class="ps-actions"><input type="url" class="ps-url" data-ps-url placeholder="https://docs.google.com/spreadsheets/d/…" value="' + escapeAttr(sh.url || "") + '" aria-label="Google Sheet link">' +
        '<button type="button" class="btn btn-sm btn-primary" data-ps-read>' + (sh.url ? "Read now" : "Save and read") + '</button>' +
        (sh.url ? '<button type="button" class="btn btn-sm btn-ghost" data-ps-forget>Forget link</button>' : '') + '</div></li>' +
    '</ol>' + status +
    '<p class="ledger-note ps-note help">Holdings without purchase lots are filled in as if you held today\'s units the whole time. Add lots (open a holding → Purchase lots) and copy the template again for exact figures. Prices you\'ve already recorded are never changed — only weeks before the first one are filled in.</p>' +
  '</div>';
}
