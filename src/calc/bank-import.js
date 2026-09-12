// Turning a bank's CSV export into this app's transactions.
//
// No DOM, no state writes — parseBankCsv() is pure and returns what it found, including what it
// couldn't read and why. The caller previews that and decides what to commit, same shape as
// components/expenses.js's parseExpensesImportCsv flow.
//
// The problem this solves is that a bank export is not a document format. Every Australian bank
// exports something different, several of them export no header row at all, and the one thing they
// all agree on — DD/MM/YYYY — is the one thing a naive parser gets backwards. What follows is
// written against the real shapes, not an idealised one.
import { localDateStr } from "../lib/format.js";

// ---------------- Dates ----------------
// Australian bank exports are DD/MM/YYYY. This is not a preference to be inferred politely: read
// 03/04/2026 as 3 March and a third of the year's spending lands in the wrong month, every figure
// on the Spending tab moves, and nothing about the result looks wrong enough to notice.
//
// So DD/MM is the default and the only thing that overrides it is proof: a file containing any
// date whose first number is above 12 can only be DD/MM, and one whose *second* number is above 12
// can only be MM/DD. detectDateOrder() looks for that proof across the whole file rather than
// guessing per row, because a single file is written by a single bank in a single order.
export function detectDateOrder(rawDates){
  var dayFirstProof = 0, monthFirstProof = 0;
  (rawDates || []).forEach(function(raw){
    var m = /^\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})\s*$/.exec(raw || "");
    if(!m) return;
    var a = Number(m[1]), b = Number(m[2]);
    if(a > 12 && b <= 12) dayFirstProof++;
    else if(b > 12 && a <= 12) monthFirstProof++;
  });
  // Proof both ways means the file disagrees with itself — trust the local convention rather than
  // whichever happened to be counted more often.
  if(monthFirstProof > 0 && dayFirstProof === 0) return "MDY";
  return "DMY";
}

