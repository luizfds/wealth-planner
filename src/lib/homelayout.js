// ---------------- A Home you arrange (v3.165.0, item 195) ----------------
//
// Home → Overview's cards in the order you want, the ones you don't want hidden, and any Insights
// panel brought onto Home. Per device, like the theme — it's how you read, not what's in your data —
// so it lives in localStorage and never in state or the sync file. Hiding a card hides the card,
// nothing else: a bill due still reaches the bell, which reads the data, not the page.
//
// Cards carry data-home-card="<key>" (home.js, dashboard.js); an Insights panel is moved — not
// copied — into Home while it's pinned, so the renderer that fills it by id keeps filling it.

var KEY = "wealthPlanner.homeLayout";

export var HOME_CARDS = [
  { key: "week", label: "Your week (Mondays, above the cards)", group: "strip" },
  { key: "autopay", label: "Automatic payments to confirm (on the day)", group: "strip" },
  { key: "lowbal", label: "Balance ahead (when an account nears its buffer)", group: "strip" },
  { key: "nw", label: "Net worth", group: "cards" },
  { key: "month", label: "This month", group: "cards" },
  { key: "bills", label: "Bills — next 2 weeks", group: "cards" },
  { key: "todo", label: "To do", group: "cards" },
  { key: "goals", label: "Goals (under the cards)", group: "strip" },
  { key: "savings", label: "Net savings", group: "figures" },
  { key: "projected", label: "Projected net worth", group: "figures" },
  { key: "runway", label: "Runway", group: "figures" },
  { key: "fi", label: "Financial independence", group: "figures" },
  { key: "tax", label: "Tax return", group: "figures" },
  { key: "scenarios", label: "Scenarios", group: "figures" }
];
// Insights panels that can come onto Home, by the id of the element their renderer fills.
export var INSIGHT_PANELS = [
  { id: "adviceHome", label: "What the app notices" },
  { id: "rulePanel", label: "The 50/30/20 rule" },
  { id: "acctPanel", label: "Monthly expenses by account" },
  { id: "firePanel", label: "Financial independence (detail)" },
  { id: "actualVsExpectedPanel", label: "Actual vs. expected" },
  { id: "cashFlowForecastPanel", label: "12-month cash flow forecast" },
  { id: "projectionAccuracyPanel", label: "How the projection has tracked" },
  { id: "monthlyCashFlowPanel", label: "Income vs spending" },
  { id: "contributionsGrowthPanel", label: "Saved vs grown" }
];

export function loadHomeLayout(){
  try{ var l = JSON.parse(localStorage.getItem(KEY) || "null"); if(l && typeof l === "object") return normaliseLayout(l); }catch(e){}
  return normaliseLayout({});
}
export function saveHomeLayout(l){
  try{ localStorage.setItem(KEY, JSON.stringify(normaliseLayout(l))); }catch(e){}
}
// Every known card exactly once, in the saved order and then any new ones in their default place.
export function normaliseLayout(l){
  l = l || {};
  var known = HOME_CARDS.map(function(c){ return c.key; });
  var order = (Array.isArray(l.order) ? l.order : []).filter(function(k, i, a){ return known.indexOf(k) !== -1 && a.indexOf(k) === i; });
  known.forEach(function(k){ if(order.indexOf(k) === -1) order.push(k); });
  var hidden = {};
  Object.keys(l.hidden || {}).forEach(function(k){ if(l.hidden[k] && known.indexOf(k) !== -1) hidden[k] = true; });
  var ids = INSIGHT_PANELS.map(function(p){ return p.id; });
  var pinned = (Array.isArray(l.pinned) ? l.pinned : []).filter(function(id, i, a){ return ids.indexOf(id) !== -1 && a.indexOf(id) === i; });
  return { order: order, hidden: hidden, pinned: pinned };
}
// Up or down one place among the cards of its own group.
export function moveCard(l, key, dir){
  l = normaliseLayout(l);
  var group = (HOME_CARDS.find(function(c){ return c.key === key; }) || {}).group;
  var same = l.order.filter(function(k){ return (HOME_CARDS.find(function(c){ return c.key === k; }) || {}).group === group; });
  var i = same.indexOf(key), j = i + dir;
  if(i === -1 || j < 0 || j >= same.length) return l;
  var a = l.order.indexOf(same[i]), b = l.order.indexOf(same[j]);
  l.order[a] = same[j]; l.order[b] = same[i];
  return l;
}

