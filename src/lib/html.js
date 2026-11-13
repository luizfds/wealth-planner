export function escapeAttr(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
export function slug(s){ return s.replace(/[^a-z0-9]/gi, ""); }

// v3.139.0: a percentage written inside a coloured bar segment, on a small chip of its own so it reads
// on every series colour (white on the lighter ones fell short of 4.5:1).
export function segLabel(text){ return '<span class="seg-label">' + text + '</span>'; }

// Native chart figures keep their exact hover value; the same value names the image for screen readers.
export function figureAttrs(text){
  var label = escapeAttr(text);
  return ' role="img" aria-label="' + label + '" title="' + label + '"';
}
