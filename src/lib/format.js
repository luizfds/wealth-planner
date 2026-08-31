export var fmtCurrency0 = new Intl.NumberFormat("en-AU", {style:"currency", currency:"AUD", maximumFractionDigits:0});
export var fmtCurrency2 = new Intl.NumberFormat("en-AU", {style:"currency", currency:"AUD", minimumFractionDigits:2, maximumFractionDigits:2});
export var fmtPercent1 = new Intl.NumberFormat("en-AU", {style:"percent", maximumFractionDigits:1});
export var fmtRunway = new Intl.NumberFormat("en-AU", {maximumFractionDigits:1, minimumFractionDigits:1});

// Every other figure in this app is implicitly AUD — the one place that's not true is a Shares
// holding whose market is US or Crypto (see MARKET_CURRENCY in constants.js), where the price
// came from a source quoting USD. en-AU's currency formatting already disambiguates a non-local
// currency on its own ("US$1,234" vs a bare "$1,234" for AUD), so reusing Intl here — rather than
// hand-appending a currency-code string — gets correct, locale-aware formatting for free. Cached
// per currency code since a NumberFormat isn't free to construct.
var currency0Cache = {};
export function fmtCurrency0For(currency){
  currency = currency || "AUD";
  if(!currency0Cache[currency]) currency0Cache[currency] = new Intl.NumberFormat("en-AU", {style:"currency", currency: currency, maximumFractionDigits:0});
  return currency0Cache[currency];
}
var currency2Cache = {};
export function fmtCurrency2For(currency){
  currency = currency || "AUD";
  if(!currency2Cache[currency]) currency2Cache[currency] = new Intl.NumberFormat("en-AU", {style:"currency", currency: currency, minimumFractionDigits:2, maximumFractionDigits:2});
  return currency2Cache[currency];
}
