import { state } from "../state.js";
import { periodsOf, isActiveOn } from "./ledger.js";
import { incomeTaxAU, medicareLevyAU, fyOfDate, personTakeHomeParts, monthlyPayNow, personTaxSettings, helpRepaymentAnnual } from "./tax.js";
import { payFrequency } from "./payslip.js";
import { fmtCurrency2, fmtDate } from "../lib/format.js";

// ---------------- A payslip against the plan (v3.148.0) ----------------
//
// "The app says one take-home and my payslip says another — why?" asked of a person, answered from
// the payslip read (calc/payslip.js) and the plan: gross against the pay rows running on the payslip's
// date, the tax withheld against tax on this pay at the year's rates the way withholding works it
// out (as if every pay of the year were this one), what was paid or taken after tax, and what in
// the plan never shows on a payslip (the rental's refund) or is about to change (pay that ends).
// Pure apart from reading state. payslipCheck(person, slip) →
//   { freq, perYear, date, expected: { gross, tax, net }, actual: { gross, tax, net, afterTax },
//     lines: [{ tone: "ok"|"warn"|"info", text }], loggable: { amount, date } | null }.

var PER_YEAR = { Weekly: 52, Fortnightly: 26, Monthly: 12 };
function r2(n){ return Math.round(n * 100) / 100; }
function money(n){ return fmtCurrency2.format(Math.abs(n)); }

function payRowsOn(person, date){
  return (state.income || []).filter(function(r){ return r.person === person && r.incomeType === "Gross" && !r.irregular && !r.computed && isActiveOn(r, date); });
}
// What a row pays in cash a year — super taken out when the amount includes it.
function cashYearly(r){
  var y = periodsOf(Number(r.amount) || 0, r.freq).yearly;
  var sg = (Number(state.tax && state.tax.sgRate) || 0) / 100;
  return r.superMode === "Included" ? y / (1 + sg) : y;
}

export function payslipCheck(person, slip, opts){
  opts = opts || {};
  if(!slip || slip.error || slip.gross == null || slip.net == null) return null;
  var freq = payFrequency(slip) || opts.freq || null;
  if(!freq || !PER_YEAR[freq]) return null;
  var n = PER_YEAR[freq];
  var date = slip.periodEnd || slip.payDate || opts.today;
  var fy = fyOfDate(date);
  var rows = payRowsOn(person, date);
  var expGross = r2(rows.reduce(function(t, r){ return t + cashYearly(r); }, 0) / n);
  // Withholding works a pay out as if every pay of the year were this one.
  var sacrifice = Number(slip.sacrifice) || 0;
  var annual = Math.max(0, (slip.gross - sacrifice) * n);
  var help = personTaxSettings(person).helpBalance;
  var expTax = r2((incomeTaxAU(annual, fy) + medicareLevyAU(annual, fy) + (help > 0 ? helpRepaymentAnnual(annual, help, fy) : 0)) / n);
  var parts = personTakeHomeParts(person);
  var expNet = r2(monthlyPayNow(parts, date) * 12 / n);
  var afterTax = r2(slip.net - (slip.gross - (Number(slip.tax) || 0) - sacrifice));
  var lines = [];

  var gd = r2(slip.gross - expGross);
  if(Math.abs(gd) <= Math.max(1, expGross * 0.005)) lines.push({ tone: "ok", text: "Gross " + money(slip.gross) + " is what the plan pays a " + freq.toLowerCase().replace(/ly$/, "") + "." });
  else lines.push({ tone: "warn", text: "Gross " + money(slip.gross) + " is " + money(gd) + (gd > 0 ? " more" : " less") + " than the plan's " + money(expGross) +
    " — overtime, back pay, leave loading or unpaid leave this time? If it's the new normal, set the salary from the payslip." });

  if(slip.tax != null){
    var td = r2(slip.tax - expTax);
    if(Math.abs(td) <= Math.max(20, expTax * 0.03)) lines.push({ tone: "ok", text: "Tax withheld " + money(slip.tax) + " is about what this pay works out to (" + money(expTax) + ")." });
    else lines.push({ tone: "info", text: "Tax withheld " + money(slip.tax) + " is " + money(td) + (td > 0 ? " more" : " less") + " than tax on this pay at the year's rates (" + money(expTax) + ")" +
      " — the withholding tables round and don't know the rest of the year; the difference comes back, or is owed, at tax time." });
  }
  var match = null;
  if(Math.abs(afterTax) >= 1){
    match = (state.income || []).find(function(r){ return r.person === person && r.incomeType === "Net" && !r.computed && Math.abs(periodsOf(Number(r.amount) || 0, r.freq).yearly / n - afterTax) < 1; });
    lines.push({ tone: "info", text: afterTax > 0
      ? money(afterTax) + " paid on top after tax" + (match ? " — " + match.what + ", a row of its own in the plan." : " — a reimbursement or allowance not in the plan?")
      : money(afterTax) + " taken out after tax — a share plan, union fees or a donation? It isn't in the plan." });
  }
  if(parts.refund) lines.push({ tone: "info", text: "The rental's loss isn't allowed for in withholding: the tax it saves (" + money(parts.refund.amount) + " a year) comes back in the refund, a row of its own in the plan." });
  (parts.ending || []).forEach(function(e){
    if(e.endDate < date) return;
    lines.push({ tone: "info", text: (e.row.what || "Part of this pay") + " ends " + fmtDate(e.endDate) + " — about " + money(e.monthly * 12 / n) + " less a " + freq.toLowerCase().replace(/ly$/, "") + " after tax from then." });
  });

  // What the plan expects to land, with what's paid after tax that the plan already has as its own row.
  var matchedAfterTax = afterTax > 0 && match ? afterTax : 0;
  var nd = r2(slip.net - expNet - matchedAfterTax);
  var head = Math.abs(nd) <= Math.max(25, expNet * 0.01)
    ? { tone: "ok", text: "Net " + money(slip.net) + " — what the plan expects" + (matchedAfterTax ? " (" + money(expNet) + " take-home, plus " + money(matchedAfterTax) + " after tax)." : ".") }
    : { tone: "warn", text: "Net " + money(slip.net) + " is " + money(nd) + (nd > 0 ? " more" : " less") + " than the plan's " + money(expNet + matchedAfterTax) + ". Here's what the payslip shows:" };
  lines.unshift(head);

  // Already logged as received within a few days of the pay date? Then nothing to log.
  var payDate = slip.payDate || slip.periodEnd;
  var logged = (state.incomeLog || []).some(function(r){ return r.target === "net:" + person && r.date && Math.abs(Date.parse(r.date) - Date.parse(payDate)) <= 5 * 86400000; });
  return { freq: freq, perYear: n, date: date,
    expected: { gross: expGross, tax: expTax, net: r2(expNet + matchedAfterTax) },
    actual: { gross: slip.gross, tax: slip.tax, net: slip.net, afterTax: afterTax },
    lines: lines, loggable: logged || !payDate ? null : { amount: slip.net, date: payDate } };
}