// -> "YYYY-MM-DD", or null if this isn't a date at all. Accepts the three separators banks use,
// ISO (which needs no ordering decision), and the "15 Mar 2026" / "15/03/26" variants that turn up
// in exports from older systems. A 2-digit year is read as 20xx: a bank statement is not a place
// where 1926 is a plausible reading.
var MONTH_NAMES_SHORT = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function parseBankDate(raw, order){
  var s = (raw || "").trim();
  if(!s) return null;
  var iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if(iso) return isoFrom(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  // "15 Mar 2026", "15-Mar-26", "Mar 15 2026"
  var named = /^(\d{1,2})\s*[\-\s\/]\s*([A-Za-z]{3,})\s*[\-\s\/]\s*(\d{2,4})$/.exec(s);
  if(named){
    var mi = MONTH_NAMES_SHORT.indexOf(named[2].slice(0, 3).toLowerCase());
    if(mi === -1) return null;
    return isoFrom(fullYear(Number(named[3])), mi + 1, Number(named[1]));
  }
  var namedFirst = /^([A-Za-z]{3,})\s*[\-\s\/]\s*(\d{1,2})\s*[\-\s,\/]+\s*(\d{2,4})$/.exec(s);
  if(namedFirst){
    var mi2 = MONTH_NAMES_SHORT.indexOf(namedFirst[1].slice(0, 3).toLowerCase());
    if(mi2 === -1) return null;
    return isoFrom(fullYear(Number(namedFirst[3])), mi2 + 1, Number(namedFirst[2]));
  }
  var m = /^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})$/.exec(s);
  if(!m) return null;
  var first = Number(m[1]), second = Number(m[2]), year = fullYear(Number(m[3]));
  var day = order === "MDY" ? second : first;
  var month = order === "MDY" ? first : second;
  return isoFrom(year, month, day);
}
function fullYear(y){ return y < 100 ? 2000 + y : y; }
function isoFrom(year, month, day){
  if(!(month >= 1 && month <= 12)) return null;
  if(!(day >= 1 && day <= 31)) return null;
  // Rejects 31 February rather than letting Date roll it forward to 3 March — a rolled-over date
  // is a wrong date that looks right.
  var d = new Date(year, month - 1, day);
  if(d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return year + "-" + pad2(month) + "-" + pad2(day);
}
function pad2(n){ return (n < 10 ? "0" : "") + n; }
function addDays(isoStr, days){
  var parts = isoStr.split("-");
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

// ---------------- Amounts ----------------
// Bank exports wrap negatives in parentheses as often as they use a minus sign, and thousands
// separators are routine. "$1,234.56" and "(1,234.56)" and "-1234.56" all have to land.
export function parseBankAmount(raw){
  var s = (raw || "").trim();
  if(!s) return null;
  var negative = /^\(.*\)$/.test(s) || /-/.test(s);
  var digits = s.replace(/[^0-9.]/g, "");
  if(!digits || !/\d/.test(digits)) return null;
  var n = parseFloat(digits);
  if(isNaN(n)) return null;
  return negative ? -Math.abs(n) : Math.abs(n);
}

// ---------------- Column detection ----------------
// Header aliases, longest-intent-first. `description` deliberately lists the narrative/particulars
// wording several banks use in place of anything containing the word "description".
var HEADER_ALIASES = {
  date: ["date", "transaction date", "date processed", "processed date", "posting date", "value date", "effective date"],
  description: ["description", "transaction details", "details", "narrative", "particulars", "merchant", "payee", "reference", "memo", "transaction description"],
  amount: ["amount", "transaction amount", "value"],
  debit: ["debit", "debit amount", "withdrawal", "withdrawals", "money out", "paid out"],
  credit: ["credit", "credit amount", "deposit", "deposits", "money in", "paid in"],
  balance: ["balance", "running balance", "account balance"]
};
function headerRoleOf(cell){
  var key = (cell || "").trim().toLowerCase().replace(/\s+/g, " ");
  if(!key) return null;
  var roles = Object.keys(HEADER_ALIASES);
  for(var i = 0; i < roles.length; i++){
    if(HEADER_ALIASES[roles[i]].indexOf(key) !== -1) return roles[i];
  }
  return null;
}
// True when a row looks like column names rather than data. A headerless export (CommBank's is the
// common one) starts straight in on "02/09/2026,-45.20,WOOLWORTHS...", so treating row 0 as a
// header there would silently eat a transaction.
export function looksLikeHeaderRow(cells){
  if(!cells || !cells.length) return false;
  var named = cells.filter(function(c){ return headerRoleOf(c) !== null; }).length;
  if(named >= 2) return true;
  // Two roles is the usual tell, but a one-column-named file is still a header if nothing in the
  // row parses as a date or an amount — real data rows always carry at least one of those.
  var dataish = cells.filter(function(c){
    return parseBankDate(c, "DMY") !== null || (parseBankAmount(c) !== null && /\d/.test(c || ""));
  }).length;
  return named >= 1 && dataish === 0;
}

// Works out which column is which, from a header row where there is one and from the data itself
// where there isn't. Returns {date, description, amount, debit, credit} as column indexes (any of
// them undefined when absent) plus `hadHeader`.
export function detectColumns(rows){
  if(!rows.length) return { hadHeader: false };
  var hadHeader = looksLikeHeaderRow(rows[0]);
  var colOf = { hadHeader: hadHeader };
  if(hadHeader){
    rows[0].forEach(function(cell, i){
      var role = headerRoleOf(cell);
      if(role && colOf[role] === undefined) colOf[role] = i;
    });
    // A header naming a Balance column but no Amount/Debit/Credit is still unusable, so fall
    // through to sniffing rather than returning a half-detected map.
    if(colOf.date !== undefined && (colOf.amount !== undefined || colOf.debit !== undefined || colOf.credit !== undefined)) return colOf;
  }
  var data = rows.slice(hadHeader ? 1 : 0);
  if(!data.length) return colOf;
  var width = data.reduce(function(w, r){ return Math.max(w, r.length); }, 0);
  var scored = [];
  for(var c = 0; c < width; c++){
    var dates = 0, amounts = 0, texts = 0, longest = 0;
    data.forEach(function(r){
      var cell = (r[c] || "").trim();
      if(!cell) return;
      if(parseBankDate(cell, "DMY") !== null){ dates++; return; }
      if(/^[\(\-\+\$\s]*[\d,]+\.?\d*\s*\)?$/.test(cell) && /\d/.test(cell)){ amounts++; return; }
      texts++;
      longest = Math.max(longest, cell.length);
    });
    scored.push({ c: c, dates: dates, amounts: amounts, texts: texts, longest: longest });
  }
  if(colOf.date === undefined){
    var dateCol = scored.slice().sort(function(a, b){ return b.dates - a.dates; })[0];
    if(dateCol && dateCol.dates > 0) colOf.date = dateCol.c;
  }
  if(colOf.description === undefined){
    // The longest free text, not merely the most: a bank export usually carries several short text
    // columns (transaction type, account number) alongside the one that names the merchant.
    var descCol = scored.filter(function(s){ return s.c !== colOf.date; })
      .sort(function(a, b){ return (b.texts * 1000 + b.longest) - (a.texts * 1000 + a.longest); })[0];
    if(descCol && descCol.texts > 0) colOf.description = descCol.c;
  }
  if(colOf.amount === undefined && colOf.debit === undefined && colOf.credit === undefined){
    // The balance column is numeric in every row too, so "most numeric" alone would often pick it.
    // A running balance almost never repeats a value and rarely changes sign; spending does both.
    // Between two equally-numeric columns, take the earlier one — every export puts the amount
    // before the balance it produces.
    var numeric = scored.filter(function(s){ return s.c !== colOf.date && s.c !== colOf.description && s.amounts > 0; })
      .sort(function(a, b){ return b.amounts - a.amounts || a.c - b.c; });
    if(numeric.length) colOf.amount = numeric[0].c;
  }
  return colOf;
}

// ---------------- Duplicate detection ----------------
// Re-importing an overlapping date range is the normal case, not the edge case: you export "last
// 3 months" every month. Keyed on date + amount + a normalised description, which is everything a
// bank statement actually distinguishes two transactions by. Two genuinely identical purchases on
// one day (two $4.50 coffees) collapse into one key — so the count is per key, and a second
// identical row only reads as a duplicate once the first has been matched.
//
// There is a second, quieter case, and it is the one that matters most: a transaction logged BY
// HAND carries no description at all. logExpenseTransaction() leaves `what` blank on purpose, so
// the row displays its budget line's name rather than a stale copy of it. That means the person
// this whole feature is for — someone who has been logging by hand and is now importing instead —
// would re-import every purchase they had already logged, and see their spending silently double
// over the overlap.
//
// Matching those on date + amount alone is the only evidence available, and it is weaker evidence:
// two unrelated $20 purchases on one day are not far-fetched. So they are flagged separately, as
// `possibleDuplicate`, left out of the import by default, and counted out loud — the user decides,
// rather than the app either double-counting in silence or dropping real spending in silence.
export function normaliseDescription(s){
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
export function transactionKey(dateStr, amount, description){
  return [dateStr || "", Math.round(Math.abs(Number(amount) || 0) * 100), normaliseDescription(description)].join("|");
}

// ---------------- The parse ----------------
// opts.existing: the transactions already in state, used only for duplicate flagging.
// Returns { rows, errors, columns, dateOrder, headerOk } where every entry in `rows` carries
// `duplicate` and `direction` so the preview can group them without re-deriving anything.
//
// Credits (money in) are parsed and returned rather than dropped: a refund is a real thing to see
// in a review screen, and deciding what to do with it is the caller's call, not the parser's.
export function parseBankCsv(rows, opts){
  opts = opts || {};
  if(!rows || !rows.length) return { rows: [], errors: [], columns: {}, dateOrder: "DMY", headerOk: false };
  var columns = detectColumns(rows);
  var usable = columns.date !== undefined &&
    (columns.amount !== undefined || columns.debit !== undefined || columns.credit !== undefined);
  if(!usable) return { rows: [], errors: [], columns: columns, dateOrder: "DMY", headerOk: false };

  var data = rows.slice(columns.hadHeader ? 1 : 0);
  var dateOrder = opts.dateOrder || detectDateOrder(data.map(function(r){ return r[columns.date]; }));

  var seen = Object.create(null);
  var seenUndescribed = Object.create(null);
  (opts.existing || []).forEach(function(t){
    var described = normaliseDescription(t.what || "");
    if(described){
      var k = transactionKey(t.date, t.amount, t.what);
      seen[k] = (seen[k] || 0) + 1;
    } else {
      var ku = transactionKey(t.date, t.amount, "");
      seenUndescribed[ku] = (seenUndescribed[ku] || 0) + 1;
    }
  });

  var out = [], errors = [];
  data.forEach(function(cells, i){
    var rowNum = i + (columns.hadHeader ? 2 : 1);
    if(!cells || cells.every(function(c){ return !c || !c.trim(); })) return; // blank line
    var dateRaw = cells[columns.date] || "";
    var dateStr = parseBankDate(dateRaw, dateOrder);
    if(!dateStr){ errors.push({ row: rowNum, reason: 'Couldn\'t read "' + String(dateRaw).slice(0, 24) + '" as a date' }); return; }
    var signed = signedAmountFor(cells, columns);
    if(signed === null){ errors.push({ row: rowNum, reason: "No amount on this row" }); return; }
    if(signed === 0) return; // a $0 line is a statement artifact, not a transaction
    var description = (columns.description !== undefined ? (cells[columns.description] || "") : "").trim();
    var key = transactionKey(dateStr, signed, description);
    var duplicate = (seen[key] || 0) > 0;
    if(duplicate) seen[key]--;
    // Only ever a *possible* duplicate, and only when it isn't already a certain one — the
    // undescribed pool is consumed per match for the same reason the described one is, so two
    // hand-logged $20 rows on a day absorb two bank rows and a third stays new.
    var possibleDuplicate = false;
    if(!duplicate){
      var undescribedKey = transactionKey(dateStr, signed, "");
      possibleDuplicate = (seenUndescribed[undescribedKey] || 0) > 0;
      if(possibleDuplicate) seenUndescribed[undescribedKey]--;
    }
    out.push({
      row: rowNum,
      date: dateStr,
      amount: Math.abs(signed),
      direction: signed < 0 ? "debit" : "credit",
      description: description,
      duplicate: duplicate,
      possibleDuplicate: possibleDuplicate
    });
  });
  return { rows: out, errors: errors, columns: columns, dateOrder: dateOrder, headerOk: true };
}

// One row's amount as a signed number: negative for money out. Three shapes to reconcile —
// a single Amount column that is already signed; a Debit/Credit pair where the sign is the column
// you're in; and a single Amount column that is unsigned because the bank put the direction
// somewhere else entirely, which reads as spending (the overwhelmingly common case in a statement,
// and the one a review screen can correct).
function signedAmountFor(cells, columns){
  if(columns.debit !== undefined || columns.credit !== undefined){
    var debit = columns.debit !== undefined ? parseBankAmount(cells[columns.debit]) : null;
    var credit = columns.credit !== undefined ? parseBankAmount(cells[columns.credit]) : null;
    if(debit) return -Math.abs(debit);
    if(credit) return Math.abs(credit);
    if(columns.amount === undefined) return null;
  }
  if(columns.amount === undefined) return null;
  var raw = (cells[columns.amount] || "").trim();
  var amount = parseBankAmount(raw);
  if(amount === null) return null;
  if(amount === 0) return 0;
  var wasSigned = /^\(.*\)$/.test(raw) || /[-+]/.test(raw);
  return wasSigned ? amount : -Math.abs(amount);
}

// Everything the parse found that's worth saying out loud before anyone commits anything — the
// date range, what got read, and how the dates were read, since that last one is the decision most
// likely to be silently wrong and the user is the only one who can confirm it.
export function bankImportSummary(parsed){
  var spend = parsed.rows.filter(function(r){ return r.direction === "debit" && !r.duplicate && !r.possibleDuplicate; });
  var dates = parsed.rows.map(function(r){ return r.date; }).sort();
  return {
    total: parsed.rows.length,
    newSpend: spend.length,
    newSpendAmount: spend.reduce(function(s, r){ return s + r.amount; }, 0),
    credits: parsed.rows.filter(function(r){ return r.direction === "credit" && !r.duplicate && !r.possibleDuplicate; }).length,
    duplicates: parsed.rows.filter(function(r){ return r.duplicate; }).length,
    possibleDuplicates: parsed.rows.filter(function(r){ return r.possibleDuplicate; }).length,
    skipped: parsed.errors.length,
    firstDate: dates.length ? dates[0] : null,
    lastDate: dates.length ? dates[dates.length - 1] : null,
    // A file reaching well into the future is a date-order misread often enough to be worth
    // checking for — 03/04 read as March in a file exported in April produces exactly this. The
    // two-week grace is the difference between that and an export that legitimately carries a few
    // pending or scheduled entries, which would otherwise cry wolf on every statement.
    hasFutureDates: dates.length ? dates[dates.length - 1] > addDays(localDateStr(), 14) : false,
    dateOrder: parsed.dateOrder
  };
}
