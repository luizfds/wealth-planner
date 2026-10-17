import { state } from "../state.js";
import { periodsOf } from "./ledger.js";
import {
  ipProperties, loanInterestMonthly, borrowingCostsDeduction, propertyDepreciationForFy, fyWindow
} from "./property.js";

// ---------------- The tax-year record (v3.26.0) ----------------
//
// Everything else in the tax engine is a RATE: what a year looks like at today's settings. A return
// is a record of one particular year, filled in from that year's documents — income statements,
// bank interest, the agent's annual summary, the loan statement's interest figure. This module
// holds those actuals, per financial year:
//
//   state.taxYears[fy] = {
//     people: { [person]: { incomeStatements: [{id, payer, gross, allowances, withheld}],
//                           interest: [{id, account, gross, sharePct}],
//                           deductions: [{id, label, what, amount}] } },
//     properties: { [propertyId]: { lines: { rent: ***REMOVED***, interest: ***REMOVED***, ... } } },
//     evidence: { [key]: true },
//     lodged: { [person]: {figures snapshot} }
//   }
//
// fy is the calendar year the financial year starts in (2025 = FY25/26). Nothing here is required:
// a year with no record falls back to the model, line by line, so the worksheet is useful from the
// first time it's opened and gets more exact as documents are typed in.

export function taxYearRecord(fy, create){
  if(!state.taxYears || typeof state.taxYears !== "object") state.taxYears = {};
  var rec = state.taxYears[fy];
  if(!rec && !create) return null;
  if(!rec) rec = state.taxYears[fy] = {};
  if(!rec.people) rec.people = {};
  if(!rec.properties) rec.properties = {};
  if(!rec.evidence) rec.evidence = {};
  if(!rec.lodged) rec.lodged = {};
  return rec;
}
export function personYear(fy, person, create){
  var rec = taxYearRecord(fy, create);
  if(!rec) return null;
  var p = rec.people[person];
  if(!p && !create) return null;
  if(!p) p = rec.people[person] = {};
  if(!Array.isArray(p.incomeStatements)) p.incomeStatements = [];
  if(!Array.isArray(p.interest)) p.interest = [];
  if(!Array.isArray(p.deductions)) p.deductions = [];
  return p;
}

// Salary and wages from income statements: gross + allowances, and the tax withheld. null when no
// statement has been entered, so the caller knows to fall back to the income rows.
export function incomeStatementTotals(fy, person){
  var p = personYear(fy, person, false);
  if(!p || !p.incomeStatements.length) return null;
  return p.incomeStatements.reduce(function(acc, s){
    acc.gross += (Number(s.gross) || 0) + (Number(s.allowances) || 0);
    acc.withheld += Number(s.withheld) || 0;
    return acc;
  }, { gross: 0, withheld: 0 });
}
// Gross interest times this person's share of each account — a joint account's interest is split
// by ownership, the way the bank's report to the ATO does it.
export function interestIncome(fy, person){
  var p = personYear(fy, person, false);
  if(!p) return 0;
  return Math.round(p.interest.reduce(function(sum, i){
    var share = i.sharePct == null ? 100 : Math.max(0, Math.min(100, Number(i.sharePct) || 0));
    return sum + (Number(i.gross) || 0) * share / 100;
  }, 0) * 100) / 100;
}
// Deductions typed for the year, by label. null when none were entered, so the budget-line
// deductions (a rate) stand in.
export function recordedDeductionsByLabel(fy, person){
  var p = personYear(fy, person, false);
  if(!p || !p.deductions.length) return null;
  var out = {};
  p.deductions.forEach(function(d){
    var code = d.label || "D5";
    out[code] = Math.round(((out[code] || 0) + (Number(d.amount) || 0)) * 100) / 100;
  });
  return out;
}

