// ---------------- Net worth, one list (v3.129.0) ----------------
//
// What the household owns and owes was spread over three pages — Accounts, Investments, Property —
// each with its own list, and debts split between them (cards on Accounts, property loans on
// Property, personal loans under Investments). This is the one list: Cash · Investments · Super ·
// Property · Other things · Debts, each row with what it's worth and where it goes for detail.
// Offsets count as cash; property is shown at its value, its loans under Debts. The total is the
// header's net worth. Pure apart from reading state through the passed-in helpers.

// st: state. toAud(asset, amount). Returns { groups: [{ key, label, rows: [{ kind, id, name, sub, value }], total }], total }.
export function netWorthList(st, toAud){
  toAud = toAud || function(a, v){ return v; };
  var G = { cash: [], invest: [], super: [], property: [], other: [], debts: [] };
  (st.assets || []).forEach(function(a){
    if(!a) return;
    var v = toAud(a, Number(a.amount) || 0), c = a.category || "Other";
    var row = { kind: "asset", id: a.id, name: a.what || a.symbol || c, sub: [c === "Shares" && a.symbol ? a.symbol : null, a.person || null].filter(Boolean).join(" · "), value: v };
    if(c === "Cash") G.cash.push(row);
    else if(c === "Shares") G.invest.push(row);
    else if(c === "Super") G.super.push(row);
    else G.other.push(Object.assign(row, { sub: [c, a.person || null].filter(Boolean).join(" · ") }));
  });
  (st.properties || []).forEach(function(p){
    G.property.push({ kind: "property", id: p.id, name: p.what || "Property", sub: p.kind === "IP" ? "Investment" : "Home", value: Number(p.value) || 0 });
    (p.loans || []).forEach(function(l, i){
      // As the header's net worth counts them: a paid-out loan owes nothing; an offset is cash.
      var paid = l.endedOn && l.endedOn <= new Date().toISOString().slice(0, 10);
      var bal = paid ? 0 : Number(l.balance) || 0, off = Number(l.offsetBalance) || 0;
      if(off) G.cash.push({ kind: "loan", id: l.id, name: (p.what || "Property") + " offset", sub: "Offset", value: off });
      if(bal) G.debts.push({ kind: "loan", id: l.id, name: l.what || (p.what || "Property") + " loan" + ((p.loans || []).length > 1 ? " " + (i + 1) : ""), sub: "Property loan", value: -bal });
    });
  });
  (st.debts || []).forEach(function(d){
    var b = Number(d.balance) || 0;
    if(b) G.debts.push({ kind: "debt", id: d.id, name: d.what || "Debt", sub: "Card or personal loan", value: -b });
  });
  var LABELS = { cash: "Cash", invest: "Investments", super: "Super", property: "Property", other: "Other things", debts: "Debts" };
  var groups = Object.keys(LABELS).map(function(k){
    var rows = G[k].sort(function(x, y){ return Math.abs(y.value) - Math.abs(x.value); });
    return { key: k, label: LABELS[k], rows: rows, total: Math.round(rows.reduce(function(s, r){ return s + r.value; }, 0) * 100) / 100 };
  }).filter(function(g){ return g.rows.length; });
  return { groups: groups, total: Math.round(groups.reduce(function(s, g){ return s + g.total; }, 0) * 100) / 100 };
}
