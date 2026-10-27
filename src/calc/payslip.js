// ---------------- A payslip, read (v3.116.0) ----------------
//
// The withholding check (calc/withholding.js) needs three figures off the latest payslip, and the
// plan's salary is only as right as the last time someone typed it. A payslip states both — this
// reads them from its text (a PDF's lines, or text pasted from one).
//
// Payslips differ by payroll system but share a vocabulary: Gross, Tax / PAYG, Net, Super, Salary
// sacrifice, and a "This pay" and a "YTD" column. Each line is matched by its label; of the amounts
// on it, the first is this pay and the last, when there are two or more, year to date. Dates come
// from "period ending" / "pay date" / "period: x to y" wording. Anything not found is left null
// rather than guessed. Pure.

var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
function pad(n){ return String(n).padStart(2, "0"); }
function iso(y, m, d){ y = Number(y); if(y < 100) y += 2000; return y + "-" + pad(m) + "-" + pad(d); }

// Every date on a line, as YYYY-MM-DD: 31/10/2026, 31-10-26, 31 Oct 2026, 2026-10-31.
export function datesIn(text){
  var out = [], s = String(text || ""), m;
  var re = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})|(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/g;
  while((m = re.exec(s))){
    if(m[1]) out.push(iso(m[1], m[2], m[3]));
    else if(m[4]){ if(Number(m[5]) <= 12) out.push(iso(m[6], m[5], m[4])); }
    else { var mo = MONTHS[m[8].slice(0, 4).toLowerCase()] || MONTHS[m[8].slice(0, 3).toLowerCase()]; if(mo) out.push(iso(m[9], mo, m[7])); }
  }
  return out;
}
// The amounts on a line — "4,500.00", "$1,234.56", "(120.00)" negative — leaving out anything that
// sits inside a date and bare small integers like hours or rates of "38".
export function amountsIn(text){
  var s = String(text || "").replace(/(\d{4})-(\d{2})-(\d{2})|\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/g, " ");
  var out = [], m, re = /(\()?-?\$?\s?(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})\)?/g;
  while((m = re.exec(s))){ var v = Number(m[2].replace(/,/g, "") + "." + m[3]); out.push(m[1] ? -v : v); }
  return out;
}

var LABELS = [
  // a tie on position goes to the earlier entry here
  { key: "sacrifice", re: /\b(salary sacrifice|sal(ary)? sac|pre[- ]?tax super|super sacrifice)\b/i },
  { key: "net", re: /\b(net pay|net income|net amount|net earnings|take[- ]home|amount (paid|deposited)|net)\b/i },
  { key: "tax", re: /\b(payg( withholding| tax)?|tax withheld|income tax|withholding tax|^tax\b|\btax\b)/i },
  { key: "super", re: /\b(superannuation|super guarantee|employer super|sgc|super)\b/i },
  { key: "gross", re: /\b(gross( pay| earnings| income| wages)?|total earnings|total gross)\b/i }
];

// lines: strings. Returns { periodStart, periodEnd, payDate, gross, tax, net, super, sacrifice,
// ytd: { gross, tax, super }, found: [keys] }.
export function parsePayslip(lines){
  var r = { periodStart: null, periodEnd: null, payDate: null, gross: null, tax: null, net: null, super: null, sacrifice: null, ytd: { gross: null, tax: null, super: null }, found: [] };
  (lines || []).forEach(function(line){
    var text = String(line || "").trim();
    if(!text) return;
    var low = text.toLowerCase();
    var ds = datesIn(text);
    if(ds.length){
      // Each label takes the dates that follow it, so "Period: x to y   Pay date: z" on one line reads all three.
      var after = function(re){ var m = re.exec(low); return m ? datesIn(text.slice(m.index)) : []; };
      var pd = after(/pay date|payment date|paid on|date paid/);
      if(pd.length && !r.payDate) r.payDate = pd[0];
      var per = after(/pay period|period from|period:|period\b(?! end)/);
      var end = after(/period end(ing)?|end date|week ending/);
      if(per.length >= 2 && !r.periodEnd){ r.periodStart = per[0]; r.periodEnd = per[1]; }
      else if(end.length && !r.periodEnd) r.periodEnd = end[0];
    }
    // The label that comes first on the line: "Gross (before tax)" is gross, not tax.
    var lab = null, at = Infinity;
    LABELS.forEach(function(l){ var m = l.re.exec(text); if(m && m.index < at){ at = m.index; lab = l; } });
    if(!lab) return;
    var amounts = amountsIn(text).map(Math.abs);
    if(!amounts.length) return;
    if(r[lab.key] != null) return; // the first line with a label wins — summary lines come before detail
    r[lab.key] = amounts[0];
    if(amounts.length >= 2 && r.ytd.hasOwnProperty(lab.key)) r.ytd[lab.key] = amounts[amounts.length - 1];
    r.found.push(lab.key);
  });
  if(!r.periodEnd && r.payDate) r.periodEnd = r.payDate;
  return r;
}

// How often this pays, from the period's length; null without both ends.
export function payFrequency(p){
  if(!p || !p.periodStart || !p.periodEnd) return null;
  var days = Math.round((Date.parse(p.periodEnd) - Date.parse(p.periodStart)) / 86400000) + 1;
  if(days >= 5 && days <= 8) return "Weekly";
  if(days >= 12 && days <= 16) return "Fortnightly";
  if(days >= 27 && days <= 32) return "Monthly";
  return null;
}
