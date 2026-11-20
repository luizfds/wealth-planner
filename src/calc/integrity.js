// ---------------- Data integrity: records that disagree with each other (#453, November 2026) ----------------
//
// More checks for Settings → Checks (calc/health.js): read-only, each naming the exact record, where to fix it, and how
// sure it is (`confidence`: "certain" — the data contradicts itself; "likely"; "possible" — worth a look). Nothing here
// changes or deletes anything, nothing blocks an import, and nothing leaves the device: "Looks right" (health.js)
// dismisses one until it finds something different.
//
// They cover: income entered twice (not two rents with different names, and never the worked-out net-pay rows); a
// scenario's purchase plan against the home actually being bought; balances not updated in months, or never; dates that
// can't be; two accounts counting the same money; and a purchase whose figures don't agree (its deposit held, the
// lender's loan, a loan bigger than the price).
import { purchaseFigures } from "./purchase.js";
import { accountBalance, isAgentType } from "./accounts.js";

/** @param {any} v */
function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
/** @param {any[]} list @param {number} [max] */
function names(list, max){
  max = max || 4;
  var shown = list.slice(0, max).map(function(x){ return "“" + (x || "Untitled") + "”"; }).join(", ");
  return list.length > max ? shown + " and " + (list.length - max) + " more" : shown;
}
function plural(n, one, many){ return n + " " + (n === 1 ? one : (many || one + "s")); }
function money(n){ return "$" + Math.round(num(n)).toLocaleString("en-AU"); }
function days(a, b){
  var p = function(s){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null; };
  var x = p(a), y = p(b);
  return x == null || y == null ? null : Math.round(y - x);
}
// A row the app works out itself (net pay after tax, a one-off, a PM fee): never one of a duplicate pair.
function workedOut(r){ return !!(r && (r.computed || r.syntheticNetFor || r.syntheticOneOffFor || r.syntheticEndingFor)); }
function same(a, b){ return Math.abs(num(a) - num(b)) <= Math.max(1, Math.abs(num(a)) * 0.01); }

