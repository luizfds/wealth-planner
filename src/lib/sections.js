// ---------------- The lists a row can belong to (v3.206.2, item 237b) ----------------
//
// A row on screen carries data-section — "income", "shared", "home:<scenario>", "propinc:<property id>",
// "assets", "tx"… — and the generic row code (components/rows.js: edit, add, delete, Log, close an untouched
// new row) used to know every one of them by name. Now each page registers its own (defineSection, from its
// wiring module) and rows.js asks the registry. A section is "<kind>" or "<kind>:<arg>"; a kind marked
// `qualified` takes its arg as part of the section (a scenario, a property), anything else after the colon in a
// "+ Add" button's data-add is a group to file the new row under (a classification, a person, a category).
//
// What a kind can say, every hook optional (arg is what follows the colon):
//   rows(arg)                  the array its rows live in
//   redraw(arg)                rebuild its list(s) after rows were added, removed or restructured
//   inBudget(arg)              its rows show in Cash flow → Budget's list (so an edit keeps that in step)
//   editor                     { container, openState } — where "+ Add" opens the new row
//   newRow(item, group)        a new row's own defaults, on top of the generic ones
//   noClassification           its rows have no Needs / Wants classification
//   add(group)                 "+ Add" is its own (assets, a holding, a vehicle) — return true when handled
//   qualified                  the arg is part of the section (see above)
//   freqRebuilds               a frequency edit rebuilds the row (Income: the pay-day field depends on it)
//   beforeRecalc(arg, e)       during a field edit, before the derived rows are recalculated
//   afterEdit(arg, ctx)        a field edit's own redraw (ctx: { e, item, structural }); replaces the Budget one
//   afterAnyEdit(arg)          after every field edit, add or removal (a property's card figures)
//   afterAdd(arg)              after "+ Add"
//   afterRemove(arg)           after a delete, an undo or a discarded new row, before the shared redraw
//   discardRows(arg)           where an untouched new row is removed from, for a kind the generic edit code
//                              leaves alone (no rows()) — an asset, a loan, a transaction
//   discard(arg)               an untouched new row removed — its own redraw instead of the shared one
//   homeTotals                 its edits change a scenario block's totals
//   taxes                      its edits change somebody's tax (the Tax & super card)
var kinds = {};

export function defineSection(kind, def){ kinds[kind] = def; }

// { kind, arg, def } for a section string, or null when no page registered its kind.
export function sectionOf(section){
  var s = String(section || ""), i = s.indexOf(":");
  var kind = i === -1 ? s : s.slice(0, i);
  var def = kinds[kind];
  return def ? { kind: kind, arg: i === -1 ? "" : s.slice(i + 1), def: def } : null;
}

// A "+ Add" button's data-add: the section, and the group the new row goes under.
export function parseAdd(raw){
  var s = String(raw || ""), i = s.indexOf(":");
  var kind = i === -1 ? s : s.slice(0, i), def = kinds[kind];
  if(def && def.qualified) return { section: s, group: null };
  return { section: kind, group: i === -1 ? null : s.slice(i + 1) };
}

export function sectionKinds(){ return Object.keys(kinds); }

// A page's own buttons inside rows (Income's breakdown, "Record a pay change", a line's scenario override): the
// generic row click handler tries these first, in the order registered, before Log and Delete.
var actions = [];
export function defineRowAction(selector, handle){ actions.push({ selector: selector, handle: handle }); }
export function runRowAction(e){
  for(var i = 0; i < actions.length; i++){
    var el = e.target.closest(actions[i].selector);
    if(el){ actions[i].handle(el, e); return true; }
  }
  return false;
}
