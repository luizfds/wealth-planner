import { escapeAttr } from "../lib/html.js";

// The quick tour's markup (#339). The card is built once and stays; only what's inside its live region
// changes from step to step, so the Next button keeps the keyboard's focus and a screen reader hears
// each step as it arrives. Its copy is the app's own — no household's figures are ever in it.

// Home's one-line offer. It asks once (lib/tour.js) and both answers put it away for good.
export function tourOfferHtml(){
  return '<p class="tour-offer-text"><b>New here?</b> A quick tour shows where everything lives. It takes about a minute.</p>' +
    '<div class="tour-offer-actions"><button type="button" class="btn btn-sm btn-ghost" data-tour-skip>Skip</button>' +
    '<button type="button" class="btn btn-sm btn-primary" data-tour-start>Start tour</button></div>';
}

export function tourShellHtml(){
  return '<div class="tour-dim" data-tour-dim></div><div class="tour-spot" data-tour-spot hidden></div>' +
    '<div class="tour-card" role="dialog" aria-modal="true" aria-label="Quick tour">' +
      '<button type="button" class="tour-close" data-tour-end aria-label="Close the tour">✕</button>' +
      '<div class="tour-live" data-tour-live aria-live="polite" aria-atomic="true"></div>' +
      '<div class="tour-foot"><button type="button" class="btn btn-ghost" data-tour-end data-tour-skip-btn>Skip tour</button>' +
        '<span class="tour-nav"><button type="button" class="btn" data-tour-back>Back</button>' +
        '<button type="button" class="btn btn-primary" data-tour-next>Next</button></span></div>' +
    '</div>';
}

// One step: how far through, the place's name, what it's for — and on the last one, the first-month
// steps (`checklist`: lib/setup.js's setupSteps) as places to go, each of which ends the tour there.
export function tourStepHtml(step, index, total, checklist){
  var list = "";
  if(step.checklist && checklist && checklist.length){
    list = '<ul class="tour-list">' + checklist.map(function(c, i){
      return '<li><button type="button" class="tour-go' + (c.done ? " is-done" : "") + '" data-tour-go="' + i + '">' +
        '<span class="tour-tick" aria-hidden="true">' + (c.done ? "✓" : "") + '</span><span>' + escapeAttr(c.label) +
        (c.done ? '<span class="visually-hidden"> (done)</span>' : "") + '</span><span class="tour-go-arrow" aria-hidden="true">→</span></button></li>';
    }).join("") + '</ul>';
  }
  return '<div class="tour-count">Step ' + (index + 1) + ' of ' + total + '</div>' +
    '<div class="tour-progress" aria-hidden="true">' + Array.from({ length: total }, function(_, i){ return '<i class="' + (i <= index ? "on" : "") + '"></i>'; }).join("") + '</div>' +
    '<h2 class="tour-title">' + escapeAttr(step.title) + '</h2>' +
    '<p class="tour-text">' + escapeAttr(step.text) + '</p>' + list;
}
