// ---------------- A PDF bank or card statement into rows (v3.92.0) ----------------
//
// Banks give a CSV for recent transactions and a PDF for everything else — a statement from last
// year, a closed account, a card. lib/pdftext.js turns the PDF into lines of positioned text; this
// turns those lines into transactions, then into the same CSV the bank import already reads, so a
// PDF goes through the same review, rules, transfers and duplicate checks as any export.
//
// What statements share, and what this leans on:
//   - a header line naming the columns: Date, Description/Transaction/Details, and Debit/Withdrawal,
//     Credit/Deposit, Amount, Balance. Amounts are right-aligned under their header, so an amount
//     belongs to the column whose header's right edge is nearest its own.
//   - each transaction starts with a date at the left: "01 Oct 2026", "13 Jul", "Oct 1", "03/02/2026".
//     Lines below it without a date are the rest of its description (some banks put the amounts
//     there too). Dates without a year take it from a month heading ("Oct 2025") or the statement's
//     own dates, choosing the year that keeps the order the statement runs in.
//   - opening, closing and carried-forward balance lines aren't transactions.
// Pure: lines in, rows out.

var MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function pad(n){ return String(n).padStart(2, "0"); }
function monIdx(s){ return MON.indexOf(String(s || "").slice(0, 3).toLowerCase()); }

// A date at the start of a text: { day, month (1-12), year|null, rest } or null.
var DATE_RES = [
  { re: /^(\d{1,2})[\s-]([A-Za-z]{3,9})\.?[\s-](\d{4}|\d{2})\b\s*(.*)$/, f: function(m){ return { day: +m[1], month: monIdx(m[2]) + 1, year: m[3].length === 2 ? 2000 + +m[3] : +m[3], rest: m[4] }; } },
  { re: /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b\s*(.*)$/, f: function(m){ return { day: +m[1], month: +m[2], year: m[3].length === 2 ? 2000 + +m[3] : +m[3], rest: m[4] }; } },
  { re: /^(\d{4})-(\d{2})-(\d{2})\b\s*(.*)$/, f: function(m){ return { day: +m[3], month: +m[2], year: +m[1], rest: m[4] }; } },
  { re: /^(\d{1,2})\s([A-Za-z]{3,9})\.?(?=\s|$)\s*(.*)$/, f: function(m){ return { day: +m[1], month: monIdx(m[2]) + 1, year: null, rest: m[3] }; } },
  { re: /^([A-Za-z]{3,9})\.?\s(\d{1,2})(?=\s|$)\s*(.*)$/, f: function(m){ return { day: +m[2], month: monIdx(m[1]) + 1, year: null, rest: m[3] }; } }
];
export function leadingDate(text){
  var s = String(text || "").trim();
  for(var i = 0; i < DATE_RES.length; i++){
    var m = DATE_RES[i].re.exec(s);
    if(!m) continue;
    var d = DATE_RES[i].f(m);
    if(d.month >= 1 && d.month <= 12 && d.day >= 1 && d.day <= 31) return d;
  }
  return null;
}

