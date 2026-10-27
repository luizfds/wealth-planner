// ---------------- Prices with no setup (v3.132.0) ----------------
//
// Until now a price moved only when someone pasted one or kept a Google Sheet. Three sources now
// fill them in by themselves, once a day when the app opens:
//   - the app's own price file (prices/latest.json and prices/weekly.json on this site), written each
//     weekday by a GitHub Action for a fixed public list of ASX and US tickers — the request goes to
//     the app's own host and says nothing about what anyone holds;
//   - CoinGecko for crypto — only the coins' names are sent;
//   - Frankfurter (the European Central Bank's daily rates) for USD → AUD — only the pair is sent.
// A Google Sheet, when one is set, is read afterwards and wins: it's the person's own choice.
// Pure: the component fetches and hands the parsed JSON here.

// Common coins by ticker → CoinGecko's id. A holding whose symbol isn't here can carry the id
// itself (lower-case, as CoinGecko writes it: "render-token").
export var COINS = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", DOT: "polkadot",
  LTC: "litecoin", BCH: "bitcoin-cash", LINK: "chainlink", AVAX: "avalanche-2", MATIC: "matic-network", POL: "polygon-ecosystem-token",
  ATOM: "cosmos", XLM: "stellar", TRX: "tron", BNB: "binancecoin", USDT: "tether", USDC: "usd-coin", SHIB: "shiba-inu",
  UNI: "uniswap", AAVE: "aave", ALGO: "algorand", NEAR: "near", APT: "aptos", ARB: "arbitrum", OP: "optimism", SUI: "sui",
  TON: "the-open-network", HBAR: "hedera-hashgraph", FIL: "filecoin", ICP: "internet-computer", XMR: "monero", ETC: "ethereum-classic",
  PEPE: "pepe", RNDR: "render-token", RENDER: "render-token", INJ: "injective-protocol", KAS: "kaspa", SEI: "sei-network"
};

function holdings(assets){ return (assets || []).filter(function(a){ return a && a.category === "Shares" && String(a.symbol || "").trim(); }); }
function sym(a){ return String(a.symbol || "").trim().toUpperCase(); }

// The coins to ask CoinGecko about: { ids: [...], bySymbol: { BTC: "bitcoin" } }.
export function coinIdsFor(assets){
  var bySymbol = {};
  holdings(assets).forEach(function(a){
    if(a.market !== "Crypto") return;
    var raw = String(a.symbol).trim(), s = raw.toUpperCase();
    var id = COINS[s] || (/^[a-z0-9-]+$/.test(raw) && raw.length > 3 ? raw : null);
    if(id) bySymbol[s] = id;
  });
  var ids = Object.keys(bySymbol).map(function(k){ return bySymbol[k]; }).filter(function(v, i, arr){ return arr.indexOf(v) === i; }).sort();
  return { ids: ids, bySymbol: bySymbol };
}
// Crypto is quoted in USD in this app (MARKET_CURRENCY), so that's what's asked for.
export function coinGeckoUrl(ids){
  return "https://api.coingecko.com/api/v3/simple/price?ids=" + ids.map(encodeURIComponent).join(",") + "&vs_currencies=usd";
}
// { bitcoin: { usd: 67000 } } → [{ symbol, price }] for the symbols asked about.
export function parseCoinGecko(json, bySymbol){
  var out = [];
  Object.keys(bySymbol || {}).forEach(function(s){
    var row = json && json[bySymbol[s]];
    var p = row && Number(row.usd);
    if(p > 0) out.push({ symbol: s, price: p });
  });
  return out;
}

export var FX_URLS = ["https://api.frankfurter.dev/v1/latest?from=USD&to=AUD", "https://api.frankfurter.app/latest?from=USD&to=AUD"];
// { base: "USD", rates: { AUD: 1.53 }, date } → 1.53, or null.
export function parseFrankfurter(json){
  var r = json && json.rates && Number(json.rates.AUD);
  return r > 0 && (!json.base || json.base === "USD") ? r : null;
}

// ---- The app's own price file ----
// latest.json: { updated, prices: { "ASX:VAS": { close, date }, "US:AAPL": {…} } }
// weekly.json: { updated, weekly: { "ASX:VAS": [["2026-10-24", 101.2], …] } }
export function fileKey(asset){ return (asset.market === "US" ? "US" : asset.market === "ASX" || !asset.market ? "ASX" : asset.market) + ":" + sym(asset); }
// The holdings the file covers, as prices for applyPrices: [{ symbol, price, date }], and those it doesn't.
export function filePricesFor(latest, assets){
  var prices = [], missing = [], seen = {};
  holdings(assets).forEach(function(a){
    if(a.market === "Crypto") return;
    var k = fileKey(a), row = latest && latest.prices && latest.prices[k];
    if(seen[k]) return;
    seen[k] = true;
    if(row && Number(row.close) > 0) prices.push({ symbol: sym(a), price: Number(row.close), date: row.date || null });
    else missing.push(sym(a));
  });
  return { prices: prices, missing: missing };
}
// Weekly closes for the holdings the file covers: { SYMBOL: [{ date, close }] } (applyBackfill's shape).
export function fileWeeklyFor(weekly, assets){
  var out = {};
  holdings(assets).forEach(function(a){
    if(a.market === "Crypto") return;
    var rows = weekly && weekly.weekly && weekly.weekly[fileKey(a)];
    if(!Array.isArray(rows) || !rows.length) return;
    out[sym(a)] = rows.filter(function(r){ return r && r[0] && Number(r[1]) > 0; }).map(function(r){ return { date: r[0], close: Number(r[1]) }; });
  });
  return out;
}
// Whether any holding still has weeks before its first recorded value that the file could fill.
export function backfillWanted(assets){
  return holdings(assets).some(function(a){
    if(a.market === "Crypto") return false;
    var first = (a.history || []).reduce(function(m, h){ return !m || h.date < m ? h.date : m; }, null);
    var lot = (a.lots || []).reduce(function(m, l){ return l.date && (!m || l.date < m) ? l.date : m; }, null);
    return !first || (lot && lot < first);
  });
}

export function autoPricesDue(auto, today){ return !!(auto && auto.on !== false && auto.lastRead !== today); }
