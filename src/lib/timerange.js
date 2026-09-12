// One definition of "the last N" for every list and chart in the app.
//
// This started as SHARES_CHANGE_WINDOWS inside components/assets.js, where it answered one
// question: how far back to measure a holding's price change. The same eight windows are what a
// transaction list, an asset history chart and an allocation chart all need, and three
// hand-rolled copies is how two of them end up disagreeing about what "6M" means.
//
// Pure: no DOM, no state writes. `ytd` is the one window that isn't a fixed day count — it starts
// at the household's own year boundary, which is a preference (Accounts → Preferences), so the
// caller passes that window in rather than this module importing state and guessing.
import { localDateStr } from "./format.js";

export var TIME_RANGES = [
  { key: "1d", label: "1D", days: 1 },
  { key: "1w", label: "1W", days: 7 },
  { key: "1m", label: "1M", days: 30 },
  { key: "3m", label: "3M", days: 90 },
  { key: "6m", label: "6M", days: 182 },
  { key: "1y", label: "1Y", days: 365 },
  // Labelled "FYTD" on the financial basis, because a change measured from 1 July is not the same
  // number as one measured from 1 January and a picker must not call them both "YTD".
  { key: "ytd", label: "YTD", ytd: true },
  { key: "all", label: "All", all: true }
];

export function rangeByKey(key){
  return TIME_RANGES.find(function(r){ return r.key === key; }) || null;
}
export function rangeLabel(range, yearBasis){
  if(!range) return "";
  if(range.ytd && yearBasis === "financial") return "FYTD";
  return range.label;
}

// The earliest date a range includes, as "YYYY-MM-DD", or null for "all" — null meaning "no lower
// bound", which callers must treat as *unbounded* rather than as an error or as today.
//
// opts.today lets a test pin the clock; opts.yearStart is the household year's first day, which
// only the ytd window uses.
export function rangeStartDate(range, opts){
  opts = opts || {};
  if(!range || range.all) return null;
  var today = opts.today || localDateStr();
  if(range.ytd) return opts.yearStart || null;
  return shiftDays(today, -range.days);
}
function shiftDays(isoStr, delta){
  var parts = String(isoStr).split("-");
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + delta);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function pad2(n){ return (n < 10 ? "0" : "") + n; }

// Filters any array of dated records to a range. Records with no usable date are dropped rather
// than kept: a row that can't say when it happened cannot honestly be shown under "last 3 months".
export function withinRange(records, range, opts){
  var start = rangeStartDate(range, opts);
  return (records || []).filter(function(r){
    var d = r && r.date;
    if(!d) return false;
    return start === null || d >= start;
  });
}

// The segmented control, as an HTML string. One markup definition so the two places that show it
// can't drift apart visually — the caller supplies the data-attribute name its own click handler
// listens for, since event registration lives in app.js per this project's convention.
export function timeRangeControlHtml(selectedKey, attrName, opts){
  opts = opts || {};
  return '<div class="seg-control time-range-control"' + (opts.id ? ' id="' + opts.id + '"' : "") +
    ' role="group" aria-label="' + (opts.ariaLabel || "Time range") + '">' +
    TIME_RANGES.filter(function(r){ return !opts.omit || opts.omit.indexOf(r.key) === -1; }).map(function(r){
      var label = rangeLabel(r, opts.yearBasis);
      var on = selectedKey === r.key;
      return '<button type="button" class="seg-option' + (on ? " active" : "") + '"' +
        ' aria-pressed="' + on + '" data-' + attrName + '="' + r.key + '"' +
        ' title="' + (opts.titlePrefix || "Show") + " " + label + '">' + label + '</button>';
    }).join("") + '</div>';
}