// ---------------- The rental schedule ----------------
//
// The rent section of a return, line by line in myTax's order. Each line has a MODEL value worked
// out from what the app already knows (the property's income and expense rows by name, loan
// interest from the balance and rate, borrowing costs and depreciation for that year) and, once
// typed from the year's documents, an ACTUAL that replaces it. The model is the fallback, not the
// answer: the agent's annual summary, the loan statement and the council notices are.
export var RENT_LINES = [
  { key: "rent", label: "Rental income", income: true },
  { key: "otherIncome", label: "Other rental-related income", income: true },
  { key: "advertising", label: "Advertising" },
  { key: "bodyCorporate", label: "Body corporate fees" },
  { key: "borrowing", label: "Deductible borrowing expenses" },
  { key: "cleaning", label: "Cleaning" },
  { key: "councilRates", label: "Council rates" },
  { key: "capitalAllowances", label: "Capital allowances" },
  { key: "gardening", label: "Gardening" },
  { key: "insurance", label: "Insurance" },
  { key: "interest", label: "Interest on loans" },
  { key: "landTax", label: "Land tax" },
  { key: "legal", label: "Legal fees" },
  { key: "pestControl", label: "Pest control" },
  { key: "agentFees", label: "Agent fees" },
  { key: "repairs", label: "Repairs" },
  { key: "capitalWorks", label: "Capital works" },
  { key: "stationery", label: "Stationery, phone and postage" },
  { key: "travel", label: "Travel expenses" },
  { key: "water", label: "Water charges" },
  { key: "other", label: "Other expenses" }
];
// Most specific first: "Water rates" is water, not council rates; "Land Tax" isn't rates either.
var EXPENSE_MATCHERS = [
  ["landTax", /land tax/i], ["water", /water/i], ["pestControl", /pest/i], ["insurance", /insur/i],
  ["agentFees", /agent|property manag|management fee|letting|\bpm\b/i], ["bodyCorporate", /body corp|strata|owners corp/i],
  ["gardening", /garden|lawn|mow/i], ["cleaning", /clean/i], ["advertising", /advertis/i],
  ["legal", /legal|solicitor/i], ["repairs", /repair|mainten|plumb|electric/i], ["travel", /travel/i],
  ["stationery", /stationer|postage/i], ["councilRates", /council|\brates\b/i]
];
export function rentLineForExpense(what){
  for(var i = 0; i < EXPENSE_MATCHERS.length; i++){
    if(EXPENSE_MATCHERS[i][1].test(String(what || ""))) return EXPENSE_MATCHERS[i][0];
  }
  return "other";
}
function yearly(rows){
  return (rows || []).reduce(function(s, r){ return s + periodsOf(Number(r.amount) || 0, r.freq).yearly; }, 0);
}
export function rentalSchedule(property, fy){
  var model = {};
  RENT_LINES.forEach(function(l){ model[l.key] = 0; });
  model.rent = yearly(property.income);
  (property.expenses || []).forEach(function(e){
    var key = rentLineForExpense(e.what);
    model[key] += periodsOf(Number(e.amount) || 0, e.freq).yearly;
  });
  model.interest = (property.loans || []).reduce(function(s, l){ return s + loanInterestMonthly(l) * 12; }, 0);
  var win = fyWindow(fy);
  model.borrowing = (property.loans || []).reduce(function(s, l){ return s + borrowingCostsDeduction(l, win); }, 0);
  var dep = propertyDepreciationForFy(property, fy);
  model.capitalWorks = dep.capitalWorks;
  model.capitalAllowances = dep.plant;
  var rec = taxYearRecord(fy, false);
  var actual = rec && rec.properties[property.id] && rec.properties[property.id].lines || {};
  var lines = RENT_LINES.map(function(l){
    var m = Math.round((model[l.key] || 0) * 100) / 100;
    var has = actual[l.key] != null && actual[l.key] !== "";
    return { key: l.key, label: l.label, income: !!l.income, model: m, actual: has ? Number(actual[l.key]) : null, value: has ? Number(actual[l.key]) : m };
  });
  var income = lines.filter(function(l){ return l.income; }).reduce(function(s, l){ return s + l.value; }, 0);
  var expenses = lines.filter(function(l){ return !l.income; }).reduce(function(s, l){ return s + l.value; }, 0);
  return {
    lines: lines,
    income: Math.round(income * 100) / 100,
    expenses: Math.round(expenses * 100) / 100,
    net: Math.round((income - expenses) * 100) / 100,
    actualCount: lines.filter(function(l){ return l.actual != null; }).length
  };
}
export function setRentalActual(fy, propertyId, key, value){
  var rec = taxYearRecord(fy, true);
  if(!rec.properties[propertyId]) rec.properties[propertyId] = { lines: {} };
  if(value === "" || value == null) delete rec.properties[propertyId].lines[key];
  else rec.properties[propertyId].lines[key] = Number(value) || 0;
}
// Every investment property's schedule for the year, for the worksheet's rent section.
export function rentalSchedules(fy){
  return ipProperties().map(function(p){ return { property: p, schedule: rentalSchedule(p, fy) }; });
}
