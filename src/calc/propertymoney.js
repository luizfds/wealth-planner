// ---------------- Property money: every dollar for a home or an investment says which property it's for (November 2026) ----------------
//
// A deposit, a building & pest report and a conveyancer's bill could only be one-offs — no line, no property — so a
// home purchase read as tens of thousands of unexplained spending, while the Buying card kept its own list of the same
// costs, ticked Paid by hand. Now a transaction can be for a property:
//   t.forProperty   a purchase in progress (state.purchases) or a property (state.properties) — its id
//   t.forCost       for a purchase: which of its costs it pays — a cost's id, or "deposit"
// An investment's own lines (p.expenses) are linked the usual way (t.linkedExpenseId); one with no line for it is
// forProperty alone. A budget line can be for a property too (line.propertyId): a home's rates or insurance stay
// household spending and wear its chip; a line for an investment is the property's (claimable, claims.js claimProperty).
//
// Property money that isn't a household line — a purchase's deposit and costs, an investment's costs — is kept out of
// spending: it's a property's, not the month's. Pure: the state is passed in; functions that change it return an undo.

function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
function lower(s){ return String(s || "").toLowerCase(); }

// Every property a dollar can be for: [{ id, kind: "purchase"|"home"|"investment", name, sub, purchase?, property? }].
export function propertyTargets(st){
  var out = [];
  ((st && st.purchases) || []).forEach(function(p){
    if(!p || !p.id) return;
    out.push({ id: p.id, kind: "purchase", home: p.kind !== "IP", name: p.what || "A purchase",
      sub: (p.kind === "IP" ? "Investment" : "Your home") + " · buying" + (p.settlementDate ? ", settles " + shortDate(p.settlementDate) : ""), purchase: p });
  });
  ((st && st.properties) || []).forEach(function(p){
    if(!p || !p.id || p.soldDate) return;
    var ip = p.kind === "IP";
    out.push({ id: p.id, kind: ip ? "investment" : "home", home: !ip, name: p.what || "A property", sub: ip ? "Investment" : "Your home", property: p });
  });
  return out;
}
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDate(iso){ iso = String(iso || ""); return iso.length >= 10 ? Number(iso.slice(8, 10)) + " " + MONTHS[Number(iso.slice(5, 7)) - 1] : iso; }
export function targetById(st, id){ return id ? propertyTargets(st).find(function(x){ return x.id === id; }) || null : null; }

// A purchase's costs to pick from: the deposit first, then its own costs.
export function purchaseCostChoices(p){
  return [{ id: "deposit", what: "Deposit" }].concat(((p && p.costs) || []).map(function(c){ return { id: c.id, what: c.what || "A cost" }; }));
}

// Which property an investment line belongs to: { lineId: property }.
function ipLineOwners(st){
  var by = {};
  ((st && st.properties) || []).forEach(function(p){ if(p && p.kind === "IP") (p.expenses || []).forEach(function(l){ if(l && l.id) by[l.id] = p; }); });
  return by;
}
// The lines of the household that are for a property (line.propertyId), with the property each names.
function homeLineOwners(st){
  var by = {}, targets = {};
  propertyTargets(st).forEach(function(x){ targets[x.id] = x; });
  ((st && st.shared) || []).forEach(function(l){ if(l && l.id && l.propertyId && targets[l.propertyId]) by[l.id] = targets[l.propertyId]; });
  return by;
}

