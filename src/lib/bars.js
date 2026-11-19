// Pictures before words (November 2026): the bars Today led with, for any page. Dependency-free; the colours are the
// app's series palette (`series-color-N`, in a fixed order) and its status inks (good/warn/bad).
import { escapeAttr } from "./html.js";
import { fmtCurrency0, fmtCompact } from "./format.js";

var MAX = 6;   // series beyond this fold into "Other", never a ninth generated colour

// One bar made of parts that add up to a whole, with a legend under it (every part named — identity is never colour
// alone). parts: [{ label, value, tone? ("good"|"warn"|"bad"|"in"|"muted") }] — a part with a tone takes it, the rest
// take series colours in order. opts: { label (what the bar is, for the accessible name), total? (the whole; the sum by
// default), keep? (labels never folded into Other), legend? (false when every part is already named, with its figure,
// right beside the bar) }.
export function stackBarHtml(parts, opts){
  opts = opts || {};
  var list = (parts || []).filter(function(p){ return (Number(p.value) || 0) > 0; });
  var keep = opts.keep || [];
  var plain = list.filter(function(p){ return !p.tone && keep.indexOf(p.label) === -1; });
  if(plain.length > MAX){
    var sorted = plain.slice().sort(function(a, b){ return b.value - a.value; });
    var folded = sorted.slice(MAX - 1);
    var otherTotal = folded.reduce(function(s, p){ return s + p.value; }, 0);
    list = list.filter(function(p){ return folded.indexOf(p) === -1; });
    var at = list.findIndex(function(p){ return p.tone; });
    list.splice(at === -1 ? list.length : at, 0, { label: "Other", value: otherTotal });
  }
  var total = opts.total != null ? opts.total : list.reduce(function(s, p){ return s + p.value; }, 0);
  if(!(total > 0) || !list.length) return "";
  // A green part (what's left, what's covered) means the palette's two greens (slots 2 and 5) sit out, so no series
  // reads as it — the order stays fixed otherwise.
  var order = list.some(function(p){ return p.tone === "good"; }) ? [0, 1, 3, 4, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
  var i = 0;
  list = list.map(function(p){ return Object.assign({}, p, { cls: p.tone ? "tone-" + p.tone : "series-color-" + order[i++ % order.length] }); });
  var pct = function(v){ return Math.round(v / total * 100); };
  var said = (opts.label ? opts.label + ": " : "") + list.map(function(p){ return p.label + " " + fmtCurrency0.format(p.value) + " (" + pct(p.value) + "%)"; }).join(", ");
  return '<div class="vbar-wrap' + (opts.legend === false ? ' is-thin' : '') + '"><div class="vbar" role="img" aria-label="' + escapeAttr(said) + '">' + list.map(function(p){
    return '<span class="vbar-seg ' + p.cls + '" style="width:' + (p.value / total * 100).toFixed(2) + '%" title="' + escapeAttr(p.label + " " + fmtCurrency0.format(p.value)) + '"></span>';
  }).join("") + '</div>' + (opts.legend === false ? '' : '<ul class="vbar-legend" aria-hidden="true">' + list.map(function(p){
    return '<li><i class="vbar-dot ' + p.cls + '"></i>' + escapeAttr(p.label) + ' <b>' + fmtCompact(p.value) + '</b></li>';
  }).join("") + '</ul>') + '</div>';
}

// A bar of `value` against `of`, with optional marks along it (e.g. 3, 6 and 12 months): marks: [{ at, label }] in the
// bar's own units. opts: { label, tone ("good"|"warn"|"bad"|"in"), max? (the bar's full length; `of` by default) }.
export function progressBarHtml(value, of, opts){
  opts = opts || {};
  var max = opts.max != null ? opts.max : of;
  if(!(max > 0)) return "";
  var v = Math.max(0, Number(value) || 0), w = Math.min(1, v / max) * 100;
  var marks = (opts.marks || []).filter(function(m){ return m.at > 0 && m.at <= max; });
  var said = (opts.label ? opts.label + ": " : "") + fmtCurrency0.format(v) + (of ? " of " + fmtCurrency0.format(of) : "") +
    (marks.length ? "; marks at " + marks.map(function(m){ return m.label; }).join(", ") : "");
  return '<div class="vprog' + (marks.length ? ' has-marks' : '') + '"><div class="vprog-track" role="img" aria-label="' + escapeAttr(said) + '">' +
    '<span class="vprog-fill tone-' + (opts.tone || "in") + '" style="width:' + w.toFixed(1) + '%"></span>' +
    marks.map(function(m){ return '<span class="vprog-mark' + (v >= m.at ? ' is-met' : '') + '" style="left:' + (m.at / max * 100).toFixed(1) + '%"></span>'; }).join("") +
    '</div>' + (marks.length ? '<div class="vprog-labels" aria-hidden="true">' + marks.map(function(m){
      return '<span style="left:' + (m.at / max * 100).toFixed(1) + '%">' + escapeAttr(m.label) + '</span>'; }).join("") + '</div>' : '') + '</div>';
}