var MONEY = /^\(?([+-]?)\$?([+-]?)\s?([\d,]+\.\d{2})\)?\s*(CR|DR|Cr|Dr|cr|dr)?\s*(-?)$/;
export function moneyOf(text){
  var m = MONEY.exec(String(text || "").trim());
  if(!m) return null;
  var v = parseFloat(m[3].replace(/,/g, ""));
  var neg = m[1] === "-" || m[2] === "-" || m[5] === "-" || /^\(/.test(String(text).trim());
  return { value: v, neg: neg, cr: /^cr$/i.test(m[4] || ""), dr: /^dr$/i.test(m[4] || "") };
}

var ROLE_WORDS = {
  date: /^(date|transaction date|trans\.? date|posting date|processed)$/,
  desc: /^(description|transaction|transaction details|details|particulars|narrative|transaction description)$/,
  debit: /^(debit|debits|withdrawal|withdrawals|withdrawal\(\$\)|debit\(\$\)|money out|paid out|debits \(\$\))$/,
  credit: /^(credit|credits|deposit|deposits|deposit\(\$\)|credit\(\$\)|money in|paid in|credits \(\$\))$/,
  amount: /^(amount|amount\(\$\)|transaction amount|value)$/,
  balance: /^(balance|balance\(\$\)|running balance)$/
};
function roleOf(s){
  var k = String(s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\s*\(\$\)$/, "");
  var keys = Object.keys(ROLE_WORDS);
  for(var i = 0; i < keys.length; i++) if(ROLE_WORDS[keys[i]].test(k)) return keys[i];
  return null;
}
function headerOf(line){
  var cols = {};
  line.cells.forEach(function(c){ var r = roleOf(c.s); if(r && !cols[r]) cols[r] = { x: c.x, x2: c.x2 }; });
  var money = ["debit", "credit", "amount", "balance"].filter(function(r){ return cols[r]; }).length;
  return cols.date && money >= 1 && (money >= 2 || cols.desc) ? cols : null;
}

var SKIP_DESC = /\b(opening balance|closing balance|brought forward|carried forward|balance (b\/f|c\/f|brought|carried)|total (debits|credits))\b/i;
var NOISE = /^(page \d+( of \d+)?\)?|copyright|abn \d|continued|statement \d+|\(?page \d)/i;

// lines: [{page, y, cells:[{x, x2, s}]}] → { rows: [{date, description, debit, credit, balance}], columns, skipped }
export function statementFromLines(lines){
  var cols = null, monthCtx = null, blocks = [], cur = null;
  // Every full date in the document, to place dates printed without a year.
  var fullDates = [];
  (lines || []).forEach(function(l){
    l.cells.forEach(function(c){
      var re = /\b(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{4})\b|\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, m;
      while((m = re.exec(c.s))){
        var mo = m[2] ? monIdx(m[2]) + 1 : +m[5], y = m[3] ? +m[3] : +m[6], d = m[1] ? +m[1] : +m[4];
        if(mo >= 1 && mo <= 12 && y > 1990 && y < 2100) fullDates.push(y + "-" + pad(mo) + "-" + pad(d));
      }
    });
  });
  fullDates.sort();
  var minD = fullDates[0] || null, maxD = fullDates[fullDates.length - 1] || null;

  function close(){ if(cur){ blocks.push(cur); cur = null; } }
  (lines || []).forEach(function(l){
    var h = headerOf(l);
    if(h){ close(); cols = h; return; }
    var text = l.cells.map(function(c){ return c.s; }).join(" ");
    // A month heading ("Oct 2025") sets the year for the dates under it.
    var mh = /^([A-Za-z]{3,9})\s(\d{4})$/.exec(text.trim());
    if(mh && monIdx(mh[1]) !== -1){ close(); monthCtx = { year: +mh[2], month: monIdx(mh[1]) + 1 }; return; }
    // A margin note printed flush against the date gets joined to it; start the line again from
    // the run that sits in the date column.
    if(cols && l.cells[0] && l.cells[0].x < cols.date.x - 6 && l.raw){
      var at = l.raw.find(function(r){ return Math.abs(r.x - cols.date.x) <= 18 && leadingDate(r.s); });
      if(at) l = { page: l.page, y: l.y, cells: [at].concat(l.cells.filter(function(c){ return c.x > at.x2 + 0.5; })), raw: l.raw };
    }
    var first = l.cells[0];
    var lead = first ? leadingDate(first.s) : null;
    // The date has to sit in the date column (when there is one), not be a date mentioned mid-line.
    var atLeft = lead && (!cols || Math.abs(first.x - cols.date.x) <= 18);
    if(atLeft){
      close();
      var cells = l.cells.slice();
      cells[0] = { x: first.x, x2: first.x2, s: lead.rest };
      cur = { page: l.page, y: l.y, date: lead, cells: cells.filter(function(c){ return c.s; }), extra: 0, monthCtx: monthCtx };
      return;
    }
    if(!cur) return;
    // Printed in the margin (a barcode line, a mailing code): not part of anything.
    if(cols && l.cells[0].x < cols.date.x - 6) return;
    if(l.page !== cur.page || NOISE.test(text.trim()) || cur.y - l.y > 26 || cur.extra >= 3){ close(); return; }
    cur.cells = cur.cells.concat(l.cells);
    cur.y = l.y; cur.extra++;
  });
  close();

  var rows = [], skipped = 0, prev = null;
  blocks.forEach(function(b){
    var amounts = [], words = [];
    for(var i = 0; i < b.cells.length; i++){
      var c = b.cells[i];
      var mv = moneyOf(c.s);
      if(mv){
        var nxt = b.cells[i + 1];
        if(nxt && /^(CR|DR)$/i.test(nxt.s) && nxt.x - c.x2 < 14){ mv.cr = /^cr$/i.test(nxt.s); mv.dr = /^dr$/i.test(nxt.s); i++; }
        amounts.push({ x: c.x, x2: c.x2, m: mv });
      } else if(!/^(CR|DR|\$)$/i.test(c.s)) words.push(c.s);
    }
    var description = words.join(" ").replace(/\s+/g, " ").trim();
    if(!amounts.length || SKIP_DESC.test(description)){ skipped++; return; }
    var role = {};
    amounts.forEach(function(a, k){
      var r;
      if(cols){
        var best = null;
        ["debit", "credit", "amount", "balance"].forEach(function(name){
          if(!cols[name]) return;
          var d = Math.abs(a.x2 - cols[name].x2);
          if(!best || d < best.d) best = { name: name, d: d };
        });
        r = best.name;
      } else r = amounts.length > 1 && k === amounts.length - 1 ? "balance" : "amount";
      if(!role[r]) role[r] = a;
    });
    var debit = 0, credit = 0, a;
    if((a = role.debit)) debit = a.m.value;
    if((a = role.credit)) credit = a.m.value;
    if(!role.debit && !role.credit && (a = role.amount)){
      if(a.m.cr || (!a.m.neg && !a.m.dr && cols && cols.amount && !cols.debit)) credit = a.m.value;
      else debit = a.m.value;
      // A signed Amount column: minus is money out, unsigned money in.
      if(!a.m.cr && !a.m.dr){ if(a.m.neg){ debit = a.m.value; credit = 0; } else { credit = a.m.value; debit = 0; } }
    }
    // A Debit/Withdrawal column that prints its amounts with a minus, or a credit column with
    // a "-" for a reversal: the column decides, the sign only flips a reversal.
    if(role.debit && role.debit.m.cr){ credit = debit; debit = 0; }
    if(!debit && !credit){ skipped++; return; }
    var bal = role.balance ? (role.balance.m.neg || role.balance.m.dr ? -role.balance.m.value : role.balance.m.value) : null;
    var date = placeYear(b.date, b.monthCtx, prev, minD, maxD);
    rows.push({ date: date, description: description, debit: debit, credit: credit, balance: bal });
    prev = date;
  });
  return { rows: rows, columns: cols, skipped: skipped };
}

// The year for a date printed without one: the one in the statement's range, nearest the date
// before it (statements run in order, oldest or newest first).
function placeYear(d, ctx, prev, minD, maxD){
  if(d.year) return d.year + "-" + pad(d.month) + "-" + pad(d.day);
  // Under a month heading ("Oct 2025"), a date in that month takes its year.
  if(ctx && ctx.month === d.month) return ctx.year + "-" + pad(d.month) + "-" + pad(d.day);
  var years = [];
  var y0 = minD ? +minD.slice(0, 4) : (prev ? +prev.slice(0, 4) : new Date().getFullYear());
  var y1 = maxD ? +maxD.slice(0, 4) : y0;
  for(var y = y0 - 1; y <= y1 + 1; y++) years.push(y);
  var cands = years.map(function(y){ return y + "-" + pad(d.month) + "-" + pad(d.day); });
  var inRange = cands.filter(function(c){ return (!minD || c >= shift(minD, -35)) && (!maxD || c <= shift(maxD, 35)); });
  var pool = inRange.length ? inRange : cands;
  if(prev){
    pool.sort(function(a, b){ return Math.abs(Date.parse(a) - Date.parse(prev)) - Math.abs(Date.parse(b) - Date.parse(prev)); });
    return pool[0];
  }
  return pool[0];
}
function shift(iso, days){ var t = new Date(Date.parse(iso) + days * 86400000); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()); }