// What a transaction is for, when it's a property's: { id, name, kind, home, what, capital } or null.
// `capital`: kept out of spending — a purchase's money, or an investment's (its line or none). A household line for a
// home (rates on where you live) is spending, and says which home.
export function propertyOf(t, st, cache){
  if(!t) return null;
  cache = cache || propertyCache(st);
  if(t.forProperty){
    var x = cache.targets[t.forProperty];
    if(!x) return { id: t.forProperty, name: "A property (deleted)", kind: "gone", home: false, what: "", capital: true };
    var what = t.forWhat || "";
    if(x.kind === "purchase") what = t.forCost === "deposit" ? "Deposit" : ((x.purchase.costs || []).find(function(c){ return c.id === t.forCost; }) || {}).what || "Purchase cost";
    else if(t.linkedExpenseId && cache.ip[t.linkedExpenseId]) what = cache.ip[t.linkedExpenseId].line.what || "";
    else if(!what) what = x.kind === "investment" ? "Other cost" : "";
    // A purchase's money stays the property's after it settles (t.forCost kept), even on a home.
    return { id: x.id, name: x.name, kind: x.kind, home: x.home, what: what, capital: x.kind !== "home" || !!t.forCost };
  }
  if(t.linkedExpenseId && cache.ip[t.linkedExpenseId]){
    var o = cache.ip[t.linkedExpenseId];
    return { id: o.p.id, name: o.p.what || "A property", kind: "investment", home: false, what: o.line.what || "", capital: true };
  }
  if(t.linkedExpenseId && cache.home[t.linkedExpenseId]){
    var h = cache.home[t.linkedExpenseId];
    return { id: h.id, name: h.name, kind: h.kind, home: h.home, what: "", capital: !h.home };
  }
  return null;
}
export function propertyCache(st){
  var targets = {}, ip = {};
  propertyTargets(st).forEach(function(x){ targets[x.id] = x; });
  var owners = ipLineOwners(st);
  Object.keys(owners).forEach(function(id){ ip[id] = { p: owners[id], line: owners[id].expenses.find(function(l){ return l.id === id; }) }; });
  return { targets: targets, ip: ip, home: homeLineOwners(st) };
}
// Property money that isn't the household's spending (a purchase's, an investment's).
export function isPropertyMoney(t, st, cache){ var o = propertyOf(t, st, cache); return !!(o && o.capital); }
// The transactions that are the household's spending: every one but a property's money. What a spending total sums —
// Today's month, Budget, Insights and the reports — so a house deposit isn't read as a month's spending (Transactions'
// own list already leaves it out: cashflowlist.js).
export function spendingTransactions(st){
  var cache = propertyCache(st);
  return ((st && st.transactions) || []).filter(function(t){ return !isPropertyMoney(t, st, cache); });
}

// The transactions that paid a purchase's cost ("deposit" for the deposit): oldest first.
export function costTransactions(st, purchaseId, costId){
  return ((st && st.transactions) || []).filter(function(t){ return t && t.forProperty === purchaseId && t.forCost === costId; })
    .sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}
// A purchase as its transactions say: each cost paid by a transaction takes its amount and date from it (a copy — the
// stored costs aren't changed). → { purchase, linked: { costId: [t] }, count, paidByTx }.
export function purchaseFromTransactions(st, p){
  var linked = {}, count = 0, paidByTx = 0;
  ((st && st.transactions) || []).forEach(function(t){
    if(!t || t.forProperty !== p.id || !t.forCost) return;
    (linked[t.forCost] = linked[t.forCost] || []).push(t); count++; paidByTx += num(t.amount);
  });
  var copy = Object.assign({}, p, { costs: (p.costs || []).map(function(c){
    var txs = linked[c.id];
    if(!txs) return c;
    var sum = Math.round(txs.reduce(function(s, t){ return s + num(t.amount); }, 0) * 100) / 100;
    return Object.assign({}, c, { paid: true, amount: sum, auto: false, tbc: false, byTx: txs.length });
  }) });
  return { purchase: copy, linked: linked, count: count, paidByTx: Math.round(paidByTx * 100) / 100 };
}