export function integrityChecks(st, today){
  var out = [], add = function(c){ out.push(c); };

  // ---- Income entered twice ----
  var key = function(r){ return [String(r.what || "").trim().toLowerCase(), Math.round(num(r.amount) * 100), r.freq || "", r.person || r.owner || ""].join("|"); };
  var seen = {}, dups = [];
  (st.income || []).forEach(function(r){
    if(workedOut(r) || !String(r.what || "").trim() || !(num(r.amount) > 0)) return;
    var k = key(r);
    if(seen[k]) dups.push(r.what); else seen[k] = true;
  });
  if(dups.length) add({ id: "int-dup-income", severity: "warn", confidence: "likely", title: plural(dups.length, "income line") + (dups.length === 1 ? " that looks" : " that look") + " entered twice",
    detail: names(dups) + " — the same name, amount and frequency as another line. Two jobs or two rents with different names aren't counted here.",
    where: { page: "expenses", sub: "income", label: "Open income" } });
  // A typed pay line beside the net pay the app works out for the same person: the pay counted twice.
  (st.income || []).filter(function(r){ return r.syntheticNetFor; }).forEach(function(net){
    var twin = (st.income || []).find(function(r){
      return !workedOut(r) && r !== net && (r.person === net.syntheticNetFor || new RegExp("\\b" + String(net.syntheticNetFor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(r.what || "")) &&
        /pay|salary|wage|net/i.test(r.what || "") && (r.freq || "") === (net.freq || "") && same(r.amount, net.amount);
    });
    if(twin) add({ id: "int-net-twin:" + net.syntheticNetFor, severity: "warn", confidence: "possible", title: net.syntheticNetFor + "'s pay may be counted twice",
      detail: "“" + twin.what + "” is about the same as the net income worked out from " + net.syntheticNetFor + "'s salary (" + money(net.amount) + " " + String(net.freq || "").toLowerCase() + "). If it's the same pay, remove the typed line.",
      where: { page: "expenses", sub: "income", label: "Open income" } });
  });
  // The same rent twice on one property (two streams with different names are fine).
  (st.properties || []).forEach(function(p){
    var s2 = {}, d2 = [];
    (p.income || []).forEach(function(r){ if(workedOut(r) || !(num(r.amount) > 0)) return; var k = key(r); if(s2[k]) d2.push(r.what); else s2[k] = true; });
    if(d2.length) add({ id: "int-dup-rent:" + p.id, severity: "warn", confidence: "likely", title: (p.what || "A property") + ": " + plural(d2.length, "income line") + " entered twice",
      detail: names(d2) + " — same name, amount and frequency. Separate rents (a granny flat, parking) with their own names are fine.", where: { page: "properties" } });
  });

  // ---- A scenario's purchase plan against the home actually being bought (neither is changed) ----
  var plans = st.purchase || {};
  var enabled = Object.keys(plans).filter(function(n){ return plans[n] && plans[n].enabled && num(plans[n].price) > 0; });
  (st.purchases || []).forEach(function(p){
    var name = p.fromPlan && plans[p.fromPlan] ? p.fromPlan : enabled.length === 1 && (st.purchases || []).length === 1 ? enabled[0] : "";
    if(!name) return;
    var plan = plans[name], off = [];
    if(num(p.price) > 0 && !same(plan.price, p.price)) off.push("price " + money(plan.price) + " planned, " + money(p.price) + " agreed");
    var planDeposit = num(plan.price) * num(plan.depositPct) / 100;
    if(planDeposit > 0 && num(p.deposit) > 0 && !same(planDeposit, p.deposit)) off.push("deposit " + money(planDeposit) + " planned, " + money(p.deposit) + " paid");
    if(num(plan.rate) > 0 && num(p.rate) > 0 && Math.abs(num(plan.rate) - num(p.rate)) >= 0.05) off.push("rate " + plan.rate + "% planned, " + p.rate + "% offered");
    if(off.length) add({ id: "int-plan-buy:" + p.id + ":" + name, severity: "info", confidence: "certain", title: "The plan “" + name + "” and " + (p.what || "the home being bought") + " differ",
      detail: off.join("; ") + ". Neither is changed — update the scenario if its projections should follow what's real.", where: { page: "plan", sub: "scenarios", label: "Open the plan" } });
  });

  // ---- Balances not updated in months, or never ----
  var stale = [], never = [];
  (st.accounts || []).forEach(function(a){
    if(!a || isAgentType(a.type) || a.type === "loan") return;
    var b = accountBalance(a);
    // A card or loan with nothing recorded may simply owe nothing: only money held is said to be missing.
    if(b.balance == null){ if(["everyday", "savings", "offset"].indexOf(a.type) !== -1) never.push(a.name); return; }
    var age = b.date ? days(b.date, today) : null;
    if(age != null && age > 90) stale.push(a.name + " (" + age + " days)");
  });
  if(stale.length) add({ id: "int-stale", severity: "info", confidence: "likely", title: plural(stale.length, "balance") + " not updated in over three months",
    detail: names(stale) + ". Net worth and the forecasts use the last balance recorded — update it, or import a statement.", where: { page: "accounts", label: "Open Accounts" } });
  if(never.length) add({ id: "int-no-balance", severity: "info", confidence: "certain", title: plural(never.length, "account") + " with no balance",
    detail: names(never) + " — counted as nothing in net worth until a balance is recorded.", where: { page: "accounts", label: "Open Accounts" } });

  // ---- Dates that can't be ----
  var bad = [];
  (st.properties || []).forEach(function(p){ var d = days(today, p.purchaseDate); if(d != null && d > 0) bad.push((p.what || "A property") + " bought on " + p.purchaseDate + ", after today"); });
  (st.purchases || []).forEach(function(p){
    var d = days(p.contractDate, p.settlementDate);
    if(d != null && d < 0) bad.push((p.what || "A purchase") + " settles (" + p.settlementDate + ") before its contract (" + p.contractDate + ")");
    var c = days(today, p.contractDate);
    if(c != null && c > 0) bad.push((p.what || "A purchase") + "'s contract is dated " + p.contractDate + ", after today");
  });
  if(bad.length) add({ id: "int-dates", severity: "warn", confidence: "certain", title: plural(bad.length, "property date") + " that can't be right",
    detail: bad.slice(0, 4).join("; ") + (bad.length > 4 ? "; and " + (bad.length - 4) + " more" : "") + ".", where: { page: "properties" } });
  var born = [], settings = (st.tax && st.tax.settings) || {};
  Object.keys(settings).forEach(function(person){
    var dob = settings[person] && settings[person].dateOfBirth, d = days(today, dob);
    if(d != null && d > 0) born.push(person + "'s (" + dob + ") is after today");
    else if(d != null && d < -120 * 366) born.push(person + "'s (" + dob + ") is over 120 years ago");
  });
  if(born.length) add({ id: "int-dob", severity: "warn", confidence: "certain", title: plural(born.length, "date of birth", "dates of birth") + " that can't be right",
    detail: born.join("; ") + ". Ages drive super, the pension age and tax offsets.", where: { page: "tax", sub: "people" } });

  // ---- Two accounts counting the same money ----
  var byLink = {}, shared = [];
  (st.accounts || []).forEach(function(a){ if(!a || !a.link) return; (byLink[a.link] = byLink[a.link] || []).push(a.name); });
  Object.keys(byLink).forEach(function(l){ if(byLink[l].length > 1) shared.push(byLink[l].join(" and ")); });
  if(shared.length) add({ id: "int-shared-source", severity: "warn", confidence: "certain", title: plural(shared.length, "balance") + " shown by two accounts",
    detail: shared.slice(0, 3).join("; ") + " point at the same balance — updating one changes the other, and lists show it twice. Keep one.", where: { page: "accounts", label: "Open Accounts" } });
  // A Cash asset with an account's name and balance, not linked to it: the same money counted twice in net worth.
  var linkedAssets = {};
  (st.accounts || []).forEach(function(a){ if(a && /^asset:/.test(a.link || "")) linkedAssets[a.link.slice(6)] = a; });
  var twins = [];
  (st.assets || []).forEach(function(x){
    if(!x || x.category !== "Cash" || linkedAssets[x.id] || x.depositFor) return;
    var acct = (st.accounts || []).find(function(a){ return a && a.name && String(a.name).trim().toLowerCase() === String(x.what || "").trim().toLowerCase() && /^asset:/.test(a.link || ""); });
    var b = acct && accountBalance(acct).balance;
    if(acct && b != null && same(b, x.amount)) twins.push(x.what);
  });
  if(twins.length) add({ id: "int-twin-cash", severity: "warn", confidence: "possible", title: plural(twins.length, "cash balance") + " that may be counted twice",
    detail: names(twins) + " — a Cash asset with the same name and amount as an account's own balance. If it's the same money, remove the asset.", where: { page: "assets", label: "Open Net worth" } });

  // ---- A purchase whose figures don't agree ----
  (st.purchases || []).forEach(function(p){
    var issues = [], f = purchaseFigures(p, today, null);
    var held = (st.assets || []).find(function(a){ return a && a.id === p.depositAssetId; });
    if(num(p.deposit) > 0 && (!held || !same(held.amount, p.deposit))) issues.push("the deposit held in net worth is " + money(held ? held.amount : 0) + ", not the " + money(p.deposit) + " paid");
    if(f.lender && Math.abs(f.lender.variance) >= 1) issues.push("the lender's loan is " + money(f.lender.gross) + ", the loan and fees added to it " + money(f.lender.own));
    if(f.price > 0 && f.deposit + f.loan > f.price * 1.1 + 1) issues.push("the deposit and loan (" + money(f.deposit + f.loan) + ") come to well over the price");
    if(f.lvr != null && f.lvr > 1) issues.push("the loan is more than the price");
    if(issues.length) add({ id: "int-purchase:" + p.id, severity: "warn", confidence: "certain", title: (p.what || "The home being bought") + ": figures that don't agree",
      detail: issues.join("; ") + ".", where: { page: "properties", label: "Open the purchase" } });
  });
  return out;
}