// The bank import's own CSV shape: what statementFromLines found, ready for parseBankCsv.
export function statementCsv(rows){
  function q(s){ s = String(s == null ? "" : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  return "Date,Description,Debit,Credit,Balance\n" + rows.map(function(r){
    return [r.date, q(r.description), r.debit ? r.debit.toFixed(2) : "", r.credit ? r.credit.toFixed(2) : "", r.balance == null ? "" : r.balance.toFixed(2)].join(",");
  }).join("\n") + "\n";
}

// ---------------- A property manager's statement (v3.92.0) ----------------
//
// The statement's own Money In / Money Out columns, read into the fields of Property → Log a
// property manager statement: rent collected, water usage recovered from the tenant, the manager's
// fees, water rates and anything else paid out of the rent. The payment to you and running totals
// aren't amounts to log. The form is filled, not submitted — the person checks it and logs it.
var PM_SKIP = /\b(total|balance|brought forward|carried forward|withdrawal by eft|eft transfer|paid to owner|disbursement to owner|you received|money in|money out|gst|tax on agency)\b/i;
export function agentStatementFromLines(lines){
  var inCol = null, outCol = null, date = null, received = null;
  var out = { rent: 0, water: 0, fees: 0, waterRates: 0, others: [] };
  (lines || []).forEach(function(l){
    var text = l.cells.map(function(c){ return c.s; }).join(" ");
    l.cells.forEach(function(c){
      if(/^money in$/i.test(c.s)) inCol = c;
      if(/^money out$/i.test(c.s)) outCol = c;
      if(!date){ var d = leadingDate(c.s); if(d && d.year && /^\d{1,2}[\s/-]\w+[\s/-]\d{2,4}$/.test(c.s.trim())) date = d.year + "-" + pad(d.month) + "-" + pad(d.day); }
    });
    if(/you received/i.test(text)){ var mr = l.cells.map(function(c){ return moneyOf(c.s); }).filter(Boolean).pop(); if(mr) received = mr.value; }
    var amounts = l.cells.map(function(c){ return { c: c, m: moneyOf(c.s) }; }).filter(function(x){ return x.m; });
    if(!amounts.length || !inCol || !outCol) return;
    var label = l.cells.filter(function(c){ return !moneyOf(c.s); }).map(function(c){ return c.s; }).join(" ").trim();
    if(!label || PM_SKIP.test(label)) return;
    var a = amounts[amounts.length - 1];
    var isIn = Math.abs(a.c.x2 - inCol.x2) < Math.abs(a.c.x2 - outCol.x2);
    var v = a.m.value;
    if(isIn){
      if(/\bwater\b/i.test(label)) out.water += v;
      else if(/\brent\b/i.test(label)) out.rent += v;
    } else {
      if(/(management|letting|statement|admin|lease (renewal|preparation)|advertising|inspection) fee|commission/i.test(label)) out.fees += v;
      else if(/\bwater\b/i.test(label)) out.waterRates += v;
      else out.others.push({ what: label.replace(/\s*\*$/, ""), amount: v });
    }
  });
  function r2(n){ return Math.round(n * 100) / 100; }
  return { date: date, rent: r2(out.rent), water: r2(out.water), fees: r2(out.fees), waterRates: r2(out.waterRates),
    others: out.others.map(function(o){ return { what: o.what, amount: r2(o.amount) }; }), received: received };
}