// Linking: target { type: "line", lineId } | { type: "oneoff" } | { type: "purchase", id, cost } | { type: "property", id, lineId? }.
// cost "new" adds a cost named after the transaction. A cost ticked Paid by hand from an account had its amount taken
// off that account's balance (purchase.js setCostPaid); the bank's own transaction now says it, so it's given back.
// opts.genId(prefix) for a new cost; opts.giveBack(purchase, cost) to put a hand-ticked cost's balance back.
export function linkTransaction(st, t, target, opts){
  opts = opts || {};
  var was = { linkedExpenseId: t.linkedExpenseId, forProperty: t.forProperty, forCost: t.forCost, category: t.category };
  var undoMore = [];
  delete t.forProperty; delete t.forCost;
  if(target.type === "line"){ t.linkedExpenseId = target.lineId || null; }
  else if(target.type === "oneoff"){ t.linkedExpenseId = null; }
  else if(target.type === "purchase"){
    var p = ((st.purchases) || []).find(function(x){ return x.id === target.id; });
    t.linkedExpenseId = null;
    if(p){
      var cost = target.cost;
      if(cost === "new"){
        var made = { id: opts.genId ? opts.genId("pc") : "pc" + Date.now().toString(36), what: t.what || "A cost", amount: num(t.amount), paid: true, kind: "purchase" };
        p.costs = p.costs || []; p.costs.push(made); cost = made.id;
        undoMore.push(function(){ var i = p.costs.indexOf(made); if(i !== -1) p.costs.splice(i, 1); });
      } else if(cost !== "deposit"){
        var c = (p.costs || []).find(function(x){ return x.id === cost; });
        if(c && num(c.paidTaken) > 0 && opts.giveBack){ var snap = Object.assign({}, c); opts.giveBack(p, c); undoMore.push(function(){ Object.assign(c, snap); }); }
      }
      t.forProperty = p.id; t.forCost = cost;
    }
  } else if(target.type === "property"){
    t.forProperty = target.id;
    t.linkedExpenseId = target.lineId || null;
  }
  return function(){
    undoMore.forEach(function(f){ f(); });
    ["linkedExpenseId", "forProperty", "forCost", "category"].forEach(function(k){ if(was[k] === undefined) delete t[k]; else t[k] = was[k]; });
  };
}

// What a link would do, in words, before it's made: [{ mark, text }] and a tone ("info" | "warn" | "plain").
export function linkEffect(st, t, target){
  var amt = "$" + num(t.amount).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var on = shortDate(t.date) + (t.account ? " from " + t.account : "");
  if(target.type === "purchase"){
    var x = targetById(st, target.id);
    if(!x) return { tone: "plain", lines: [] };
    if(target.cost === "new") return { tone: "info", lines: [["+", "Adds “" + (t.what || "this") + "” to the " + x.name + " purchase's costs, paid — " + amt + " on " + on + "."], ["◦", "Not spending: kept out of your budget and this month's figures."]] };
    var choice = purchaseCostChoices(x.purchase).find(function(c){ return c.id === target.cost; }) || { what: "A cost" };
    var already = costTransactions(st, x.id, target.cost).filter(function(o){ return o !== t; });
    var lines = already.length
      ? [["!", choice.what + " already has " + already.length + " transaction" + (already.length === 1 ? "" : "s") + " (" + already.map(function(o){ return shortDate(o.date); }).join(", ") + "). Link this too if it's another part of it."]]
      : [["✓", "Marks " + choice.what + " paid on the " + x.name + " purchase — " + amt + " on " + on + "."]];
    lines.push(["◦", "Not spending: kept out of your budget and this month's figures."]);
    var c = (x.purchase.costs || []).find(function(cc){ return cc.id === target.cost; });
    if(c && num(c.paidTaken) > 0) lines.push(["◦", "It was ticked Paid by hand from an account — that's given back, since the bank already has it."]);
    else lines.push(["◦", "No account's balance changes — the bank already has it."]);
    return { tone: already.length ? "warn" : "info", lines: lines };
  }
  if(target.type === "property"){
    var y = targetById(st, target.id);
    if(!y) return { tone: "plain", lines: [] };
    if(y.kind === "home") return { tone: "info", lines: [["✓", "For " + y.name + ". Your home's running costs are household spending — pick its budget line (rates, insurance) under Budget line to count it there."]] };
    var line = target.lineId ? (y.property.expenses || []).find(function(l){ return l.id === target.lineId; }) : null;
    return { tone: "info", lines: line
      ? [["✓", "Logged on " + y.name + "'s " + (line.what || "line") + " line."], ["◦", "Counts in the property's year and its rental schedule."], ["◦", "Not in your household budget."]]
      : [["✓", "A cost of " + y.name + " with no line — counted in the property's year."], ["◦", "Not in your household budget."]] };
  }
  if(target.type === "line") return { tone: "info", lines: [["✓", "Counts as spending on the line you pick, this month."]] };
  return { tone: "plain", lines: [["◦", "Spending on no line — kept out of the budget's figures, said apart. For something that isn't a property's: a new fridge, a gift."]] };
}

