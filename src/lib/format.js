export var fmtCurrency0 = new Intl.NumberFormat("en-AU", {style:"currency", currency:"AUD", maximumFractionDigits:0});
export var fmtCurrency2 = new Intl.NumberFormat("en-AU", {style:"currency", currency:"AUD", minimumFractionDigits:2, maximumFractionDigits:2});
export var fmtPercent1 = new Intl.NumberFormat("en-AU", {style:"percent", maximumFractionDigits:1});
export var fmtRunway = new Intl.NumberFormat("en-AU", {maximumFractionDigits:1, minimumFractionDigits:1});
// For a *read-only* display of a holding quantity — a whole share count is left exactly as-is
// (maximumFractionDigits never rounds the integer part, only caps decimals, so "50000" still
// renders in full, just with thousands separators), while a fractional quantity — almost always
// crypto, e.g. "0.04318707" — is capped to 4 decimal places so it reads cleanly next to a share
// count instead of dominating the line with 8 digits of precision nobody's scanning for at a
// glance. Never use this for an editable quantity field (Classic table's Qty input, the Modern
// edit panel's) — those must keep the value exactly as stored, decimals and all, or a save would
// silently truncate real precision the visitor typed in.
export var fmtQtyDisplay = new Intl.NumberFormat("en-AU", {maximumFractionDigits:4});

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

// Every "today" (and every "format this computed Date back into a YYYY-MM-DD string") in this
// app used to go through `date.toISOString().slice(0, 10)` — but toISOString() always renders in
// UTC, not the visitor's own local time. For anyone east of UTC — this app's primary Australian
// audience very much included, AEST/AEDT is UTC+10/+11 — that means "today" from local midnight
// until mid-morning actually resolves to *yesterday*'s UTC date: a Log date picker prefilled
// yesterday, "last logged N days ago" and every due/overdue check off by the same day. The date
// *arithmetic* elsewhere in the app (addFreqStep, setDate/setMonth, `new Date(dateStr +
// "T00:00:00")`) already happens in local time via native Date methods and stays untouched by
// this — only the final Date-to-string step was wrong. Reads the Date object's own local getters
// instead, so it always matches the calendar date showing on the visitor's own clock. Takes an
// existing Date (for formatting an already-computed date, e.g. a projected due date) or defaults
// to right now.
export function localDateStr(d){
  d = d || new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}
