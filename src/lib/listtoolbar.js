import { escapeAttr } from "./html.js";

// List headers share the same space for the title/total and occasional controls.
// controlsHtml, options.extraTotalHtml and itemsHtml are markup from the calling component, never imported text.
export function listToolbarHtml(title, total, controlsHtml, totalId, options){
  options = options || {};
  return '<div class="record-toolbar"><div class="record-heading"><h2 class="section-title">' + escapeAttr(title) + '</h2>' +
    '<span class="ledger-total">' + (options.compactTotal ? '<span class="visually-hidden">Total </span>' : 'Total ') + '<b' + (totalId ? ' id="' + escapeAttr(totalId) + '"' : '') + '>' + escapeAttr(total) + '</b></span>' + (options.extraTotalHtml || '') + '</div>' +
    '<div class="record-controls">' + controlsHtml + '</div></div>';
}
export function listActionsHtml(label, itemsHtml){
  return '<div class="page-overflow record-actions"><button type="button" class="page-overflow-btn" data-overflow-toggle aria-haspopup="true" aria-expanded="false" aria-label="' + escapeAttr(label) + '">⋯</button>' +
    '<div class="page-overflow-menu" data-overflow-menu hidden>' + itemsHtml + '</div></div>';
}
