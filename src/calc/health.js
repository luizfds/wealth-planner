import { state } from "../state.js";
import { getTaxPeople, todayTaxFy } from "./tax.js";
import { claimItems } from "./claims.js";
import { ipProperties, propertyOwnershipTotal, fyLabel } from "./property.js";
import { taxYearRecord } from "./taxyear.js";
import { budgetComparison, rentalComparison, householdBudgetLines } from "./closeyear.js";
import { localDateStr } from "../lib/format.js";

// ---------------- Data health (v3.48.0) ----------------
//
// One list of the places where the data disagrees with itself — the kind of thing that never
// throws an error but quietly makes a figure wrong: a deductible line nobody claims, a cost claimed
// against a property that's gone, a plan line half of what the year actually cost. Each check names
// the rows it found and says where to fix them. Pure apart from reading state; the Accounts →
// Checks tab renders it and the bell counts it.
//
// {id, severity: "bad"|"warn"|"info", title, detail, where: {page, sub}}
function names(list, max){
  max = max || 4;
  var shown = list.slice(0, max).map(function(x){ return "“" + (x || "Untitled") + "”"; }).join(", ");
  return list.length > max ? shown + " and " + (list.length - max) + " more" : shown;
}
function plural(n, one, many){ return n + " " + (n === 1 ? one : (many || one + "s")); }

