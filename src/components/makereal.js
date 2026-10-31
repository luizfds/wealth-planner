// ---------------- Make it real (v3.176.0, item 211) ----------------
//
// The sheet that turns a scenario into the household: what will be added, changed and ended (from
// calc/makereal.js's dry run), what's left for later and why, and whether to remove the scenario
// afterwards. Applying it goes through app.js, with Undo.

import { state } from "../state.js";
import { makeRealPlan } from "../calc/makereal.js";
import { escapeAttr } from "../lib/html.js";
import { localDateStr } from "../lib/format.js";

export var mrQ = { open: false, name: null, removeAfter: true };

export function makeRealButtonHtml(scenario){
  return '<div class="mr-row"><button type="button" class="btn btn-sm" data-make-real="' + escapeAttr(scenario) + '">Make it real…</button>' +
    '<span class="ledger-note">When it happens — the lease signed, the property bought — its changes become the household\'s own rows.</span></div>';
}

export function makeRealSheetHtml(st, today){
  st = st || state;
  var name = mrQ.name;
  var plan = makeRealPlan(st, name, today || localDateStr());
  var li = function(t){ return '<li>' + escapeAttr(t) + '</li>'; };
  var body = '<div class="review-head"><h4>Make "' + escapeAttr(name) + '" real</h4><button type="button" class="icon-btn" data-mr-close aria-label="Close">✕</button></div>' +
    (plan.actions.length ? '<p class="mr-sub">This will:</p><ul class="mr-list">' + plan.actions.map(li).join("") + '</ul>' : '') +
    (plan.skipped.length ? '<p class="mr-sub">Left as it is:</p><ul class="mr-list mr-skipped">' + plan.skipped.map(function(s){ return '<li>' + escapeAttr(s.text) + ' <small>— ' + escapeAttr(s.why) + '</small></li>'; }).join("") + '</ul>' : '') +
    (plan.actions.length ? '<label class="mr-remove"><input type="checkbox" data-mr-remove' + (mrQ.removeAfter ? ' checked' : '') + '> Remove the scenario afterwards</label>' : '') +
    '<div class="txr-actions"><button type="button" class="btn btn-ghost" data-mr-close>Cancel</button>' +
    (plan.actions.length ? '<button type="button" class="btn btn-primary" data-mr-apply>Make it real</button>' : '') + '</div>';
  return '<div class="review-backdrop" data-mr-backdrop><div class="review-panel mr-panel" role="dialog" aria-modal="true" aria-label="Make it real">' + body + '</div></div>';
}
