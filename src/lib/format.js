export var fmtCurrency0 = new Intl.NumberFormat("en-AU", {style:"currency", currency:"AUD", maximumFractionDigits:0});
// v3.160.0 (item 190): a figure read at a glance — $9,457 · $45.2k · $673.8k · $1.89M · $12.5M. Whole dollars
// under $10,000; trailing zeros dropped ($2M, not $2.00M); a minus sign, not a hyphen. One rule for every card,
// axis and chart in the app, where there used to be four. Ledgers, tax and tooltips keep the exact figure.
export function fmtCompact(v){
  v = Number(v) || 0;
  var a = Math.abs(v), sign = v < 0 ? "\u2212" : "";
  var trim = function(x){ return x.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1"); };
  if(a >= 999950) return sign + "$" + trim((a / 1e6).toFixed(a >= 9995000 ? 1 : 2)) + "M";
  if(a >= 9999.5) return sign + "$" + trim((a / 1e3).toFixed(1)) + "k";
  return sign + fmtCurrency0.format(a);
}
export var fmtCurrency2 = new Intl.NumberFormat("en-AU", {style:"currency", currency:"AUD", minimumFractionDigits:2, maximumFractionDigits:2});
export var fmtPercent1 = new Intl.NumberFormat("en-AU", {style:"percent", maximumFractionDigits:1});
// Whole percent, for a figure whose precision would be false. A month-on-month spending delta is
// computed from a partial month scaled up to a whole one — "38%" is an honest read of that, "38.4%"
// implies a decimal place the underlying number doesn't have.
export var fmtPercent0 = new Intl.NumberFormat("en-AU", {style:"percent", maximumFractionDigits:0});
export var fmtRunway = new Intl.NumberFormat("en-AU", {maximumFractionDigits:1, minimumFractionDigits:1});
// For a *read-only* display of a holding quantity — a whole share count is left exactly as-is
// (maximumFractionDigits never rounds the integer part, only caps decimals, so "50000" still
// renders in full, just with thousands separators), while a fractional quantity — almost always
// crypto, e.g. "0.04318707" — is capped to 4 decimal places so it reads cleanly next to a share
// count instead of dominating the line with 8 digits of precision nobody's scanning for at a
// glance. Never use this for an editable quantity field (the Modern edit panel's Qty input) —
// it must keep the value exactly as stored, decimals and all, or a save would silently truncate
// real precision the visitor typed in.
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

// One way to show a date (v3.105.0): "26 Oct", with the year when it isn't this one ("26 Oct 2025"),
// or always with opts.year. Anything that isn't a YYYY-MM-DD date comes back as it was.
var SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso, opts){
  if(typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso == null ? "" : String(iso);
  var y = iso.slice(0, 4);
  var withYear = (opts && opts.year) || y !== localDateStr().slice(0, 4);
  return Number(iso.slice(8, 10)) + " " + SHORT_MONTHS[Number(iso.slice(5, 7)) - 1] + (withYear ? " " + y : "");
}

// Everything a pasted amount can arrive as.
//
// `<input type="number">` reads back an *empty string* for anything that isn't a bare number
// literal — a trailing space, a leading "$", a thousands comma, or the Unicode minus (U+2212)
// that a copy out of a bank app or a phone keyboard produces instead of ASCII "-". There is no
// error and no `badInput` flag to check: the field looks right on screen and `.value` is "", so
// `parseFloat(value) || 0` quietly stores zero. That is what makes a pasted refund "not save".
//
// Normalising the clipboard text before it ever reaches the field is the only place this can be
// caught, so this is the parser the paste handler uses. Returns null (not 0) when there is no
// number in there at all — the caller needs to tell "they pasted rubbish, leave it alone" apart
// from "they pasted a legitimate zero".
export function parseAmountInput(raw){
  var s = String(raw == null ? "" : raw).trim();
  if(!s) return null;
  // Accounting notation: (24.99) is how a spreadsheet and many statements write a credit.
  var bracketed = /^\((.*)\)$/.exec(s);
  if(bracketed){ s = "-" + bracketed[1]; }
  s = s
    .replace(/[−‒–—―]/g, "-")   // every dash that isn't ASCII "-"
    .replace(/[\s ]/g, "")                          // spaces, including the non-breaking kind
    .replace(/[$€£¥]/g, "")               // the currency symbols a copy tends to bring along
    .replace(/,/g, "")                                   // thousands separators
    .replace(/^\+/, "");
  if(!/^-?\d*\.?\d+$/.test(s)) return null;
  var n = parseFloat(s);
  return isFinite(n) ? n : null;
}
