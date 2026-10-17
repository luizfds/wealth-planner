import { state } from "../state.js";
import { periodsOf } from "./ledger.js";
import {
  ipProperties, loanInterestMonthly, loanInterestMonthlyRaw, borrowingCostsDeduction, propertyDepreciationForFy, fyWindow
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
    // Reportable employer super contributions and reportable fringe benefits (v3.29.0): not taxable
    // income, but both count in the income tests — see computePersonTax's year mode.
    acc.resc += Number(s.resc) || 0;
    acc.rfba += Number(s.rfba) || 0;
    return acc;
  }, { gross: 0, withheld: 0, resc: 0, rfba: 0 });
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
  var win = fyWindow(fy);
  // v3.41.0: a loan paid out partway through the year only charged interest up to then.
  model.interest = (property.loans || []).reduce(function(s, l){
    var share = 1;
    if(l.endedOn){
      if(l.endedOn < win.start) share = 0;
      else if(l.endedOn <= win.end) share = (Date.parse(l.endedOn) - Date.parse(win.start)) / (Date.parse(win.end) - Date.parse(win.start) + 86400000);
    }
    return s + loanInterestMonthlyRaw(l) * 12 * share;
  }, 0);
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

// ---------------- Lodgement season (v3.34.0) ----------------
//
// Where today sits in the tax calendar, for the Dashboard's tax tile and the reminders. An
// individual lodging their own return has until 31 October for the financial year that ended on
// 30 June; a registered tax agent's clients get later dates, which this doesn't try to know.
// `fy` is the year being lodged (2025 = FY25/26). Pure: takes today as "YYYY-MM-DD".
export function lodgementStatus(today){
  var y = Number(String(today).slice(0, 4)), m = Number(String(today).slice(5, 7));
  var fyNow = m >= 7 ? y : y - 1;
  // Jul–Dec: this calendar year's 31 October. Jan–Jun: the last one was the previous October's.
  var due = (m >= 7 ? y : y - 1) + "-10-31";
  var dayMs = 86400000;
  var daysLeft = Math.round((Date.UTC(+due.slice(0, 4), 9, 31) - Date.UTC(y, m - 1, Number(String(today).slice(8, 10)))) / dayMs);
  return {
    fy: fyNow - 1,
    due: due,
    daysLeft: daysLeft,
    // 1 July to 31 October: the return for the year just ended is the thing to be doing.
    inSeason: m >= 7 && daysLeft >= 0,
    afterDue: daysLeft < 0
  };
}

