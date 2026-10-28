import { state, persist } from "../state.js";
import { escapeAttr } from "../lib/html.js";
import { localDateStr } from "../lib/format.js";
import { applyPrices, applyBackfill } from "../calc/pricesheet.js";
import { coinIdsFor, coinGeckoUrl, parseCoinGecko, FX_URLS, parseFrankfurter, filePricesFor, fileWeeklyFor, backfillWanted, autoPricesDue } from "../calc/autoprices.js";

// ---------------- Investments → Shares: prices with no setup (v3.132.0) ----------------
// The read (calc/autoprices.js says what each source is and what it's told) and its card.

// Root-relative, like nav.js appAssetUrl (not imported: nav.js reads location at load, which the
// render-smoke tests can't provide).
function siteUrl(file){ return (location.hostname.indexOf("github.io") !== -1 ? "/wealth-planner" : "") + "/" + file; }
function getJson(url){
  return fetch(url, { credentials: "omit", cache: "no-store" }).then(function(r){
    if(!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  });
}
function firstJson(urls){
  var i = 0;
  function next(e){ return i < urls.length ? getJson(urls[i++]).catch(next) : Promise.reject(e || new Error("unreachable")); }
  return next();
}
function settle(p){ return p.then(function(v){ return { ok: true, value: v }; }, function(e){ return { ok: false, error: e }; }); }

// Reads every source that's on and applies what came back. Resolves with state.autoPrices.lastResult.
export function refreshAutoPrices(){
  var a = state.autoPrices, today = localDateStr();
  var coins = coinIdsFor(state.assets);
  var wantsFile = state.assets.some(function(x){ return x.category === "Shares" && x.market !== "Crypto" && x.symbol; });
  var jobs = [
    wantsFile ? settle(getJson(siteUrl("prices/latest.json"))) : Promise.resolve(null),
    wantsFile && backfillWanted(state.assets) ? settle(getJson(siteUrl("prices/weekly.json"))) : Promise.resolve(null),
    a.crypto !== false && coins.ids.length ? settle(getJson(coinGeckoUrl(coins.ids))) : Promise.resolve(null),
    a.fx !== false ? settle(firstJson(FX_URLS)) : Promise.resolve(null)
  ];
  return Promise.all(jobs).then(function(r){
    var file = r[0], weekly = r[1], cg = r[2], fx = r[3];
    var prices = [], res = { ok: true, at: new Date().toISOString(), updated: 0, missing: [], fx: false, backfilled: 0, problems: [] };
    if(file){
      if(file.ok && file.value && file.value.updated){ var fp = filePricesFor(file.value, state.assets); prices = prices.concat(fp.prices); res.missing = fp.missing; res.fileDate = file.value.updated; }
      else if(file.ok) res.problems.push("the price file hasn't been published yet");
      else res.problems.push("the app's price file couldn't be read");
    }
    if(cg){
      if(cg.ok){ var cp = parseCoinGecko(cg.value, coins.bySymbol); prices = prices.concat(cp); res.coins = cp.length; }
      else res.problems.push("CoinGecko didn't answer");
    }
    if(fx){
      var rate = fx.ok ? parseFrankfurter(fx.value) : null;
      if(rate) prices.push({ symbol: "USDAUD", price: rate });
      else res.problems.push("the exchange rate couldn't be read");
    }
    var applied = applyPrices(state, prices, today);
    res.updated = applied.updated; res.fx = applied.fxUpdated;
    if(weekly && weekly.ok){ var b = applyBackfill(state, fileWeeklyFor(weekly.value, state.assets), today); res.backfilled = b.added; }
    if(!prices.length && res.problems.length) res.ok = false;
    a.lastRead = today;
    a.lastResult = res;
    persist();
    return res;
  });
}
export function autoPricesNeeded(){ return autoPricesDue(state.autoPrices, localDateStr()); }

export function autoPricesResultText(r){
  if(!r) return "Not read yet.";
  var bits = [];
  bits.push(r.updated + " price" + (r.updated === 1 ? "" : "s") + " updated" + (r.fileDate ? " (closes of " + r.fileDate + ")" : ""));
  if(r.fx) bits.push("USD → AUD refreshed");
  if(r.backfilled) bits.push(r.backfilled + " past weekly price" + (r.backfilled === 1 ? "" : "s") + " filled in");
  if(r.missing && r.missing.length) bits.push("not in the price file: " + r.missing.join(", ") + " — use a Google Sheet below or type the price");
  if(r.problems && r.problems.length) bits.push(r.problems.join("; "));
  return bits.join(" · ");
}
export function autoPricesCardHtml(){
  var a = state.autoPrices || {}, r = a.lastResult;
  var when = r && r.at ? new Date(r.at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  var check = function(key, label, on){ return '<label class="pref-check ap-check"><input type="checkbox" data-ap="' + key + '"' + (on ? " checked" : "") + '> ' + label + '</label>'; };
  return '<div class="ap-card">' +
    '<p class="ledger-note" style="margin:0 0 8px">Prices update by themselves once a day when you open the app: ASX and US shares and ETFs from this app\'s own daily price file (end-of-day closes for a fixed public list — asking for it tells nobody what you hold), crypto from CoinGecko, and USD → AUD from the European Central Bank via Frankfurter.</p>' +
    check("on", "Update prices automatically", a.on !== false) +
    (a.on !== false ? check("crypto", "Crypto from CoinGecko <small>(sends only the coins' names)</small>", a.crypto !== false) + check("fx", "USD → AUD from Frankfurter <small>(sends only the currency pair)</small>", a.fx !== false) : '') +
    '<p class="ps-status ' + (r && !r.ok ? "bad" : "") + '">' + (r ? "<b>" + (r.ok ? "Read " : "Tried ") + escapeAttr(when) + ":</b> " : "") + escapeAttr(autoPricesResultText(r)) + '</p>' +
    (a.on !== false ? '<button type="button" class="btn btn-sm" data-ap-read>Update now</button>' : '') +
  '</div>';
}
