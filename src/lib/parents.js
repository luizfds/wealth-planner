// ---------------- Where each screen lives (#425) ----------------
//
// Every inner screen has one parent: the page you'd go "up" to. The header's back link uses it when there is no
// screen of the app's own to go back to (a deep link, a reopened tab), the desktop breadcrumb is the chain of them, and
// the menu lights the section at the top of the chain — so a holding's Details lights Net worth, not nothing.
//
// Pure: a view ({ page, sub, detail: { kind, id } }) and the household in, a view out. No DOM, no history.

var ASSET_SUBS = ["Cash", "Shares", "Super", "Vehicle", "Other"];

function detailParent(detail, st){
  var kind = detail && detail.kind, id = detail && detail.id;
  if(kind === "transaction" || kind === "merchant") return { page: "expenses", sub: "spending", title: "Transactions" };
  if(kind === "income") return { page: "expenses", sub: "income", title: "Money in" };   // #427: the top of Budget
  if(kind === "line") return { page: "expenses", sub: "budget", title: "Budget" };
  if(kind === "account" || kind === "debt") return { page: "accounts", sub: null, title: "Accounts" };
  if(kind === "asset"){
    var a = ((st && st.assets) || []).find(function(x){ return x.id === id; });
    var cat = a && ASSET_SUBS.indexOf(a.category) !== -1 ? a.category : a ? "Other" : "Cash";
    return { page: "assets", sub: cat, title: cat };
  }
  if(kind === "property" || kind === "loan") return { page: "properties", sub: null, title: "Property" };
  if(kind === "person") return { page: "tax", sub: "people", title: "People" };
  if(kind === "scenario") return { page: "plan", sub: "scenarios", title: "Scenarios" };
  return null;
}

export function parentOf(view, st){
  if(!view) return null;
  var p = view.page, sub = view.sub;
  if(p === "dashboard") return sub && sub !== "overview" ? { page: "dashboard", sub: "overview", title: "Today" } : null;
  if(p === "accounts" || p === "assets" || p === "properties") return { page: "networth", sub: null, title: "Net worth" };
  if(p === "tax" || p === "reports" || p === "calc" || p === "settings") return { page: "more", sub: null, title: "More" };
  if(p === "scenario") return { page: "plan", sub: "scenarios", title: "Scenarios" };
  if(p === "detail") return detailParent(view.detail, st);
  return null;
}

// The chain above a view, the top first: [Net worth, Shares] for a holding's Details.
export function ancestorsOf(view, st){
  var out = [], seen = 0;
  for(var p = parentOf(view, st); p && seen < 6; p = parentOf(p, st), seen++) out.unshift(p);
  return out;
}

// The section a view belongs to in the menu: the page at the top of its chain, or its own.
export function sectionOf(view, st){
  var chain = ancestorsOf(view, st);
  return chain.length ? chain[0].page : view.page;
}