// ---------------- Importing a year's figures (v3.40.0) ----------------
//
// A "tax year file" carries one financial year's documents — what a return was actually built
// from — and merges into an existing plan without touching anything else (a full backup import
// replaces everything). Shape:
//   { kind: "wealth-planner-tax-year", version: 1, fy: 2025,
//     people: { Name: { incomeStatements, interest, deductions, wfhHours, dateOfBirth } },
//     rental: [{ match: "Example", lines: { rent: ***REMOVED***, ... } }],
//     holdings: [{ symbol: "ETFB", person: "Name", taxStatement: {...}, sales: [...] }],
//     markLodged: true }
// People are matched by name, case-insensitively, or by first name either way round ("Alex" ↔
// "Alex Morgan"). A rental entry goes to the investment property whose name contains `match`,
// or the only one. A holding is matched by symbol (or name) and person; a sold-out holding that
// isn't in the plan is added with quantity 0 so its sales count. Returns what went where.
export var TAX_YEAR_FILE_KIND = "wealth-planner-tax-year";
function firstWord(s){ return String(s || "").trim().toLowerCase().split(/\s+/)[0]; }
export function matchPerson(name, people){
  var n = String(name || "").trim().toLowerCase();
  var exact = people.find(function(p){ return p.toLowerCase() === n; });
  if(exact) return exact;
  return people.find(function(p){ return firstWord(p) === firstWord(n); }) || null;
}
export function mergeTaxYearFile(data, people, opts){
  opts = opts || {};
  var genId = opts.genId || function(p){ return p + Math.random().toString(36).slice(2, 9); };
  if(!data || data.kind !== TAX_YEAR_FILE_KIND) throw new Error("Not a tax year file");
  var fy = Number(data.fy);
  if(!(fy > 2000)) throw new Error("The file has no financial year");
  var report = { fy: fy, people: [], unmatchedPeople: [], rental: [], statements: [], sales: [], addedHoldings: [], skipped: [] };
  var nameMap = {};
  Object.keys(data.people || {}).forEach(function(name){
    var to = matchPerson(name, people);
    if(!to){ report.unmatchedPeople.push(name); to = name; }
    nameMap[name] = to;
    var src = data.people[name];
    var py = personYear(fy, to, true);
    if(Array.isArray(src.incomeStatements)) py.incomeStatements = src.incomeStatements.map(function(r){ return Object.assign({ id: genId("is") }, r); });
    if(Array.isArray(src.interest)) py.interest = src.interest.map(function(r){ return Object.assign({ id: genId("int") }, r); });
    if(Array.isArray(src.deductions)) py.deductions = src.deductions.map(function(r){ return Object.assign({ id: genId("ded") }, r); });
    if(!state.tax.settings) state.tax.settings = {};
    var st = state.tax.settings[to] || (state.tax.settings[to] = {});
    if(src.wfhHours != null){ if(!st.wfhHours || typeof st.wfhHours !== "object") st.wfhHours = {}; st.wfhHours[fy] = Number(src.wfhHours) || 0; }
    if(src.dateOfBirth && !st.dateOfBirth) st.dateOfBirth = src.dateOfBirth;
    report.people.push(name === to ? to : name + " → " + to);
  });
  var ips = state.properties.filter(function(p){ return p.kind === "IP"; });
  (data.rental || []).forEach(function(r){
    var m = String(r.match || "").toLowerCase();
    var prop = (m && ips.find(function(p){ return String(p.what || "").toLowerCase().indexOf(m) !== -1; })) || (ips.length === 1 ? ips[0] : null);
    if(!prop){ report.skipped.push("rental schedule for “" + (r.match || "?") + "” — no matching investment property"); return; }
    Object.keys(r.lines || {}).forEach(function(k){ setRentalActual(fy, prop.id, k, r.lines[k]); });
    if(r.ownership && Object.keys(r.ownership).length && !(prop.ownership && Object.keys(prop.ownership).length)){
      prop.ownership = {};
      Object.keys(r.ownership).forEach(function(n){ prop.ownership[nameMap[n] || n] = Number(r.ownership[n]) || 0; });
    }
    report.rental.push(prop.what || "investment property");
  });
  (data.holdings || []).forEach(function(h){
    var person = h.person ? (nameMap[h.person] || matchPerson(h.person, people) || h.person) : "";
    var sym = String(h.symbol || "").toUpperCase();
    var holding = state.assets.find(function(a){
      return a.category === "Shares" && (String(a.symbol || "").toUpperCase() === sym || String(a.what || "").toUpperCase() === sym) &&
        (!person || !a.person || a.person === person);
    });
    if(!holding){
      if(h.sales && h.sales.length && !h.taxStatement){
        holding = { category: "Shares", what: h.name || sym, symbol: sym, market: h.market || "ASX", person: person, quantity: 0, price: 0, amount: 0,
          lots: [], sales: [], payouts: [], taxStatements: [], history: [] };
        state.assets.push(holding);
        report.addedHoldings.push(sym + (person ? " (" + person + ")" : ""));
      } else { report.skipped.push(sym + " tax statement — no " + sym + " holding" + (person ? " for " + person : "")); return; }
    }
    if(h.taxStatement){
      if(!Array.isArray(holding.taxStatements)) holding.taxStatements = [];
      holding.taxStatements = holding.taxStatements.filter(function(s){ return Number(s.fy) !== fy; });
      holding.taxStatements.push(Object.assign({ fy: fy }, h.taxStatement));
      report.statements.push(sym + (person ? " (" + person + ")" : ""));
    }
    (h.sales || []).forEach(function(sale){
      if(!Array.isArray(holding.sales)) holding.sales = [];
      var dup = holding.sales.some(function(s){ return s.date === sale.date && Number(s.units) === Number(sale.units) && Number(s.proceeds) === Number(sale.proceeds); });
      if(dup) return;
      holding.sales.push(Object.assign({}, sale));
      report.sales.push(sym + " " + sale.date);
    });
  });
  return report;
}