// Puts the page in the saved arrangement. Idempotent: called after each render of Home's cards.
export function applyHomeLayout(){
  if(typeof document === "undefined") return;
  var l = loadHomeLayout();
  [document.querySelector("#homeSummary .home-grid"), document.getElementById("dashboardStats")].forEach(function(box){
    if(!box) return;
    l.order.forEach(function(k){ var el = box.querySelector(':scope > [data-home-card="' + k + '"]'); if(el) box.appendChild(el); });
  });
  document.querySelectorAll("[data-home-card]").forEach(function(el){ el.hidden = !!l.hidden[el.getAttribute("data-home-card")]; });
  var home = document.getElementById("homePinned");
  if(!home) return;
  INSIGHT_PANELS.forEach(function(p){
    var el = document.getElementById(p.id);
    if(!el) return;
    if(!el.dataset.homeHome){ el.dataset.homeHome = "1"; el.__homeParent = el.parentElement; el.__homeNext = el.nextElementSibling; }
    var want = l.pinned.indexOf(p.id) !== -1;
    if(want && el.parentElement !== home) home.appendChild(el);
    else if(!want && el.parentElement === home && el.__homeParent){
      if(el.__homeNext && el.__homeNext.parentElement === el.__homeParent) el.__homeParent.insertBefore(el, el.__homeNext); else el.__homeParent.appendChild(el);
    }
  });
  l.pinned.forEach(function(id){ var el = document.getElementById(id); if(el && el.parentElement === home) home.appendChild(el); });
  home.hidden = !l.pinned.length;
}

// The Arrange sheet.
export function homeArrangeHtml(){
  var l = loadHomeLayout();
  var section = function(group, title){
    var keys = l.order.filter(function(k){ return (HOME_CARDS.find(function(c){ return c.key === k; }) || {}).group === group; });
    return '<h5 class="ha-title">' + title + '</h5><ul class="ha-list">' + keys.map(function(k, i){
      var c = HOME_CARDS.find(function(x){ return x.key === k; });
      return '<li class="ha-row"><label class="pref-check"><input type="checkbox" data-ha-show="' + k + '"' + (l.hidden[k] ? '' : ' checked') + '> ' + c.label + '</label>' +
        '<span class="ha-move"><button type="button" class="icon-btn" data-ha-move="' + k + '" data-ha-dir="-1" aria-label="Move ' + c.label + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button type="button" class="icon-btn" data-ha-move="' + k + '" data-ha-dir="1" aria-label="Move ' + c.label + ' down"' + (i === keys.length - 1 ? ' disabled' : '') + '>↓</button></span></li>';
    }).join("") + (group === "cards" ? strip() : "") + '</ul>';
  };
  // The week card and the goals strip sit above and under the cards whatever their order: they can
  // be hidden, not moved.
  var strip = function(){
    return HOME_CARDS.filter(function(c){ return c.group === "strip"; }).map(function(c){
      return '<li class="ha-row"><label class="pref-check"><input type="checkbox" data-ha-show="' + c.key + '"' + (l.hidden[c.key] ? '' : ' checked') + '> ' + c.label + '</label></li>';
    }).join("");
  };
  return '<div class="review-backdrop" data-ha-backdrop><div class="review-panel ha-panel" role="dialog" aria-modal="true" aria-label="Arrange Home">' +
    '<div class="review-head"><h4>Arrange Home</h4><button type="button" class="icon-btn" data-ha-close aria-label="Close">✕</button></div>' +
    section("cards", "Cards") + section("figures", "Figures") +
    '<h5 class="ha-title">From Insights</h5><ul class="ha-list">' + INSIGHT_PANELS.map(function(p){
      return '<li class="ha-row"><label class="pref-check"><input type="checkbox" data-ha-pin="' + p.id + '"' + (l.pinned.indexOf(p.id) !== -1 ? ' checked' : '') + '> ' + p.label + '</label></li>';
    }).join("") + '</ul>' +
    '<p class="ledger-note" style="margin:8px 0 0">Kept on this device. A hidden card still sends its reminders to the bell.</p>' +
    '<div class="txr-actions"><button type="button" class="btn btn-ghost" data-ha-reset>Back to the default</button><button type="button" class="btn btn-primary" data-ha-close>Done</button></div></div></div>';
}
