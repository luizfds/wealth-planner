// ---------------- Calculators (v3.189.0, item 220) ----------------
//
// The Calculators page's standalone tools, built on the same functions the purchase calculator uses (so a
// figure here is the figure a scenario gets): stamp duty, lenders mortgage insurance, a loan's repayments,
// and what a lender might lend — the repayment arithmetic run backwards at the rate plus their buffer, on
// take-home pay less living costs and other repayments. Pure.

import { calcStampDuty, calcLMI, calcRepaymentMonthly } from "./property.js";
import { SERVICE_BUFFER } from "./salecgt.js";

function r2(n){ return Math.round(n * 100) / 100; }
function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }

export function stampDutyFigures(stateCode, price, firstHome){
  var duty = calcStampDuty(stateCode, num(price), !!firstHome);
  var full = calcStampDuty(stateCode, num(price), false);
  return { duty: duty == null ? null : r2(duty), saving: duty == null || full == null ? 0 : r2(full - duty) };
}
export function lmiFigures(price, depositPct){
  price = num(price);
  var deposit = price * Math.max(0, Math.min(100, num(depositPct))) / 100, loan = price - deposit, lvr = price > 0 ? loan / price : 0;
  var lmi = calcLMI(loan, lvr);
  return { deposit: r2(deposit), loan: r2(loan), lvr: lvr, lmi: r2(lmi), depositFor80: r2(Math.max(0, price * 0.2 - deposit)) };
}
export function repaymentFigures(loan, ratePct, termYears, type){
  loan = num(loan);
  var monthly = calcRepaymentMonthly(loan, num(ratePct), num(termYears) || 30, type === "IO" ? "IO" : "PI");
  var months = (num(termYears) || 30) * 12;
  return { monthly: r2(monthly), fortnightly: r2(monthly * 12 / 26), totalInterest: r2(type === "IO" ? monthly * months : monthly * months - loan) };
}
// The loan whose repayments (principal and interest, at the rate plus the buffer) take exactly what's left
// of take-home pay after living costs and other repayments. { spare, maxLoan, assessedRate }.
export function borrowingPower(incomeMonthly, livingMonthly, otherRepaymentsMonthly, ratePct, termYears, buffer){
  var spare = num(incomeMonthly) - num(livingMonthly) - num(otherRepaymentsMonthly);
  var rate = num(ratePct) + (buffer == null ? SERVICE_BUFFER : num(buffer)), n = (num(termYears) || 30) * 12, i = rate / 100 / 12;
  var maxLoan = spare <= 0 ? 0 : i > 0 ? spare * (1 - Math.pow(1 + i, -n)) / i : spare * n;
  return { spare: r2(spare), maxLoan: Math.floor(maxLoan / 1000) * 1000, assessedRate: rate };
}
