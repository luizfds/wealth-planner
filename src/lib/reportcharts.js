import { escapeAttr } from "./html.js";
import { fmtCurrency0, fmtCompact } from "./format.js";

// ---------------- Report charts (v3.118.0) ----------------
// A chart over each report's table, as inline SVG so it prints with the page and needs no layout
// pass: "bars" (one horizontal bar per group, a tick for the comparison) and "columns" (two series
// per month, side by side). The table under it stays the record; this is the shape.
var compact = fmtCompact;
export function reportChartHtml(chart){
  if(!chart) return "";
  if(chart.type === "sankey") return sankeyHtml(chart);
  if(!chart.items || !chart.items.length) return "";
  if(chart.type === "bars"){
    var items = chart.items.filter(function(x){ return x.value > 0 || (x.compare || 0) > 0; });
    if(!items.length) return "";
    var max = Math.max.apply(null, items.map(function(x){ return Math.max(x.value, x.compare || 0); }));
    var rowH = 24, W = 640, labelW = 170, valW = 80, barW = W - labelW - valW - 10, H = items.length * rowH + 6;
    var body = items.map(function(x, i){
      var y = i * rowH + 3, w = max > 0 ? Math.max(1, x.value / max * barW) : 0;
      var tick = x.compare != null && max > 0 ? '<line x1="' + (labelW + x.compare / max * barW) + '" x2="' + (labelW + x.compare / max * barW) + '" y1="' + (y + 1) + '" y2="' + (y + rowH - 7) + '" class="rc-tick"><title>' + escapeAttr((chart.compareLabel || "Compared") + ": " + fmtCurrency0.format(x.compare)) + '</title></line>' : "";
      return '<text x="' + (labelW - 8) + '" y="' + (y + 13) + '" text-anchor="end" class="rc-label">' + escapeAttr(String(x.label).length > 24 ? String(x.label).slice(0, 23) + "…" : x.label) + '</text>' +
        '<rect x="' + labelW + '" y="' + (y + 3) + '" width="' + w + '" height="' + (rowH - 12) + '" rx="3" class="rc-bar"><title>' + escapeAttr(x.label + ": " + fmtCurrency0.format(x.value)) + '</title></rect>' + tick +
        '<text x="' + (W - 4) + '" y="' + (y + 13) + '" text-anchor="end" class="rc-val">' + compact(x.value) + '</text>';
    }).join("");
    return '<figure class="rc"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Chart of the report">' + body + '</svg>' +
      (chart.compareLabel ? '<figcaption><span class="rc-key-bar"></span>this period <span class="rc-key-tick"></span>' + escapeAttr(chart.compareLabel) + '</figcaption>' : '') + '</figure>';
  }
  if(chart.type === "columns"){
    var cols = chart.items;
    var mx = Math.max.apply(null, cols.map(function(c){ return Math.max(c.a || 0, c.b || 0); }).concat([1]));
    // v3.128.0: one series (a detail page's month by month) draws one wider column per slot.
    var single = chart.series.length < 2;
    var W2 = 640, H2 = 160, pad = 18, slot = (W2 - pad) / cols.length, bw = Math.max(2, Math.min(single ? 30 : 18, single ? slot - 8 : slot / 2 - 3));
    var bars = cols.map(function(c, i){
      var x = pad + i * slot + slot / 2;
      // A month that's net negative (refunds outweigh spending) draws nothing rather than a negative rect.
      var ha = Math.max(0, (c.a || 0) / mx * (H2 - 34)), hb = Math.max(0, (c.b || 0) / mx * (H2 - 34));
      var showLabel = cols.length <= 13 || i % Math.ceil(cols.length / 12) === 0;
      return '<rect x="' + (single ? x - bw / 2 : x - bw - 1) + '" y="' + (H2 - 20 - ha) + '" width="' + bw + '" height="' + ha + '" class="rc-a"><title>' + escapeAttr(c.label + " — " + chart.series[0] + ": " + fmtCurrency0.format(c.a || 0)) + '</title></rect>' +
        (single ? '' : '<rect x="' + (x + 1) + '" y="' + (H2 - 20 - hb) + '" width="' + bw + '" height="' + hb + '" class="rc-b"><title>' + escapeAttr(c.label + " — " + chart.series[1] + ": " + fmtCurrency0.format(c.b || 0)) + '</title></rect>') +
        (showLabel ? '<text x="' + x + '" y="' + (H2 - 6) + '" text-anchor="middle" class="rc-label">' + escapeAttr(c.label) + '</text>' : '');
    }).join("");
    return '<figure class="rc"><svg viewBox="0 0 ' + W2 + ' ' + H2 + '" role="img" aria-label="Chart of the report"><line x1="' + pad + '" x2="' + W2 + '" y1="' + (H2 - 20) + '" y2="' + (H2 - 20) + '" class="rc-axis"/>' + bars +
      '<text x="' + pad + '" y="10" class="rc-label">' + compact(mx) + '</text></svg>' +
      (single ? '</figure>' : '<figcaption><span class="rc-key-a"></span>' + escapeAttr(chart.series[0]) + ' <span class="rc-key-b"></span>' + escapeAttr(chart.series[1]) + '</figcaption></figure>');
  }
  if(chart.type === "sankey") return sankeyHtml(chart);
  return "";
}

