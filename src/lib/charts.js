import { escapeAttr } from "./html.js";

var SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs){
  var el = document.createElementNS(SVG_NS, tag);
  for(var k in attrs){ el.setAttribute(k, attrs[k]); }
  return el;
}

export function renderLineChart(container, series, opts){
  opts = opts || {};
  container.innerHTML = "";
  var validSeries = series.filter(function(s){ return s.points && s.points.length; });
  if(!validSeries.length){
    container.innerHTML = '<p style="color:var(--ink-soft);font-size:12.5px;margin:0">' + (opts.emptyMessage || "Not enough data yet.") + '</p>';
    return;
  }
  var W = 720, H = opts.height || 260;
  var padL = 60, padR = 16, padT = 14, padB = 26;
  var innerW = W - padL - padR, innerH = H - padT - padB;

  var xs = [], ys = [];
  validSeries.forEach(function(s){ s.points.forEach(function(p){ xs.push(p.x); ys.push(p.y); }); });
  var xMin = Math.min.apply(null, xs), xMax = Math.max.apply(null, xs);
  if(xMin === xMax) xMax = xMin + 1;
  var yMin = Math.min(0, Math.min.apply(null, ys));
  var yMax = Math.max.apply(null, ys);
  if(yMax === yMin) yMax = yMin + 1;
  var yPad = (yMax - yMin) * 0.08;
  yMax += yPad; if(yMin < 0) yMin -= yPad;

  function xScale(x){ return padL + (x - xMin) / (xMax - xMin) * innerW; }
  function yScale(y){ return padT + innerH - (y - yMin) / (yMax - yMin) * innerH; }
  function xInvert(px){ return xMin + (px - padL) / innerW * (xMax - xMin); }

  var wrap = document.createElement("div");
  wrap.className = "proj-chart-wrap";

  // Session-only (not persisted) — which series are hidden via the legend toggle below.
  // Axis scale stays fixed to all series' data regardless of what's toggled off, so hiding a
  // line never rescales/jumps the chart; only that line's path/dot/tooltip row disappear.
  var hiddenIdx = {};

  if(validSeries.length > 1 || opts.alwaysLegend){
    var legend = document.createElement("div");
    legend.className = "proj-legend";
    validSeries.forEach(function(s, idx){
      var item = document.createElement("div");
      item.className = "proj-legend-item" + (opts.interactiveLegend ? " proj-legend-item-toggle" : "");
      item.innerHTML = '<span class="proj-swatch ' + s.colorClass + '"></span><b>' + escapeAttr(s.label) + '</b>';
      if(opts.interactiveLegend){
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-pressed", "true");
        item.title = "Click to hide/show this line on the chart";
        var toggle = function(){
          hiddenIdx[idx] = !hiddenIdx[idx];
          var isHidden = !!hiddenIdx[idx];
          item.classList.toggle("is-hidden", isHidden);
          item.setAttribute("aria-pressed", isHidden ? "false" : "true");
          var line = svg.querySelector('[data-series-idx="' + idx + '"].series-line');
          var dot = svg.querySelector('[data-series-idx="' + idx + '"].series-dot');
          if(line) line.style.display = isHidden ? "none" : "";
          if(dot) dot.style.display = isHidden ? "none" : "";
        };
        item.addEventListener("click", toggle);
        item.addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); toggle(); } });
      }
      legend.appendChild(item);
    });
    wrap.appendChild(legend);
  }

  var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, class: "proj-svg", role: "img", "aria-label": opts.ariaLabel || "Chart" });

  var ticks = 5;
  for(var i = 0; i <= ticks; i++){
    var yVal = yMin + (yMax - yMin) * i / ticks;
    var yPix = yScale(yVal);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: yPix, y2: yPix, class: "proj-grid" }));
    var lbl = svgEl("text", { x: padL - 8, y: yPix + 4, "text-anchor": "end", class: "proj-axislabel" });
    lbl.textContent = opts.yFormat ? opts.yFormat(yVal) : Math.round(yVal);
    svg.appendChild(lbl);
  }
  if(yMin < 0 && yMax > 0){
    var zp = yScale(0);
    svg.appendChild(svgEl("line", { x1: padL, x2: W - padR, y1: zp, y2: zp, class: "proj-zero" }));
  }
  var xTickCount = Math.max(2, opts.xTickCount || 7);
  for(var ti = 0; ti < xTickCount; ti++){
    var xv = xMin + (xMax - xMin) * ti / (xTickCount - 1);
    var xPix = xScale(xv);
    var xvLabel = (ti === 0) ? xMin : (ti === xTickCount - 1) ? xMax : Math.round(xv);
    var anchor = ti === 0 ? "start" : (ti === xTickCount - 1 ? "end" : "middle");
    var xlbl = svgEl("text", { x: xPix, y: H - 8, "text-anchor": anchor, class: "proj-axislabel" });
    xlbl.textContent = opts.xFormat ? opts.xFormat(xvLabel) : xvLabel;
    svg.appendChild(xlbl);
  }

  validSeries.forEach(function(s, idx){
    var d = s.points.map(function(p, pidx){ return (pidx === 0 ? "M" : "L") + xScale(p.x).toFixed(1) + "," + yScale(p.y).toFixed(1); }).join(" ");
    svg.appendChild(svgEl("path", { d: d, class: "series-line " + s.colorClass, "data-series-idx": idx }));
    var last = s.points[s.points.length - 1];
    svg.appendChild(svgEl("circle", { cx: xScale(last.x), cy: yScale(last.y), r: 3.5, class: "series-dot " + s.colorClass, "data-series-idx": idx }));
  });

  var crosshair = svgEl("line", { y1: padT, y2: H - padB, class: "proj-crosshair", visibility: "hidden" });
  svg.appendChild(crosshair);
  var hitRect = svgEl("rect", { x: padL, y: padT, width: innerW, height: innerH, fill: "transparent" });
  hitRect.style.cursor = "crosshair";
  svg.appendChild(hitRect);

  var tooltip = document.createElement("div");
  tooltip.className = "viz-tooltip";
  wrap.appendChild(svg);
  wrap.appendChild(tooltip);
  container.appendChild(wrap);

  function nearestPointIndex(xData){
    var best = 0, bestDist = Infinity;
    validSeries[0].points.forEach(function(p, idx){
      var dist = Math.abs(p.x - xData);
      if(dist < bestDist){ bestDist = dist; best = idx; }
    });
    return best;
  }

  hitRect.addEventListener("mousemove", function(e){
    var rect = svg.getBoundingClientRect();
    var scaleX = W / rect.width;
    var px = (e.clientX - rect.left) * scaleX;
    var xData = xInvert(px);
    var idx = nearestPointIndex(xData);
    var xVal = validSeries[0].points[idx].x;
    var xPix = xScale(xVal);
    crosshair.setAttribute("x1", xPix); crosshair.setAttribute("x2", xPix);
    crosshair.setAttribute("visibility", "visible");
    var rows = validSeries.map(function(s, sidx){
      if(hiddenIdx[sidx]) return "";
      var pt = s.points[idx] || s.points[s.points.length - 1];
      return '<div class="viz-tooltip-row"><span class="proj-swatch ' + s.colorClass + '"></span>' + escapeAttr(s.label) + ': <b>' + (opts.yFormat ? opts.yFormat(pt.y) : Math.round(pt.y)) + '</b></div>';
    }).join("");
    tooltip.innerHTML = '<div style="margin-bottom:4px;color:var(--paper);opacity:.75">' + (opts.xFormat ? opts.xFormat(xVal) : xVal) + '</div>' + rows;
    tooltip.classList.add("show");
    var rectW = rect.width;
    var leftPct = (xPix / W) * 100;
    var tipWidthGuess = 150;
    var leftPx = (xPix / W) * rectW;
    var clampedLeft = Math.min(Math.max(leftPx, 4), rectW - tipWidthGuess - 4);
    tooltip.style.left = clampedLeft + "px";
    tooltip.style.top = "4px";
  });
  hitRect.addEventListener("mouseleave", function(){
    crosshair.setAttribute("visibility", "hidden");
    tooltip.classList.remove("show");
  });
}
