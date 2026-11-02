import { state } from "../state.js";
import { ipProperties, fyWindow, fyLabel } from "./property.js";
import { rentalSchedule } from "./taxyear.js";
import { rentalLogged, loansInterest, actualFyFor } from "./propertyactuals.js";
import { claimItems } from "./claims.js";
import { localDateStr, fmtDate } from "../lib/format.js";

// ---------------- A tax pack per property (item 246) ----------------
//
// Each investment property's rental schedule for a financial year, line by line, the way an accountant wants it: the
// figure that goes in the return (Tax → Returns' — a typed figure, else the plan's or the worked-out one), where it came
// from, and beside it what's logged for the line (propertyLedger, through rentalLogged): how much, how many entries and
// up to when. Its totals are the schedule's own. The year is the one the Tax tab shows: the header's period when that's
// over, else the one holding today.

function r2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
var WORKED_OUT = { capitalWorks: true, capitalAllowances: true, borrowing: true };

export function taxPackReport(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var fy = actualFyFor(opts.yearWin && opts.yearWin.end, today), win = fyWindow(fy);
  var end = today < win.end ? today : win.end;
  var items = claimItems();
  var rows = [];
  var props = ipProperties();
  props.forEach(function(p){
    var sch = rentalSchedule(p, fy), lg = rentalLogged(p, fy, today, state, items);
    var li = today < win.start ? null : loansInterest(p, win.start, end);
    rows.push({ cls: "head", cells: { line: p.what || "Property" } });
    sch.lines.forEach(function(l){
      var logged = lg.has[l.key] ? lg.lines[l.key] : null;
      if(!l.value && logged == null) return;
      var source = l.actual != null ? "Typed in"
        : l.key === "interest" ? (li && li.charged ? (li.modelled >= 0.005 ? "Bank's charges to " + fmtDate(li.to) + ", the rest worked out" : "Bank's charges") : "Worked out from the loans")
        : WORKED_OUT[l.key] ? "Worked out"
        : "The plan's yearly amount";
      rows.push({ cells: { line: l.label, value: r2(l.income ? l.value : -l.value), source: source, logged: logged == null ? null : r2(l.income ? logged : -logged),
        entries: lg.byLine && lg.byLine[l.key] ? String(lg.byLine[l.key]) : "", upto: lg.last && lg.last[l.key] ? fmtDate(lg.last[l.key]) : "" } });
    });
    rows.push({ cls: "total", cells: { line: (sch.net < 0 ? "Net rental loss" : "Net rental income") + " — " + (p.what || "Property"), value: sch.net, source: sch.actualCount + " of " + sch.lines.length + " lines typed in" } });
  });
  return {
    key: "taxpack", title: "Rental tax pack", subtitle: fyLabel(fy) + (end < win.end ? " · logged to " + fmtDate(end) : ""),
    columns: [{ key: "line", label: "" }, { key: "value", label: "In the return", num: true }, { key: "source", label: "From" },
      { key: "logged", label: "Logged", num: true }, { key: "entries", label: "Entries" }, { key: "upto", label: "Latest" }],
    rows: props.length ? rows : [],
    note: "Each line is what Tax → Returns puts in the return: a figure typed in from the agent's annual summary, the loan statement or a bill, " +
      "else the plan's or the worked-out one. Logged is what's recorded against the line this year (statements, rent received, payments, the bank's " +
      "interest charges) — Tax → Returns' \"Use logged figures\" makes those the return's. Whole-property amounts, before each owner's share."
  };
}