// v3.119.0: three columns of nodes, each sized by its value, joined by bands sized by what flows.
function sankeyHtml(chart){
  var nodes = chart.nodes || [], links = chart.links || [];
  if(!nodes.length || !links.length) return "";
  var W = 640, H = 300, nodeW = 12, gap = 10, top = 8;
  var cols = [0, 1, 2].map(function(c){ return nodes.filter(function(n){ return n.col === c; }); });
  var colTotals = cols.map(function(c){ return c.reduce(function(s, n){ return s + n.value; }, 0); });
  var maxTotal = Math.max.apply(null, colTotals.concat([1]));
  var maxN = Math.max.apply(null, cols.map(function(c){ return c.length; }));
  var k = (H - top * 2 - gap * (maxN - 1)) / maxTotal;
  var xs = [150, 330, 500];
  var pos = {};
  cols.forEach(function(c, ci){
    var y = top;
    c.forEach(function(n){ var h = Math.max(1, n.value * k); pos[n.id] = { x: xs[ci], y: y, h: h, outY: y, inY: y, n: n }; y += h + gap; });
  });
  var bands = links.map(function(l){
    var a = pos[l.from], b = pos[l.to];
    if(!a || !b) return "";
    var h = Math.max(0.5, l.value * k);
    var y0 = a.outY + h / 2, y1 = b.inY + h / 2;
    a.outY += h; b.inY += h;
    var x0 = a.x + nodeW, x1 = b.x, mx = (x0 + x1) / 2;
    return '<path d="M' + x0 + ',' + y0.toFixed(1) + ' C' + mx + ',' + y0.toFixed(1) + ' ' + mx + ',' + y1.toFixed(1) + ' ' + x1 + ',' + y1.toFixed(1) + '" class="sk-band sk-' + escapeAttr(l.to) + '" stroke-width="' + h.toFixed(1) + '"><title>' +
      escapeAttr(a.n.label + " → " + b.n.label + ": " + fmtCurrency0.format(l.value)) + '</title></path>';
  }).join("");
  var rects = Object.keys(pos).map(function(id){
    var p = pos[id], left = p.n.col === 0;
    return '<rect x="' + p.x + '" y="' + p.y.toFixed(1) + '" width="' + nodeW + '" height="' + p.h.toFixed(1) + '" class="sk-node sk-' + escapeAttr(id) + '"/>' +
      '<text x="' + (left ? p.x - 6 : p.x + nodeW + 6) + '" y="' + (p.y + p.h / 2 - 2).toFixed(1) + '" text-anchor="' + (left ? "end" : "start") + '" class="rc-val">' + escapeAttr(p.n.label) + '</text>' +
      '<text x="' + (left ? p.x - 6 : p.x + nodeW + 6) + '" y="' + (p.y + p.h / 2 + 11).toFixed(1) + '" text-anchor="' + (left ? "end" : "start") + '" class="rc-label">' + compact(p.n.value) + '</text>';
  }).join("");
  return '<figure class="rc"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Where the money goes">' + bands + rects + '</svg></figure>';
}
