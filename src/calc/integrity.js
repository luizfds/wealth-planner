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
//
// November 2026, from what a real backup got wrong that nothing said: a loan amount that already holds a fee added to
// the loan; budget lines far from what's spent (both ways, calc/trim.js); a property manager's account typed as an
// ordinary one. These, and the plan against the purchase, carry a `fix` — one tap, with an undo
// (components/taxwiring.js) — but still change nothing until it's pressed.
import { purchaseFigures, loanHoldsFees } from "./purchase.js";
import { accountBalance, isAgentType, accountTypeLabel } from "./accounts.js";
import { looksLikeAgentAccount } from "./agentstatement.js";
import { trimReport, spendingDrift } from "./trim.js";
import { strays } from "./tidy.js";

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

  // ---- The same row at two amounts: one row edited on two devices and kept twice by a sync merge (calc/syncmerge.js
  // matches them by what they are now, but a household merged before has them). Same name, frequency and whose. ----
  var split = [];
  var splitIn = function(list, where){
    var byKey = {};
    (list || []).forEach(function(r){
      if(!r || workedOut(r) || !String(r.what || "").trim()) return;
      var k = [String(r.what).trim().toLowerCase(), r.freq || "", r.person || ""].join("|");
      (byKey[k] = byKey[k] || []).push(r);
    });
    Object.keys(byKey).forEach(function(k){
      var rows = byKey[k];
      if(rows.length > 1 && !rows.every(function(r){ return same(r.amount, rows[0].amount); }))
        split.push({ where: where, text: "“" + rows[0].what + "” " + rows.map(function(r){ return money(r.amount); }).join(" and ") + " " + String(rows[0].freq || "").toLowerCase() });
    });
  };
  splitIn(st.income, "income"); splitIn(st.shared, "budget");
  Object.keys(st.home || {}).forEach(function(sc){ splitIn(st.home[sc], "budget"); });
  (st.properties || []).forEach(function(p){ splitIn(p.income, "property"); splitIn(p.expenses, "property"); });
  if(split.length) add({ id: "int-split-rows", severity: "warn", confidence: "possible", title: plural(split.length, "line") + " that may be one line twice, at two amounts",
    detail: split.slice(0, 3).map(function(x){ return x.text; }).join("; ") + (split.length > 3 ? "; and " + (split.length - 3) + " more" : "") +
      ". Often one line edited on two devices and kept twice by a sync — both are counted. If it's one, delete the one that's out of date.",
    where: split[0].where === "property" ? { page: "properties" } : { page: "expenses", sub: split[0].where === "income" ? "income" : "budget", label: split[0].where === "income" ? "Open income" : "Open the budget" } });

  // ---- A scenario's purchase plan against the home actually being bought (neither is changed) ----
  var plans = st.purchase || {};
  (st.purchases || []).forEach(function(p){
    var name = planForPurchase(st, p);
    if(!name) return;
    var plan = plans[name], off = [], far = false;
    // More than a tenth apart is a plan that has fallen behind what's real: said as a warning, not a note.
    var apart = function(a, b){ return Math.abs(num(a) - num(b)) > Math.abs(num(b)) * 0.1; };
    if(num(p.price) > 0 && !same(plan.price, p.price)){ off.push("price " + money(plan.price) + " planned, " + money(p.price) + " agreed"); far = far || apart(plan.price, p.price); }
    var planDeposit = num(plan.price) * num(plan.depositPct) / 100;
    if(planDeposit > 0 && num(p.deposit) > 0 && !same(planDeposit, p.deposit)){ off.push("deposit " + money(planDeposit) + " planned, " + money(p.deposit) + " paid"); far = far || apart(planDeposit, p.deposit); }
    if(num(plan.rate) > 0 && num(p.rate) > 0 && Math.abs(num(plan.rate) - num(p.rate)) >= 0.05) off.push("rate " + plan.rate + "% planned, " + p.rate + "% offered");
    if(off.length) add({ id: "int-plan-buy:" + p.id + ":" + name, severity: far ? "warn" : "info", confidence: "certain", title: "The plan “" + name + "” and " + (p.what || "the home being bought") + " differ",
      detail: off.join("; ") + ". The scenario's projections still use what's planned — set the plan to what's real, or leave it if the plan is the point.",
      where: { page: "plan", sub: "scenarios", label: "Open the plan" }, fix: { label: "Set the plan to these", kind: "plan-from-purchase", arg: p.id } });
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

  // ---- A loan amount that already holds a fee added to the loan: borrowed twice ----
  (st.purchases || []).forEach(function(p){
    var h = loanHoldsFees(p);
    if(!h) return;
    add({ id: "int-loan-fees:" + p.id, severity: "warn", confidence: "likely", title: (p.what || "The home being bought") + ": a fee may be in the loan twice",
      detail: "The loan amount, " + money(p.loanAmount) + ", is " + money(h.base) + " and " + names(h.fees) + " (" + money(h.amount) + ") — and " + (h.fees.length === 1 ? "that fee is" : "those fees are") +
        " also marked “Added to the loan”, so " + (h.fees.length === 1 ? "it's" : "they're") + " borrowed twice and the cash to bring comes out " + money(h.amount) + " too low. If " + money(p.loanAmount) +
        " is the lender's figure, it goes in “Lender's approved loan”, and " + money(h.base) + " in “Loan amount”.",
      where: { page: "properties", label: "Open the purchase" }, fix: { label: "Move it to the lender's figure", kind: "loan-holds-fees", arg: p.id } });
  });

  // ---- Budget lines far from what's spent, either way (Trim finds them; here so they're not missed) ----
  var trim = trimReport({ state: st, today: today });
  var drift = spendingDrift(trim), under = trim.under || [];
  if(drift.length){
    var said = drift.slice(0, 3).map(function(x){ return "“" + x.what + "” " + money(x.planned) + " planned, " + money(x.actual) + " spent"; });
    add({ id: "int-budget-drift", severity: "info", confidence: "likely", title: plural(drift.length, "budget line") + " far from what you spend",
      detail: said.join("; ") + (drift.length > 3 ? "; and " + (drift.length - 3) + " more" : "") + " — a year, over the last " + Math.round(trim.months) + " months. Every scenario plans with the budget" +
        (under.length ? (drift.length > under.length ? " — these make it look better than it is in some places and worse in others." : " — these make it look better than it is.") : " — these make it look worse than it is."),
      where: { page: "expenses", sub: "budget", label: "Open the budget" }, fix: { label: "Set " + (drift.length === 1 ? "it" : "all " + drift.length) + " to what you spend", kind: "budget-to-spending" } });
  }

  // ---- Purchases that look filed on the wrong line (Budget → Tidy up, calc/tidy.js) ----
  // A shop nearly always on one line with a purchase or two on another. "It's right" there keeps a pair quiet for good.
  var misfiled = strays(st.transactions, (st.shared || []).filter(function(l){ return l && !l.computed; }), { today: today, ok: st.tidyOk || {}, trips: st.trips || [] });
  if(misfiled.length){
    var lineName = {};
    (st.shared || []).forEach(function(l){ if(l && l.id) lineName[l.id] = l.what || "a line"; });
    var nMis = misfiled.reduce(function(a, x){ return a + x.count; }, 0);
    add({ id: "int-misfiled", severity: "info", confidence: "possible", title: plural(nMis, "purchase") + (nMis === 1 ? " that looks" : " that look") + " filed on the wrong line",
      detail: misfiled.slice(0, 3).map(function(x){ return "“" + x.label + "” on " + lineName[x.fromLineId] + " (usually " + lineName[x.toLineId] + ")"; }).join("; ") +
        (misfiled.length > 3 ? "; and " + (misfiled.length - 3) + " more" : "") + ". Budget → Tidy up moves them, or keeps one where it is.",
      where: { page: "expenses", sub: "budget", label: "Open Tidy up" }, fix: { label: "Move " + (nMis === 1 ? "it" : "them") + " to the usual line", kind: "tidy-strays" } });
  }

  // ---- A property manager's account typed as an ordinary one ----
  var agents = (st.properties || []).length ? (st.accounts || []).filter(looksLikeAgentAccount) : [];
  if(agents.length) add({ id: "int-agent-type", severity: "info", confidence: "possible", title: plural(agents.length, "account") + " that may be a property manager's",
    detail: names(agents.map(function(a){ return a.name; })) + " — named like one, but typed " + (agents.length === 1 ? "“" + accountTypeLabel(agents[0].type) + "”, an account" : "as accounts") + " of your own: it can count as your money, and the bills on the manager's statements don't land on it.",
    where: { page: "accounts", label: "Open Accounts" }, fix: { label: agents.length === 1 ? "Make it a property manager's" : "Make them property managers'", kind: "agent-account" } });

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

// The scenario plan a purchase is measured against: the one it was started from, else the only plan to buy when there's
// one purchase. "" when it can't be said.
export function planForPurchase(st, p){
  var plans = st.purchase || {};
  if(p && p.fromPlan && plans[p.fromPlan]) return p.fromPlan;
  var enabled = Object.keys(plans).filter(function(n){ return plans[n] && plans[n].enabled && num(plans[n].price) > 0; });
  return enabled.length === 1 && (st.purchases || []).length === 1 ? enabled[0] : "";
}