// ---------------- The app suggests the link ----------------
var PURCHASE_WORDS = [/\bdeposit\b/i, /conveyanc|lawyer|solicitor|legal|settlement agent/i, /building.{0,6}pest|pest.{0,6}inspect|building inspect/i,
  /stamp duty|transfer duty/i, /\blmi\b|mortgage insurance/i, /valuation|valuer/i, /strata (search|report)/i, /settlement|home purchase|house purchase/i];
function addressWords(name){ return lower(name).split(/[^a-z0-9]+/).filter(function(w){ return w.length > 2 && !/^(st|street|rd|road|ave|avenue|dr|drive|the|and|unit|home|house)$/.test(w) && !/^\d+$/.test(w); }); }
function merchantKey(t){ return lower(t.what || "").replace(/[^a-z ]+/g, " ").trim().split(/\s+/).slice(0, 2).join(" "); }
function addDays(iso, n){ var d = new Date(String(iso).slice(0, 10) + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// Transactions that look like a property's and aren't linked to one: [{ id, t, index, to: target, toName, cost?, costName?, why, now }].
// ok: state.tidyOk — "Not this property" is remembered ("inbox:prop|<tx id>").
export function propertySuggestions(st, today, ok){
  ok = ok || {};
  var cache = propertyCache(st), targets = propertyTargets(st), out = [];
  if(!targets.length) return out;
  var lineName = {};
  ((st.shared) || []).forEach(function(l){ if(l && l.id) lineName[l.id] = l.what || "a line"; });
  // A shop linked to an investment's line before: its next visits probably are too.
  var shopLine = {};
  ((st.transactions) || []).forEach(function(t){ if(t && t.linkedExpenseId && cache.ip[t.linkedExpenseId]){ var k = merchantKey(t); if(k) (shopLine[k] = shopLine[k] || {})[t.linkedExpenseId] = ((shopLine[k] || {})[t.linkedExpenseId] || 0) + 1; } });
  var since = addDays(today, -180);
  ((st.transactions) || []).forEach(function(t, i){
    if(!t || !t.date || t.date < since || t.forProperty || t.project || t.trip || num(t.amount) <= 0) return;
    if(t.linkedExpenseId && (cache.ip[t.linkedExpenseId] || cache.home[t.linkedExpenseId])) return;
    var key = "inbox:prop|" + (t.id || i);
    if(ok[key]) return;
    var text = (t.what || "") + " " + (t.description || ""), cat = lower(t.category);
    var hit = null;
    targets.forEach(function(x){
      if(hit) return;
      var words = addressWords(x.name);
      var named = words.length && words.some(function(w){ return lower(text).indexOf(w) !== -1; });
      if(x.kind === "purchase"){
        var p = x.purchase, from = p.contractDate ? addDays(p.contractDate, -120) : addDays(today, -180), to = p.settlementDate ? addDays(p.settlementDate, 60) : today;
        if(t.date < from || t.date > to) return;
        var word = PURCHASE_WORDS.find(function(w){ return w.test(text); });
        if(!(named || word || /purchase|buying/.test(cat))) return;
        var cost = guessCost(p, text);
        hit = { to: x, cost: cost, why: named ? "it mentions " + x.name + "." : word ? "“" + (text.match(word) || [""])[0].trim().toLowerCase() + "” reads like a purchase cost, and you're buying " + x.name + "." : "its category says it's for a purchase." };
      } else if(named){
        hit = { to: x, why: "it mentions " + x.name + "." };
      } else if(x.kind === "investment"){
        var seen = shopLine[merchantKey(t)];
        var mine = seen && Object.keys(seen).filter(function(id){ return cache.ip[id].p.id === x.id; }).sort(function(a, b){ return seen[b] - seen[a]; })[0];
        if(mine && seen[mine] >= 2) hit = { to: x, lineId: mine, why: "the same shop was linked to " + x.name + " " + seen[mine] + " times before." };
      }
    });
    if(!hit) return;
    var costName = hit.cost ? (purchaseCostChoices(hit.to.purchase).find(function(c){ return c.id === hit.cost; }) || {}).what : "";
    var lineWhat = hit.lineId ? cache.ip[hit.lineId].line.what : "";
    out.push({ id: key, t: t, index: i, to: hit.to, cost: hit.cost || "", costName: costName || "", lineId: hit.lineId || "", lineWhat: lineWhat || "", why: hit.why,
      now: t.linkedExpenseId ? (lineName[t.linkedExpenseId] || "a budget line") + " line" : "One-off" });
  });
  return out;
}
function guessCost(p, text){
  if(/\bdeposit\b/i.test(text)) return "deposit";
  var costs = p.costs || [];
  var by = function(re){ var c = costs.find(function(c){ return re.test(c.what || ""); }); return c ? c.id : ""; };
  if(/conveyanc|lawyer|solicitor|legal/i.test(text)) return by(/conveyanc|solicitor|legal/i);
  if(/building|pest|inspect/i.test(text)) return by(/building|pest|inspect/i);
  if(/stamp|transfer duty/i.test(text)) return by(/stamp|duty/i);
  if(/lmi|mortgage insurance/i.test(text)) return by(/lmi|mortgage insurance/i);
  if(/valu/i.test(text)) return by(/valu/i);
  return "";
}
// Household lines that read like a property's (rates, strata, home insurance, water, land tax) with more than one
// property they could be for: [{ id, line, home, investment }].
var PROPERTY_LINE = /rates|strata|body corp|land tax|home insurance|building insurance|landlord|water|levy|levies/i;
export function lineSuggestions(st, ok){
  ok = ok || {};
  var t = propertyTargets(st);
  var home = t.find(function(x){ return x.home; }), inv = t.find(function(x){ return x.kind === "investment"; });
  if(!home || t.length < 2) return [];
  return ((st.shared) || []).filter(function(l){ return l && l.id && !l.propertyId && !l.claimProperty && !l.endDate && PROPERTY_LINE.test(l.what || "") && !ok["inbox:propline|" + l.id]; })
    .map(function(l){ return { id: "inbox:propline|" + l.id, line: l, home: home, investment: inv || null }; });
}

// A budget line for a property. A home's stays the household's; an investment's is the property's — claimable
// (claims.js reads claimProperty). → undo.
export function setLineProperty(st, line, propertyId){
  var was = { propertyId: line.propertyId, claimProperty: line.claimProperty, deductible: line.deductible };
  var x = targetById(st, propertyId);
  if(!propertyId || !x){ delete line.propertyId; if(was.propertyId && line.claimProperty === was.propertyId){ delete line.claimProperty; delete line.deductible; } }
  else {
    line.propertyId = propertyId;
    if(x.kind === "investment"){ line.claimProperty = propertyId; line.deductible = true; }
    else if(line.claimProperty === was.propertyId){ delete line.claimProperty; delete line.deductible; }
  }
  return function(){ ["propertyId", "claimProperty", "deductible"].forEach(function(k){ if(was[k] === undefined) delete line[k]; else line[k] = was[k]; }); };
}

// ---------------- A property's money ----------------
// The financial year so far for a property: its transactions, its lines planned and spent. win: { start, end }.
// → { txs: [{ t, what }], spent, rentIn, lines: [{ id, what, planYear, spent }] }.
export function propertyYear(st, id, win, opts){
  opts = opts || {};
  var cache = propertyCache(st), x = cache.targets[id];
  var txs = ((st.transactions) || []).filter(function(t){ if(!t || !t.date || t.date < win.start || t.date > win.end) return false; var o = propertyOf(t, st, cache); return o && o.id === id; })
    .sort(function(a, b){ return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  var spent = txs.reduce(function(s, t){ return s + num(t.amount); }, 0);
  var lines = [];
  var own = x && x.property && x.kind === "investment" ? (x.property.expenses || []) : [];
  var household = ((st.shared) || []).filter(function(l){ return l && l.propertyId === id; });
  own.concat(household).forEach(function(l){
    var s = txs.filter(function(t){ return t.linkedExpenseId === l.id; }).reduce(function(a, t){ return a + num(t.amount); }, 0);
    lines.push({ id: l.id, what: l.what || "A line", line: l, planYear: opts.planOf ? opts.planOf(l) : 0, spent: Math.round(s * 100) / 100, household: household.indexOf(l) !== -1 });
  });
  var rentIn = ((st.incomeLog) || []).filter(function(r){ return r && r.date >= win.start && r.date <= win.end && String(r.target || "").indexOf(id) !== -1; })
    .reduce(function(s, r){ return s + num(r.amount); }, 0);
  return { txs: txs, spent: Math.round(spent * 100) / 100, rentIn: Math.round(rentIn * 100) / 100, lines: lines };
}

// At settlement: the purchase's costs as its transactions say, for the new property's cost base and the loan's
// borrowing costs; and the transactions that move to the property. → { costBase, rows: [{ what, amount, note }], txs }.
export function settlementCheck(st, p){
  var f = purchaseFromTransactions(st, p);
  var rows = (f.purchase.costs || []).filter(function(c){ return (c.kind || "purchase") !== "loan"; }).map(function(c){
    var txs = f.linked[c.id] || [];
    return { what: c.what || "Cost", amount: c.byTx ? num(c.amount) : null, raw: c, note: txs.length ? txs.length + " transaction" + (txs.length === 1 ? "" : "s") + " · " + txs.map(function(t){ return shortDate(t.date); }).join(", ") : c.paid ? "ticked paid" : "no transaction yet" };
  });
  var txs = ((st.transactions) || []).filter(function(t){ return t && t.forProperty === p.id; });
  return { rows: rows, txs: txs, linkedCount: f.count };
}
// After it settles, its transactions are the property's: forProperty points at the new property; the cost stays named.
// purchase: the purchase itself, when it's already left state.purchases (it has, once settlePurchase has run).
export function moveToProperty(st, purchaseId, propertyId, purchase){
  var moved = [];
  var p = purchase || ((st.purchases) || []).find(function(x){ return x.id === purchaseId; });
  ((st.transactions) || []).forEach(function(t){
    if(!t || t.forProperty !== purchaseId) return;
    moved.push({ t: t, what: t.forWhat });
    if(p && !t.forWhat) t.forWhat = (purchaseCostChoices(p).find(function(c){ return c.id === t.forCost; }) || {}).what || "";
    t.forProperty = propertyId;
  });
  ((st.shared) || []).forEach(function(l){ if(l && l.propertyId === purchaseId){ moved.push({ l: l }); l.propertyId = propertyId; } });
  return function(){ moved.forEach(function(m){ if(m.t){ m.t.forProperty = purchaseId; if(m.what === undefined) delete m.t.forWhat; else m.t.forWhat = m.what; } if(m.l) m.l.propertyId = purchaseId; }); };
}