export function dataHealthChecks(opts){
  opts = opts || {};
  var today = opts.today || localDateStr();
  var items = opts.items || claimItems();
  var people = getTaxPeople();
  var ipIds = ipProperties().map(function(p){ return p.id; });
  var out = [];
  var add = function(c){ out.push(c); };

  // A card's limit typed in as a debt (v3.55.0). Net worth counts every debt row as money owed, so
  // a $10,000 limit with $600 on the card understates net worth by $9,400. What's owed is the
  // balance on the latest statement — the limit belongs on the card, not in Debts.
  var limits = (state.debts || []).filter(function(d){ return /\blimit\b/i.test(d.what || "") && Number(d.balance) > 0; });
  if(limits.length) add({ id: "debt-limit", severity: "warn", title: plural(limits.length, "debt") + " that look like a credit limit, not money owed",
    detail: names(limits.map(function(d){ return d.what; })) + " — net worth counts the whole amount as owed. On Accounts, open the card, type the limit in its Limit field, and Update its balance to what it actually owes.",
    where: { page: "accounts", sub: "accounts" } });

  // Deductions that land nowhere, or nowhere real.
  var unclaimed = items.filter(function(i){ return i.deductible && !i.claimProperty && !i.deductiblePerson && people.length > 1; });
  if(unclaimed.length) add({ id: "ded-noperson", severity: "bad", title: plural(unclaimed.length, "deductible line") + " claimed by nobody",
    detail: names(unclaimed.map(function(i){ return i.what; })) + " — with two or more people a line needs a person (or a property) under Claimed by, or it counts on no return.",
    where: { page: "expenses", sub: "budget" } });
  var orphanProp = items.filter(function(i){ return i.deductible && i.claimProperty && ipIds.indexOf(i.claimProperty) === -1; });
  if(orphanProp.length) add({ id: "ded-noprop", severity: "bad", title: plural(orphanProp.length, "line") + " claimed against a property that's gone",
    detail: names(orphanProp.map(function(i){ return i.what; })) + " — pick a person or another property under Claimed by.", where: { page: "expenses", sub: "budget" } });
  var orphanPerson = items.filter(function(i){ return i.deductible && i.deductiblePerson && people.indexOf(i.deductiblePerson) === -1; });
  if(orphanPerson.length) add({ id: "ded-gone", severity: "bad", title: plural(orphanPerson.length, "line") + " claimed by someone no longer in tax",
    detail: names(orphanPerson.map(function(i){ return i.what + " (" + i.deductiblePerson + ")"; })), where: { page: "expenses", sub: "budget" } });
  var personNoFlag = items.filter(function(i){ return !i.deductible && i.deductiblePerson; });
  if(personNoFlag.length) add({ id: "ded-noflag", severity: "info", title: plural(personNoFlag.length, "line") + " with a person but not ticked deductible",
    detail: names(personNoFlag.map(function(i){ return i.what + " (" + i.deductiblePerson + ")"; })) + " — tick Tax deduction if it's claimable, or clear Claimed by.", where: { page: "expenses", sub: "budget" } });
  var propDouble = [];
  (state.properties || []).forEach(function(p){ (p.expenses || []).forEach(function(e){ if(e.deductible) propDouble.push(e.what + " (" + (p.what || "property") + ")"); }); });
  if(propDouble.length) add({ id: "ded-propdouble", severity: "warn", title: plural(propDouble.length, "property cost") + " also ticked as a personal deduction",
    detail: names(propDouble) + " — already on the rental schedule; claiming it again would count it twice. Edit the row and untick it.", where: { page: "properties" } });

  // Ownership.
  ipProperties().forEach(function(p){
    var total = propertyOwnershipTotal(p);
    if(total != null && Math.abs(total - 100) > 0.01) add({ id: "own:" + p.id, severity: "bad", title: (p.what || "A property") + "'s ownership adds to " + total + "%",
      detail: "Each owner's share of its rent and costs is taken from these — they should add to 100%.", where: { page: "properties" } });
  });

  // People.
  var noDob = people.filter(function(p){ return !(state.tax && state.tax.settings && state.tax.settings[p] && state.tax.settings[p].dateOfBirth); });
  if(noDob.length) add({ id: "people-dob", severity: "info", title: names(noDob) + " without a date of birth",
    detail: "Needed for the private health rebate from 65, and to compare with people the same age.", where: { page: "accounts", sub: "people" } });

  // Rows missing an account or category, and accounts named that don't exist.
  var budget = items.filter(function(i){ return !i.computed; });
  var noAccount = budget.filter(function(i){ return !(i.account || "").trim(); });
  if(noAccount.length) add({ id: "rows-noaccount", severity: "info", title: plural(noAccount.length, "budget line") + " with no account",
    detail: names(noAccount.map(function(i){ return i.what; })) + " — the account is what groups spending into a card's statement and the bank import into lines.", where: { page: "expenses", sub: "budget" } });
  var noCat = budget.filter(function(i){ return !(i.category || "").trim(); });
  if(noCat.length) add({ id: "rows-nocat", severity: "info", title: plural(noCat.length, "budget line") + " with no category",
    detail: names(noCat.map(function(i){ return i.what; })) + " — they show as Uncategorised in the spending charts.", where: { page: "expenses", sub: "budget" } });
  var known = (state.accounts || []).map(function(a){ return a.name; });
  if(known.length){
    var ghost = {};
    budget.concat((state.income || []).filter(function(i){ return !i.computed; })).forEach(function(i){ var a = (i.account || "").trim(); if(a && known.indexOf(a) === -1) ghost[a] = true; });
    var ghosts = Object.keys(ghost);
    if(ghosts.length) add({ id: "rows-ghostacct", severity: "warn", title: plural(ghosts.length, "account name") + " used on rows but not in your accounts",
      detail: names(ghosts) + " — add it under Accounts (re-adding the same spelling relinks every row), or change the rows.", where: { page: "accounts", sub: "accounts" } });
  }

  // Likely duplicates.
  var dupCosts = [];
  (state.properties || []).forEach(function(p){
    var seen = {};
    (p.acquisitionCosts || []).forEach(function(c){
      var amt = Math.round((Number(c.amount) || 0) * 100);
      if(amt <= 0) return;
      if(seen[amt]) dupCosts.push("“" + (seen[amt].what || "").trim() + "” and “" + (c.what || "").trim() + "” on " + (p.what || "a property"));
      else seen[amt] = c;
    });
  });
  if(dupCosts.length) add({ id: "dup-acq", severity: "warn", title: plural(dupCosts.length, "pair") + " of acquisition costs with the same amount",
    detail: dupCosts.slice(0, 3).join("; ") + " — if it's one fee entered twice, delete one; it inflates the cost base.", where: { page: "properties" } });
  var lineSeen = {}, dupLines = [];
  budget.forEach(function(i){
    var k = (i.what || "").trim().toLowerCase() + "|" + (Number(i.amount) || 0) + "|" + (i.freq || "");
    if(!(i.what || "").trim()) return;
    if(lineSeen[k]) dupLines.push(i.what); else lineSeen[k] = true;
  });
  if(dupLines.length) add({ id: "dup-lines", severity: "warn", title: plural(dupLines.length, "budget line") + " that look entered twice",
    detail: names(dupLines) + " — same name, amount and frequency as another line.", where: { page: "expenses", sub: "budget" } });

  // The plan against the last finished year.
  var lastFy = todayTaxFy(today) - 1;
  var b = budgetComparison(householdBudgetLines(items, state.properties), state.transactions || [], lastFy, today);
  var far = b.rows.filter(function(r){ return r.off >= 0.3 && Math.abs(r.diff) >= 200; });
  if(far.length) add({ id: "plan-budget:" + lastFy, severity: "warn", title: plural(far.length, "budget line") + " far from what " + fyLabel(lastFy) + " actually cost",
    detail: names(far.map(function(r){ return r.what; })) + (b.months < 12 ? " (from " + b.months + " months of logging, scaled to a year)" : "") + ". Tax → Returns → Close " + fyLabel(lastFy) + " updates them.",
    where: { page: "tax", sub: "returns", fy: lastFy } });
  var rec = taxYearRecord(lastFy, false);
  if(rec){
    ipProperties().forEach(function(p){
      var offLines = rentalComparison(p, lastFy).filter(function(r){ return r.action && Math.abs(r.diff) >= Math.max(200, Math.abs(r.planned) * 0.2); });
      if(offLines.length) add({ id: "plan-rent:" + p.id + ":" + lastFy, severity: "warn", title: (p.what || "A property") + ": " + plural(offLines.length, "line") + " off " + fyLabel(lastFy) + "'s actuals",
        detail: names(offLines.map(function(r){ return r.label; })) + ". Tax → Returns → Close " + fyLabel(lastFy) + " updates the property's rows.",
        where: { page: "tax", sub: "returns", fy: lastFy } });
    });
  }
  var order = { bad: 0, warn: 1, info: 2 };
  return out.sort(function(a, b2){ return order[a.severity] - order[b2.severity]; });
}
