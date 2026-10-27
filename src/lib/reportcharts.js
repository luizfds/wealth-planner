import { escapeAttr } from "./html.js";
import { fmtCurrency0 } from "./format.js";

// ---------------- Report charts (v3.118.0) ----------------
// A chart over each report's table, as inline SVG so it prints with the page and needs no layout
// pass: "bars" (one horizontal bar per group, a tick for the comparison) and "columns" (two series
// per month, side by side). The table under it stays the record; this is the shape.
function compact(v){
  var a = Math.abs(v);
  if(a >= 1e6) return (v < 0 ? "−" : "") + "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if(a >= 1e4) return (v < 0 ? "−" : "") + "$" + Math.round(a / 1000) + "k";
  return (v < 0 ? "−" : "") + fmtCurrency0.format(a);
}
export function reportChartHtml(chart){
  if(!chart || !chart.items || !chart.items.length) return "";
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
    var W2 = 640, H2 = 160, pad = 18, slot = (W2 - pad) / cols.length, bw = Math.max(2, Math.min(18, slot / 2 - 3));
    var bars = cols.map(function(c, i){
      var x = pad + i * slot + slot / 2;
      var ha = (c.a || 0) / mx * (H2 - 34), hb = (c.b || 0) / mx * (H2 - 34);
      var showLabel = cols.length <= 13 || i % Math.ceil(cols.length / 12) === 0;
      return '<rect x="' + (x - bw - 1) + '" y="' + (H2 - 20 - ha) + '" width="' + bw + '" height="' + ha + '" class="rc-a"><title>' + escapeAttr(c.label + " — " + chart.series[0] + ": " + fmtCurrency0.format(c.a || 0)) + '</title></rect>' +
        '<rect x="' + (x + 1) + '" y="' + (H2 - 20 - hb) + '" width="' + bw + '" height="' + hb + '" class="rc-b"><title>' + escapeAttr(c.label + " — " + chart.series[1] + ": " + fmtCurrency0.format(c.b || 0)) + '</title></rect>' +
        (showLabel ? '<text x="' + x + '" y="' + (H2 - 6) + '" text-anchor="middle" class="rc-label">' + escapeAttr(c.label) + '</text>' : '');
    }).join("");
    return '<figure class="rc"><svg viewBox="0 0 ' + W2 + ' ' + H2 + '" role="img" aria-label="Chart of the report"><line x1="' + pad + '" x2="' + W2 + '" y1="' + (H2 - 20) + '" y2="' + (H2 - 20) + '" class="rc-axis"/>' + bars +
      '<text x="' + pad + '" y="10" class="rc-label">' + compact(mx) + '</text></svg>' +
      '<figcaption><span class="rc-key-a"></span>' + escapeAttr(chart.series[0]) + ' <span class="rc-key-b"></span>' + escapeAttr(chart.series[1]) + '</figcaption></figure>';
  }
  return "";
}
