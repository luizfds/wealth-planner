import { state } from "../state.js";
import { deductionReceipts } from "../calc/receipts.js";
import { taxYearRecord, personYear } from "../calc/taxyear.js";
import { fyWindow } from "../calc/property.js";
import { transactionDisplayName } from "../calc/ledger.js";
import { fmtCurrency2, fmtDate } from "../lib/format.js";
import { escapeAttr } from "../lib/html.js";

// ---------------- Receipts (v3.170.0, item 201) — calc/receipts.js decides, lib/receipts.js keeps the files ----------------
// The attach control a transaction, budget line, worksheet deduction or tax document shows, the
// "who's it for" key it travels by (data-rc-owner), and Tax → Documents' list of the year's deductions.

var CLIP = '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 9.5l-5.6 5.6a3.2 3.2 0 01-4.5-4.5l6.3-6.3a2.1 2.1 0 013 3l-6.2 6.2a1 1 0 01-1.5-1.4l5.5-5.5"/></svg>';
function sizeText(n){ n = Number(n) || 0; return n >= 1048576 ? (Math.round(n / 104857.6) / 10) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }

// An owner key → the object whose `receipts` it is: "tx:<id>" / "txi:<index>", "line:<id>",
// "ded:<fy>:<person>:<index>", "ev:<fy>:<evidence key>" (whose holder is made on the way).
export function receiptHolder(key, create){
  var m = /^(tx|txi|line|ded|ev):(.*)$/.exec(String(key || ""));
  if(!m) return null;
  if(m[1] === "tx") return (state.transactions || []).find(function(t){ return t && t.id === m[2]; }) || null;
  if(m[1] === "txi") return state.transactions[Number(m[2])] || null;
  if(m[1] === "line"){
    var all = (state.shared || []).slice();
    Object.keys(state.home || {}).forEach(function(k){ all = all.concat(state.home[k] || []); });
    return all.find(function(l){ return l && l.id === m[2]; }) || null;
  }
  if(m[1] === "ded"){
    var p = /^(\d{4}):(.+):(\d+)$/.exec(m[2]);
    var py = p && personYear(Number(p[1]), p[2], false);
    return py ? py.deductions[Number(p[3])] || null : null;
  }
  var e = /^(\d{4}):(.+)$/.exec(m[2]);
  if(!e) return null;
  var rec = taxYearRecord(Number(e[1]), !!create);
  if(!rec) return null;
  if(!rec.evidenceReceipts) rec.evidenceReceipts = {};
  // A holder whose `receipts` is the evidence's own list, so attach/detach edit it in place.
  var list = rec.evidenceReceipts[e[2]] || (create ? (rec.evidenceReceipts[e[2]] = []) : null);
  if(!list) return null;
  return { get receipts(){ return list; }, set receipts(v){ if(v) rec.evidenceReceipts[e[2]] = list = v; else delete rec.evidenceReceipts[e[2]]; } };
}
export function txOwnerKey(t, idx){ return t && t.id ? "tx:" + t.id : "txi:" + idx; }

// The control: each receipt (open it, or remove it) and Attach.
export function receiptsFieldHtml(owner, refs, opts){
  opts = opts || {};
  refs = refs || [];
  return '<div class="rc-field">' + refs.map(function(r){
    return '<span class="rc-item"><button type="button" class="link-btn rc-open" data-rc-open="' + escapeAttr(r.id) + '" title="Open ' + escapeAttr(r.name) + '">' + CLIP + ' ' + escapeAttr(r.name) + ' <small>' + sizeText(r.size) + '</small></button>' +
      '<button type="button" class="btn btn-danger btn-sm rc-del" data-rc-del="' + escapeAttr(r.id) + '" data-rc-owner="' + escapeAttr(owner) + '" aria-label="Remove the receipt ' + escapeAttr(r.name) + '">✕</button></span>';
  }).join("") +
  '<button type="button" class="btn btn-sm btn-ghost rc-add" data-rc-add="' + escapeAttr(owner) + '">' + CLIP + ' ' + (refs.length ? "Add another" : (opts.label || "Attach a receipt")) + '</button></div>';
}

// Tax → Documents: the year's deductions, those without a receipt first.
export function deductionReceiptsHtml(fy, lines){
  var win = fyWindow(fy);
  var rows = deductionReceipts(state, { fy: fy, lines: lines, window: { start: win.start, end: win.end }, nameOf: function(t){ return transactionDisplayName(t, state.shared); } });
  if(!rows.length) return '<h3 class="ty-docs-head">Deductions and their receipts</h3><p class="ledger-note" style="margin-left:0">No deductions for this year yet — spending on a budget line marked tax-deductible, and deductions typed on the worksheet, list here with their receipts.</p>';
  var have = rows.filter(function(r){ return r.hasReceipt; }).length;
  return '<h3 class="ty-docs-head">Deductions and their receipts <span class="ty-docs-count">' + have + ' of ' + rows.length + '</span></h3>' +
    '<div class="rc-deds">' + rows.map(function(r){
      var owner = r.kind === "tx" ? txOwnerKey(state.transactions[r.index], r.index) : r.key;
      var meta = [r.date ? fmtDate(r.date) : "", r.line, r.person].filter(Boolean).map(escapeAttr).join(" · ");
      return '<div class="rc-ded' + (r.hasReceipt ? "" : " is-missing") + '">' +
        '<div class="rc-ded-top"><span class="rc-ded-what"><b>' + escapeAttr(r.what) + '</b><small>' + meta + '</small></span><b class="rc-ded-amt">' + fmtCurrency2.format(r.amount) + '</b></div>' +
        (r.viaLine ? '<p class="rc-via">Covered by the receipt on its budget line.</p>' : '') +
        (r.viaLine ? '' : '<div class="rc-ded-foot">' + (r.hasReceipt ? '' : '<span class="rc-missing">No receipt</span>') + receiptsFieldHtml(owner, r.receipts) + '</div>') + '</div>';
    }).join("") + '</div>';
}
