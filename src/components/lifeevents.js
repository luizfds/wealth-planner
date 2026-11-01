import { state, genId } from "../state.js";
import { EVENT_KINDS, kindOf, newEvent } from "../calc/lifeevents.js";
import { fireSettings } from "../calc/fire.js";
import { localDateStr } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Plan → Projections: life events (v3.126.0) ----------------
// A short list of dated events under the projection's assumptions, each a row of plain fields.
export function lifeEventsHtml(today){
  var thisYear = Number((today || localDateStr()).slice(0, 4));
  var age = fireSettings().currentAge;
  var rows = (state.lifeEvents || []).slice().sort(function(a, b){ return (Number(a.year) || 0) - (Number(b.year) || 0); }).map(function(ev){
    var k = kindOf(ev.kind), id = escapeAttr(ev.id);
    var at = age != null ? '<small>age ' + (age + (Number(ev.year) || thisYear) - thisYear) + '</small>' : '';
    return '<div class="le-row" data-le-id="' + id + '"><span class="le-kind">' + escapeAttr(k.label) + '</span>' +
      '<label class="cf-filter"><span>What</span><input type="text" data-le-field="what" value="' + escapeAttr(ev.what || "") + '"></label>' +
      '<label class="cf-filter le-year"><span>From</span><input type="number" min="' + thisYear + '" max="' + (thisYear + 60) + '" step="1" data-le-field="year" value="' + escapeAttr(ev.year) + '">' + at + '</label>' +
      (ev.kind === "lump" ? '' : '<label class="cf-filter le-num"><span>For years</span><input type="number" min="1" max="60" step="1" data-le-field="years" value="' + escapeAttr(ev.years) + '"></label>') +
      '<label class="cf-filter le-amt"><span>' + escapeAttr(k.help.charAt(0).toUpperCase() + k.help.slice(1)) + '</span><input type="number" step="500" data-le-field="amount" value="' + escapeAttr(ev.amount) + '"></label>' +
      '<button type="button" class="btn btn-sm btn-danger le-remove" data-le-remove="' + id + '" aria-label="Remove ' + escapeAttr(ev.what || k.label) + '">Remove</button></div>';
  }).join("");
  return '<div class="le-card"><div class="property-section-title">Life events</div>' +
    (rows || '<p class="ledger-note" style="margin:0 0 8px">Nothing dated yet — a child, a year off, a sale, an inheritance.</p>') +
    '<div class="le-add"><span>Add</span>' + EVENT_KINDS.map(function(k){ return '<button type="button" class="period-chip" data-le-add="' + k.key + '">' + escapeAttr(k.label) + '</button>'; }).join("") + '</div>' +
    '<p class="ledger-note help" style="margin:6px 0 0">Added to every scenario in today\'s dollars and marked on the chart. A sale here is its proceeds after the loan and costs; the property itself still grows on the chart unless you remove it.</p></div>';
}
export function addLifeEvent(kind, today){
  var ev = newEvent(kind, Number((today || localDateStr()).slice(0, 4)), genId("ev"));
  state.lifeEvents.push(ev);
  return ev;
}
export function setLifeEventField(id, field, value){
  var ev = state.lifeEvents.find(function(e){ return e.id === id; });
  if(!ev) return false;
  ev[field] = field === "what" ? String(value) : (value === "" ? (field === "amount" ? 0 : null) : Number(value));
  return true;
}
export function removeLifeEvent(id){ state.lifeEvents = state.lifeEvents.filter(function(e){ return e.id !== id; }); }
