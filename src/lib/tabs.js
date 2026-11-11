// ---------------- ARIA tabs: the keyboard (#262) ----------------
//
// A set of real tabs (role="tablist" > role="tab", each tied to its role="tabpanel") is one stop in the Tab order: the
// selected tab has tabindex="0", the others "-1". Inside it:
//   ArrowLeft / ArrowRight   the previous / next tab, wrapping round
//   Home / End               the first / last tab
// The tab moved to is focused and selected at once (automatic activation): it's clicked, so whatever the page does on a
// click — show its panel, remember the choice — happens the same way for the keyboard.
// A page's wiring module listens with `onTabKey` on the tablist's container; a builder marks the tabs; `selectTab` keeps
// tabindex and aria-selected right when a click changes the selection without redrawing. Choosers that aren't tabs (the page subtabs, Reports' picker) are plain buttons and don't use this.

function tabsOf(list){
  return Array.prototype.filter.call(list.querySelectorAll('[role="tab"]'), function(t){ return t.closest('[role="tablist"]') === list && !t.disabled && t.getClientRects().length; });
}

export function selectTab(tab){
  var list = tab.closest('[role="tablist"], .prop-tabs');
  if(!list) return;
  Array.prototype.filter.call(list.querySelectorAll('[role="tab"]'), function(t){
    return t.closest('[role="tablist"], .prop-tabs') === list;
  }).forEach(function(t){
    var on = t === tab;
    t.setAttribute("aria-selected", on ? "true" : "false");
    t.setAttribute("tabindex", on ? "0" : "-1");
  });
}

var KEYS = { ArrowLeft: -1, ArrowRight: 1, Home: "first", End: "last" };

export function onTabKey(e){
  var tab = e.target && e.target.closest && e.target.closest('[role="tab"]');
  if(!tab || !(e.key in KEYS) || e.altKey || e.ctrlKey || e.metaKey) return;
  var list = tab.closest('[role="tablist"]');
  var tabs = list ? tabsOf(list) : [];
  if(tabs.length < 2) return;
  var at = tabs.indexOf(tab), move = KEYS[e.key];
  var to = move === "first" ? tabs[0] : move === "last" ? tabs[tabs.length - 1] : tabs[(at + move + tabs.length) % tabs.length];
  e.preventDefault();
  to.focus();
  to.click();
}
