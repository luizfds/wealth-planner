// ---------------- Money → Budget → Tidy up (November 2026) — calc/tidy.js ----------------
//
// Two parts. "Looks misfiled": a shop nearly always filed on one line, with one or two on another — move them, or
// say it's right and it isn't asked again. "Look inside a line": everything a line collected over the last year, by
// shop; open one to move all of it (or the purchases ticked) to another line or a new one, teach the import to file
// that shop there from now on, or count those purchases as Essential or Lifestyle whatever the line is.
import { state } from "../state.js";
import { strays, strayCountByLine, lineMerchants, mixedLines, TIDY_MONTHS } from "../calc/tidy.js";
import { transactionClass } from "../calc/ledger.js";
import { loggableBudgetLineItems, transactionAccount } from "./expenses.js";
import { fmtCurrency0, fmtCurrency2, fmtDate, localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";
import { classWord } from "../constants.js";
import { emptyStateHtml } from "../lib/empty.js";

// What's open, ticked and typed — this device's session only.
// picked: { txId: false } for a purchase un-ticked (everything starts ticked).
export var tidyUi = { lineId: "", openKey: null, picked: {}, moveTo: "", newName: "", newClass: "Wants", teach: true, showAllStrays: false };
var STRAYS_SHOWN = 6;

function money(n){ return fmtCurrency0.format(Math.round(Number(n) || 0)); }
function plural(n, one, many){ return n + " " + (n === 1 ? one : (many || one + "s")); }
function lineMap(lines){ var m = {}; (lines || []).forEach(function(l){ if(l && l.id) m[l.id] = l; }); return m; }

export function currentStrays(today){
  return strays(state.transactions, loggableBudgetLineItems(), { today: today || localDateStr(), ok: state.tidyOk || {}, trips: state.trips || [] });
}
// The marker on a budget row: how many of its purchases look misfiled. Plain text — the row's summary is itself a button.
export function tidyMarkerHtml(lineId, counts){
  var n = counts && counts[lineId];
  return n ? '<span class="tidy-pill" title="Purchases on this line that usually go on another — open the line to see them">' + escapeAttr(n + " to check") + '</span>' : "";
}
export function strayCounts(today){ return strayCountByLine(currentStrays(today)); }
// Inside an open budget line, first: the purchases its "N to check" marker counts — what, when, where they usually go —
// with Move and It's right right there. The marker is plain text on a button-row, so this is where tapping it leads.
export function tidyStraysForLineHtml(lineId, list){
  var mine = (list || []).filter(function(s){ return s.fromLineId === lineId; });
  if(!mine.length) return "";
  var byId = lineMap(loggableBudgetLineItems());
  var txById = {};
  (state.transactions || []).forEach(function(t){ if(t && t.id) txById[t.id] = t; });
  var n = mine.reduce(function(a, s){ return a + s.count; }, 0);
  return '<div class="m-edit-field span3 tidy-inrow"><b class="tidy-inrow-title">' + escapeAttr(n === 1 ? "1 purchase here usually goes on another line" : n + " purchases here usually go on another line") + '</b>' +
    mine.map(function(s){
      var to = (byId[s.toLineId] && byId[s.toLineId].what) || "another line";
      var when = s.txIds.map(function(id){ var t = txById[id]; return t ? fmtDate(t.date, { year: true }) + " " + fmtCurrency2.format(Number(t.amount) || 0) : ""; }).filter(Boolean).join(", ");
      return '<div class="tidy-inrow-item"><span><b>' + escapeAttr(s.label) + '</b> <small>' + escapeAttr(when) + (s.typed && s.typed.length ? ' · you called it “' + escapeAttr(s.typed.join("”, “")) + '”' : '') + ' · your other ' + s.mainCount + ' ' + (s.mainCount === 1 ? "is" : "are") + ' on ' + escapeAttr(to) + '</small></span>' +
        '<span class="tidy-inrow-act"><button type="button" class="btn btn-sm" data-tidy-row-move="' + escapeAttr(s.id) + '">Move to ' + escapeAttr(to) + '</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-tidy-row-ok="' + escapeAttr(s.id) + '">It\'s right</button></span></div>';
    }).join("") + '</div>';
}
// Inside an open budget row: straight to this line in Tidy up.
export function tidyLinkHtml(lineId){
  return lineId ? '<div class="m-edit-field span3"><button type="button" class="link-btn" data-tidy-open="' + escapeAttr(lineId) + '">Tidy this line — see where its money went →</button></div>' : "";
}

export function renderTidy(){
  var el = typeof document !== "undefined" && document.getElementById("tidyBody");
  if(!el) return;
  var today = localDateStr();
  var list = currentStrays(today);
  el.innerHTML = tidyHtml(list, today);
  var cnt = document.getElementById("tidyCount");
  if(cnt) cnt.textContent = list.length ? list.reduce(function(s, x){ return s + x.count; }, 0) + " to check" : "";
}

function lineOptionsHtml(lines, selected, opts){
  opts = opts || {};
  var sorted = lines.slice().sort(function(a, b){ return String(a.what || "").localeCompare(String(b.what || "")); });
  return (opts.placeholder ? '<option value="">' + escapeAttr(opts.placeholder) + '</option>' : '') +
    sorted.filter(function(l){ return l.id !== opts.except; }).map(function(l){
      return '<option value="' + escapeAttr(l.id) + '"' + (l.id === selected ? " selected" : "") + '>' + escapeAttr(l.what || "Line") + '</option>';
    }).join("") + (opts.newLine ? '<option value="__new"' + (selected === "__new" ? " selected" : "") + '>+ A new line…</option>' : '');
}

export function tidyHtml(list, today){
  var lines = loggableBudgetLineItems();
  var byId = lineMap(lines);
  var name = function(id){ return (byId[id] && byId[id].what) || "a deleted line"; };
  var html = '<div class="rc-sec">Looks misfiled</div>';
  if(!list.length){
    html += emptyStateHtml("Nothing looks misfiled — each shop sits on the line it usually does.", { done: true });
  } else {
    html += '<p class="ledger-note tr-note">A shop nearly always filed on one line, with a purchase or two on another. Move them, or say it\'s right and it won\'t be asked again.</p>';
    var shown = tidyUi.showAllStrays ? list : list.slice(0, STRAYS_SHOWN);
    html += shown.map(function(s){
      return '<div class="rc-row tidy-stray"><div class="rc-main"><b>' + escapeAttr(s.label) + '</b><small>' + escapeAttr(plural(s.count, "purchase")) + ' on ' + escapeAttr(name(s.fromLineId)) +
          ' · your other ' + s.mainCount + ' ' + (s.mainCount === 1 ? "is" : "are") + ' on ' + escapeAttr(name(s.toLineId)) + (s.typed && s.typed.length ? ' · you called it “' + escapeAttr(s.typed.join("”, “")) + '”' : '') + '</small></div>' +
        '<span class="rc-amt">' + money(s.total) + '</span>' +
        '<div class="rc-actions"><button type="button" class="btn btn-sm" data-tidy-move="' + escapeAttr(s.id) + '">Move to ' + escapeAttr(name(s.toLineId)) + '</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-tidy-ok="' + escapeAttr(s.id) + '">It\'s right</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-tidy-see="' + escapeAttr(s.fromLineId) + '" data-tidy-key="' + escapeAttr(s.key) + '" aria-label="See ' + escapeAttr(s.label) + ' on ' + escapeAttr(name(s.fromLineId)) + '">See</button></div></div>';
    }).join("");
    var foot = [];
    var purchases = list.reduce(function(a, x){ return a + x.count; }, 0);
    if(list.length > STRAYS_SHOWN) foot.push('<button type="button" class="btn btn-sm btn-ghost" data-tidy-more>' + (tidyUi.showAllStrays ? "Show fewer" : "Show all " + list.length + " shops") + '</button>');
    if(list.length > 1) foot.push('<button type="button" class="btn btn-sm btn-ghost" data-tidy-move-all>Move all ' + purchases + ' to their usual line</button>');
    if(foot.length) html += '<div class="tr-all">' + foot.join("") + '</div>';
  }
  html += '<div class="rc-sec">Look inside a line</div>' + lineInspectorHtml(lines, byId, today);
  return html;
}

function lineInspectorHtml(lines, byId, today){
  if(!lines.length) return emptyStateHtml("No budget lines yet — add one to the budget above.", { scroll: "#sharedGroups", label: "Go to the budget lines ↑" });
  var line = byId[tidyUi.lineId];
  var mixed = mixedLines(state.transactions, lines, { today: today }).slice(0, 4);
  var html = '<label class="tidy-pick"><span>Line</span><select class="field-control" data-tidy-line aria-label="Budget line to look inside">' +
    lineOptionsHtml(lines, line ? line.id : "", { placeholder: "Choose a line…" }) + '</select></label>';
  if(!line){
    if(mixed.length) html += '<p class="ledger-note tr-note">Most mixed: ' + mixed.map(function(m){
      return '<button type="button" class="chip" data-tidy-pick="' + escapeAttr(m.lineId) + '">' + escapeAttr(m.what) + ' · ' + plural(m.merchants, "shop") + '</button>';
    }).join(" ") + '</p>';
    return html;
  }
  var groups = lineMerchants(state.transactions, line.id, { today: today });
  if(!groups.length) return html + emptyStateHtml("Nothing spent on " + (line.what || "this line") + " in the last " + TIDY_MONTHS + " months.", { done: true });
  var total = groups.reduce(function(s, g){ return s + g.total; }, 0);
  var lineCls = line.classification && line.classification !== "N/A" ? line.classification : "";
  var other = lineCls === "Needs" ? "Wants" : lineCls === "Wants" ? "Needs" : "";
  var otherN = groups.reduce(function(s, g){ return s + (other === "Wants" ? g.wants : other === "Needs" ? g.needs : g.wants + g.needs); }, 0);
  html += '<p class="ledger-note tr-note"><b>' + money(total) + '</b> over the last ' + TIDY_MONTHS + ' months, at ' + plural(groups.filter(function(g){ return g.key; }).length, "shop") +
    (lineCls ? ' · the line counts as ' + escapeAttr(classWord(lineCls)) + (otherN ? ', ' + plural(otherN, "purchase") + ' as ' + classWord(other) : '') : '') + '. Open a shop to move it or count it as Essential or Lifestyle.</p>';
  html += '<div class="tidy-shops">' + groups.map(function(g){
    var open = tidyUi.openKey === g.key;
    var tag = (g.wants ? '<span class="tidy-tag">' + g.wants + ' Lifestyle</span>' : '') + (g.needs ? '<span class="tidy-tag">' + g.needs + ' Essential</span>' : '');
    return '<div class="tidy-shop' + (open ? ' open' : '') + '">' +
      '<button type="button" class="tidy-shop-head" data-tidy-shop="' + escapeAttr(g.key) + '" aria-expanded="' + open + '">' +
        '<span class="tidy-shop-name">' + escapeAttr(g.label) + tag + '</span>' +
        '<span class="tidy-shop-bar" aria-hidden="true"><span style="width:' + (total > 0 ? Math.round(g.total / total * 100) : 0) + '%"></span></span>' +
        '<span class="tidy-shop-amt">' + money(g.total) + (g.count > 1 ? ' <small>×' + g.count + '</small>' : '') + '</span></button>' +
      (open ? shopPanelHtml(g, line, byId) : '') + '</div>';
  }).join("") + '</div>';
  return html;
}

function shopPanelHtml(g, line, byId){
  var txById = {};
  (state.transactions || []).forEach(function(t){ if(t && t.id) txById[t.id] = t; });
  var txs = g.txIds.map(function(id){ return txById[id]; }).filter(Boolean).sort(function(a, b){ return String(b.date).localeCompare(String(a.date)); });
  var picked = txs.filter(function(t){ return tidyUi.picked[t.id] !== false; }).length;
  var lines = Object.keys(byId).map(function(k){ return byId[k]; });
  var rows = txs.map(function(t){
    var cls = transactionClass(t, line);
    var own = t.classification ? ' <span class="tidy-tag">' + escapeAttr(classWord(cls)) + '</span>' : '';
    var note = String(t.what || "").trim() && t.bankWhat && t.what.trim() !== String(t.bankWhat).trim() ? ' · ' + escapeAttr(t.what) : '';
    var acct = transactionAccount(t);
    // The tick in a span: a label directly around a checkbox becomes the phone's inline-flex touch target (phone.css),
    // which would undo this row's grid. The row keeps the 44px itself.
    return '<li><label><span class="tidy-tick"><input type="checkbox" data-tidy-tx="' + escapeAttr(t.id) + '"' + (tidyUi.picked[t.id] !== false ? ' checked' : '') + '></span>' +
      '<span class="tidy-tx-main"><span class="tidy-tx-what">' + escapeAttr(String(t.bankWhat || t.what || g.label)) + own + '</span>' +
        '<small>' + escapeAttr(fmtDate(t.date || "", { year: true })) + (acct ? ' · ' + escapeAttr(acct) : '') + note + '</small></span>' +
      '<b>' + fmtCurrency2.format(Number(t.amount) || 0) + '</b></label></li>';
  }).join("");
  var isNew = tidyUi.moveTo === "__new";
  var teach = g.key ? '<label class="tidy-teach"><input type="checkbox" data-tidy-teach' + (tidyUi.teach ? ' checked' : '') + '> File ' + escapeAttr(g.label) + ' there from future statements too</label>' : '';
  var none = picked ? '' : ' disabled';
  return '<div class="tidy-panel">' +
    '<div class="tidy-panel-top"><span>' + picked + ' of ' + txs.length + ' ticked</span>' +
      '<button type="button" class="link-btn" data-tidy-tick="all">Tick all</button><button type="button" class="link-btn" data-tidy-tick="none">Untick all</button></div>' +
    '<ul class="tidy-txs">' + rows + '</ul>' +
    '<div class="tidy-act"><span class="tidy-act-label">Move to</span>' +
      '<select class="field-control" data-tidy-to aria-label="Move the ticked purchases to">' + lineOptionsHtml(lines, tidyUi.moveTo, { placeholder: "Choose a line…", except: line.id, newLine: true }) + '</select>' +
      (isNew ? '<input type="text" class="field-control" data-tidy-new-name value="' + escapeAttr(tidyUi.newName) + '" placeholder="' + escapeAttr((line.what || "Line") + " – " + g.label) + '" aria-label="New line name">' +
        '<select class="field-control" data-tidy-new-class aria-label="New line is essential or lifestyle"><option value="Needs"' + (tidyUi.newClass === "Needs" ? " selected" : "") + '>Essential</option><option value="Wants"' + (tidyUi.newClass === "Wants" ? " selected" : "") + '>Lifestyle</option></select>' : '') +
      '<button type="button" class="btn btn-sm btn-primary" data-tidy-apply-move' + (picked && tidyUi.moveTo ? '' : ' disabled') + '>Move ' + picked + '</button>' + teach + '</div>' +
    '<div class="tidy-act"><span class="tidy-act-label">Count as</span>' +
      '<button type="button" class="btn btn-sm" data-tidy-class="Needs"' + none + '>Essential</button>' +
      '<button type="button" class="btn btn-sm" data-tidy-class="Wants"' + none + '>Lifestyle</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-tidy-class=""' + none + '>As the line' + (line.classification && line.classification !== "N/A" ? ' (' + escapeAttr(classWord(line.classification)) + ')' : '') + '</button></div>' +
  '</div>';
}
